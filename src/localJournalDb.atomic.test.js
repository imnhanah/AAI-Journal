import test from 'node:test';
import assert from 'node:assert/strict';

// This IndexedDB double intentionally lets readonly reads overlap, but queues
// readwrite transactions exactly as a browser does for the same object store.
// It catches the old pattern where two tabs read separate whole-journal copies
// and each later overwrites the other's write.
const rows = new Map();
let writeActive = false;
const writeQueue = [];
const localValues = new Map();
globalThis.localStorage = {
  get length() { return localValues.size; },
  key(index) { return [...localValues.keys()][index] || null; },
  getItem(key) { return localValues.has(key) ? localValues.get(key) : null; },
  setItem(key, value) { localValues.set(key, String(value)); },
  removeItem(key) { localValues.delete(key); },
};
const channels = new Map();
globalThis.BroadcastChannel = class FakeBroadcastChannel {
  constructor(name) { this.name = name; this.listeners = new Set(); (channels.get(name) || channels.set(name, new Set()).get(name)).add(this); }
  addEventListener(type, listener) { if (type === 'message') this.listeners.add(listener); }
  removeEventListener(type, listener) { if (type === 'message') this.listeners.delete(listener); }
  postMessage(data) { for (const peer of channels.get(this.name) || []) if (peer !== this) queueMicrotask(() => peer.listeners.forEach(listener => listener({ data }))); }
};

function startWrite(work) {
  if (writeActive) {
    writeQueue.push(work);
    return;
  }
  writeActive = true;
  work();
}

function finishWrite() {
  writeActive = false;
  const next = writeQueue.shift();
  if (next) {
    writeActive = true;
    next();
  }
}

globalThis.indexedDB = {
  open() {
    const request = {};
    queueMicrotask(() => {
      request.result = {
        close() {},
        transaction(_store, mode = 'readonly') {
          let closed = false;
          let transaction;
          const complete = () => {
            if (closed) return;
            closed = true;
            transaction.oncomplete?.();
            if (mode === 'readwrite') finishWrite();
          };
          transaction = {
            error: null,
            oncomplete: null,
            onerror: null,
            onabort: null,
            abort() {
              if (closed) return;
              closed = true;
              transaction.onabort?.();
              if (mode === 'readwrite') finishWrite();
            },
            objectStore() {
              return {
                get(key) {
                  const query = {};
                  const read = () => queueMicrotask(() => {
                    query.result = structuredClone(rows.get(key));
                    query.onsuccess?.();
                  });
                  if (mode === 'readwrite') startWrite(read);
                  else read();
                  return query;
                },
                put(value, key) {
                  rows.set(key, structuredClone(value));
                  queueMicrotask(complete);
                },
              };
            },
          };
          return transaction;
        },
      };
      request.onsuccess?.();
    });
    return request;
  },
};

test('two browser tabs do not overwrite separately saved local trades', async () => {
  rows.clear();
  localValues.clear();
  writeActive = false;
  writeQueue.length = 0;
  // Query strings force two independent module instances: each has its own
  // in-memory pendingChanges queue, like two real tabs do.
  const stamp = `${Date.now()}-${Math.random()}`;
  const tabA = await import(`./localJournalDb.js?atomic-tab-a=${stamp}`);
  const tabB = await import(`./localJournalDb.js?atomic-tab-b=${stamp}`);
  const userId = `atomic-user-${stamp}`;

  tabA.configureLocalJournal(userId, true);
  const account = await tabA.createAccount(userId, { id: 'atomic-account', name: 'Atomic account', balance: 1000 });
  tabB.configureLocalJournal(userId, true);

  await Promise.all([
    tabA.createTrade(userId, account.data.id, { id: 'trade-tab-a', asset: 'EUR/USD', pnl: 50 }),
    tabB.createTrade(userId, account.data.id, { id: 'trade-tab-b', asset: 'GBP/USD', pnl: 51 }),
  ]);

  const saved = await tabA.fetchAllUserData(userId);
  assert.deepEqual(
    saved.data.accounts[0].trades.map((trade) => trade.id).sort(),
    ['trade-tab-a', 'trade-tab-b'],
  );

  // A retry reuses the form's stable ID. It updates the original record rather
  // than appending a second trade, even when the first response was ambiguous.
  await tabA.createTrade(userId, account.data.id, { id: 'trade-tab-a', asset: 'EUR/USD', pnl: 55, context: 'retried safely' });
  const retried = await tabB.fetchAllUserData(userId);
  assert.equal(retried.data.accounts[0].trades.filter((trade) => trade.id === 'trade-tab-a').length, 1);
  assert.equal(retried.data.accounts[0].trades.find((trade) => trade.id === 'trade-tab-a').pnl, 55);
  assert.equal(retried.data.accounts[0].trades.find((trade) => trade.id === 'trade-tab-a').context, 'retried safely');
});

test('new reward presets and account/list patches never replace committed trades', async () => {
  rows.clear();
  localValues.clear();
  writeActive = false;
  writeQueue.length = 0;
  const stamp = `${Date.now()}-${Math.random()}`;
  const journal = await import(`./localJournalDb.js?reward-preset=${stamp}`);
  const userId = `reward-preset-user-${stamp}`;
  journal.configureLocalJournal(userId, true);
  const account = await journal.createAccount(userId, { id:'reward-account', name:'Reward account', balance:100 });

  // This is the original loss shape: a new positive R causes a reward-preset
  // save immediately after the trade write.
  await journal.createTrade(userId, account.data.id, { id:'aud-usd', asset:'AUD/USD', pnl:51, rr:2.4, time:'08:23' });
  await journal.addRewardPreset(account.data.id, 2.4);
  let saved = await journal.fetchAllUserData(userId);
  assert.equal(saved.data.accounts[0].trades.find(trade => trade.id === 'aud-usd').pnl, 51);
  assert.deepEqual(saved.data.accounts[0].rewardPresets, [2.4]);

  await journal.updateTrade('aud-usd', { pnl:10, rr:3.5, closeTime:'09:40' });
  await journal.addRewardPreset(account.data.id, 3.5);
  // A full account snapshot is rejected down to its approved scalar patch.
  await journal.updateAccount(account.data.id, { trades:[], name:'Renamed safely' });
  await journal.saveManagedLists(userId, { typeTags:['Liquidity'] });
  saved = await journal.fetchAllUserData(userId);
  const edited = saved.data.accounts[0].trades.find(trade => trade.id === 'aud-usd');
  assert.equal(edited.pnl, 10);
  assert.equal(edited.closeTime, '09:40');
  assert.equal(saved.data.accounts[0].trades.length, 1);
  assert.deepEqual(saved.data.accounts[0].rewardPresets, [2.4, 3.5]);
  assert.equal(saved.data.accounts[0].name, 'Renamed safely');
  assert.deepEqual(saved.data.typeTags, ['Liquidity']);
});

test('recovery replay is idempotent and another tab receives an atomic-save notification', async () => {
  rows.clear();
  localValues.clear();
  writeActive = false;
  writeQueue.length = 0;
  const stamp = `${Date.now()}-${Math.random()}`;
  const tabA = await import(`./localJournalDb.js?recovery-tab-a=${stamp}`);
  const tabB = await import(`./localJournalDb.js?recovery-tab-b=${stamp}`);
  const userId = `recovery-user-${stamp}`;
  tabA.configureLocalJournal(userId, true);
  const account = await tabA.createAccount(userId, { id: 'recovery-account', name: 'Recovery account', balance: 1000 });
  tabB.configureLocalJournal(userId, true);

  let broadcast = null;
  const stopSending = tabA.subscribeToLocalJournalChanges(userId, () => {});
  const unsubscribe = tabB.subscribeToLocalJournalChanges(userId, message => { broadcast = message; });
  await tabA.createTrade(userId, account.data.id, { id: 'broadcast-trade', asset: 'USD/JPY', pnl: 0 });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(broadcast?.type, 'journal-changed');
  stopSending();
  unsubscribe();

  const base = (await tabA.fetchAllUserData(userId)).data;
  const next = structuredClone(base);
  next.customInstruments = [{ symbol:'TEST/RECOVERY' }];
  localStorage.setItem(`aaicorefx-local-journal-recovery:${encodeURIComponent(userId)}:replay-once`, JSON.stringify({ version:1, operationId:'replay-once', userId, createdAt:'2026-11-07T00:00:00.000Z', base, next }));
  assert.deepEqual(await tabA.recoverPendingLocalJournal(userId), { recovered:1, pending:0, error:null });
  assert.equal((await tabB.fetchAllUserData(userId)).data.customInstruments[0].symbol, 'TEST/RECOVERY');
  assert.deepEqual(await tabA.recoverPendingLocalJournal(userId), { recovered:0, pending:0, error:null });
});

test('an edit and its new reward preset are visible to another local tab', async () => {
  rows.clear();
  localValues.clear();
  writeActive = false;
  writeQueue.length = 0;
  const stamp = `${Date.now()}-${Math.random()}`;
  const tabA = await import(`./localJournalDb.js?edit-tab-a=${stamp}`);
  const tabB = await import(`./localJournalDb.js?edit-tab-b=${stamp}`);
  const userId = `edit-user-${stamp}`;
  tabA.configureLocalJournal(userId, true);
  const account = await tabA.createAccount(userId, { id:'edit-account', name:'Edit account', balance:152 });
  await tabA.createTrade(userId, account.data.id, { id:'eur-usd', asset:'EUR/USD', pnl:0, time:'09:34' });
  tabB.configureLocalJournal(userId, true);
  const keepSenderOpen = tabA.subscribeToLocalJournalChanges(userId, () => {});
  let notifications = 0;
  const unsubscribe = tabB.subscribeToLocalJournalChanges(userId, () => { notifications += 1; });

  await tabA.updateTrade('eur-usd', { pnl:10, rr:2.4, time:'09:40', closeTime:'09:40' });
  await tabA.addRewardPreset(account.data.id, 2.4);
  await new Promise(resolve => setTimeout(resolve, 0));
  const inOtherTab = await tabB.fetchAllUserData(userId);
  const trade = inOtherTab.data.accounts[0].trades.find(item => item.id === 'eur-usd');
  assert.equal(trade.pnl, 10);
  assert.equal(trade.time, '09:40');
  assert.equal(trade.closeTime, '09:40');
  assert.ok(notifications >= 2);
  keepSenderOpen();
  unsubscribe();
});

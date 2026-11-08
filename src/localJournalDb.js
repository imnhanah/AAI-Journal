import { normaliseBalance, WORKSPACE_TYPES } from './balanceModel.js';
import { accountPatch } from './accountPatch.js';

const DATABASE = 'aaicorefx-local-journal';
const STORE = 'journals';
const SNAPSHOT_DATABASE = 'aaicorefx-local-journal-snapshots';
const SNAPSHOT_STORE = 'snapshots';
const RECOVERY_PREFIX = 'aaicorefx-local-journal-recovery:';
const CHANNEL_NAME = 'aaicorefx-local-journal-v1';
let localUserId = null;
let changeChannel = null;

const id = () => globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const now = () => new Date().toISOString();
const clone = value => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const canonical = value => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
const recoveryKey = (userId, operationId) => `${RECOVERY_PREFIX}${encodeURIComponent(userId)}:${operationId}`;
function storage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}
function createRecoveryRecord(userId, base, next) {
  const target = storage();
  if (!target) return null;
  const operationId = id();
  try {
    target.setItem(recoveryKey(userId, operationId), JSON.stringify({ version:1, operationId, userId, createdAt:now(), base, next }));
    return operationId;
  } catch {
    // IndexedDB remains the source of truth. A blocked localStorage area must
    // not turn an otherwise durable journal write into a false failure.
    return null;
  }
}
function removeRecoveryRecord(userId, operationId) {
  if (!operationId) return;
  try { storage()?.removeItem(recoveryKey(userId, operationId)); } catch {}
}
function journalChannel() {
  if (changeChannel || typeof BroadcastChannel !== 'function') return changeChannel;
  try { changeChannel = new BroadcastChannel(CHANNEL_NAME); } catch { changeChannel = null; }
  return changeChannel;
}
function announceChange(userId) {
  // The UI subscriber opens the channel for each active browser tab. Do not
  // create one solely for a write: Node test workers and one-off utilities
  // would otherwise retain a live BroadcastChannel handle.
  try { changeChannel?.postMessage({ type:'journal-changed', userId, at:now() }); } catch {}
}
const routineCacheKey = userId => `tj:daily-routine:${userId}`;
function cachedRoutine(userId) { try { const value=storage()?.getItem(routineCacheKey(userId)); return value ? JSON.parse(value) : null; } catch { return null; } }
function snapshotError(error) { try { globalThis.dispatchEvent?.(new CustomEvent('aaicorefx:local-snapshot-error',{detail:{message:error?.message||'Could not save a device snapshot.'}})); } catch {} }
function openSnapshots() { return new Promise((resolve,reject)=>{ const request=indexedDB.open(SNAPSHOT_DATABASE,1); request.onupgradeneeded=()=>{ if(!request.result.objectStoreNames.contains(SNAPSHOT_STORE)) request.result.createObjectStore(SNAPSHOT_STORE,{keyPath:'id'}); }; request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error); }); }
const snapshotSize = value => new Blob([JSON.stringify(value)]).size;
async function saveSnapshot(userId,data,{kind='auto',force=false,routine=cachedRoutine(userId)}={}) {
  const database=await openSnapshots();
  try { return await new Promise((resolve,reject)=>{ const transaction=database.transaction(SNAPSHOT_STORE,'readwrite'),store=transaction.objectStore(SNAPSHOT_STORE); let outcome;
    transaction.oncomplete=()=>resolve(outcome); transaction.onerror=()=>reject(transaction.error||new Error('Could not save device snapshot.')); transaction.onabort=()=>reject(transaction.error||new Error('Device snapshot was cancelled.'));
    const request=store.getAll(); request.onerror=()=>{try{transaction.abort();}catch{}}; request.onsuccess=()=>{ const previous=(request.result||[]).filter(row=>row.userId===userId).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))); const latest=previous.find(row=>row.kind==='auto'); if(!force&&kind==='auto'&&latest&&Date.now()-Date.parse(latest.createdAt)<3600000){outcome={skipped:true};return;} const backup={version:1,exportedAt:now(),data:clone(data),routine:clone(routine)}; const record={id:`snapshot-${id()}`,userId,kind,createdAt:now(),tradeCount:(data.accounts||[]).reduce((sum,account)=>sum+(account.trades||[]).length,0),size:snapshotSize(backup),backup}; store.put(record); previous.filter(row=>row.kind===kind).slice(kind==='safety'?2:4).forEach(row=>store.delete(row.id)); outcome={data:{...record,backup:undefined}}; }; }); } finally { database.close(); }
}
export async function listLocalJournalSnapshots(userId=localUserId) { if(!userId)return {data:[]}; const database=await openSnapshots(); try { const rows=await requestValue(database.transaction(SNAPSHOT_STORE,'readonly').objectStore(SNAPSHOT_STORE).getAll()); return {data:(rows||[]).filter(row=>row.userId===userId).map(({backup,...row})=>row).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))}; } catch(error){return {error:error?.message||'Could not read device snapshots.'};} finally{database.close();} }
export async function createSafetySnapshot(userId=localUserId,routine) { try { return await saveSnapshot(userId,await dataFor(userId),{kind:'safety',force:true,routine}); } catch(error) { snapshotError(error); return {error:error?.message||'Could not save safety snapshot.'}; } }
export async function readLocalJournalSnapshot(userId,id) { const database=await openSnapshots(); try { const row=await requestValue(database.transaction(SNAPSHOT_STORE,'readonly').objectStore(SNAPSHOT_STORE).get(id)); return !row||row.userId!==userId?{error:'Snapshot not found.'}:{data:row.backup}; } catch(error){return {error:error?.message||'Could not read snapshot.'};} finally{database.close();} }

function open() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('IndexedDB is unavailable in this browser.'));
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function requestValue(request) {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
async function read(userId = localUserId) {
  if (!userId) return null;
  const database = await open();
  const result = await requestValue(database.transaction(STORE, 'readonly').objectStore(STORE).get(userId));
  database.close();
  return result || null;
}
async function write(data, userId = localUserId) {
  if (!userId) throw new Error('Local journal has no signed-in user.');
  const database = await open();
  const transaction = database.transaction(STORE, 'readwrite');
  transaction.objectStore(STORE).put({ ...clone(data), savedAt: now(), version: 1 }, userId);
  await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
  database.close();
  announceChange(userId);
}
function emptyJournal() {
  return {
    accounts: [], typeTags: [], mistakeTags: [], confluenceSessions: [], customInstruments: [],
    markups: [], reviews: [], periodReviews: [], financeReady:true, balancesReady:true,
  };
}
async function dataFor(userId = localUserId) {
  let data = await read(userId);
  // A fresh device starts empty. Do not write a synthetic journal or any
  // account data until the person explicitly creates or imports it.
  return data || emptyJournal();
}
const pendingChanges = new Map();
function change(mutator) {
  const userId = localUserId;
  if (!userId) return Promise.reject(new Error('Local journal has no signed-in user.'));
  // Keep the read and write in one IndexedDB readwrite transaction. IndexedDB
  // serializes overlapping readwrite transactions for this store, including
  // transactions started by another tab. Reading first and writing later in a
  // separate transaction can otherwise overwrite a newer full-journal copy.
  const task = (pendingChanges.get(userId) || Promise.resolve()).catch(() => {}).then(async () => {
    const database = await open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE);
      let result;
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        database.close();
        callback(value);
      };
      transaction.oncomplete = () => finish(resolve, result);
      transaction.onerror = () => finish(reject, transaction.error || new Error('Could not save the journal on this device.'));
      transaction.onabort = () => finish(reject, transaction.error || new Error('The journal save was cancelled before it finished.'));

      const request = store.get(userId);
      request.onerror = () => {
        try { transaction.abort(); } catch {}
        finish(reject, request.error || new Error('Could not read the journal on this device.'));
      };
      request.onsuccess = () => {
        try {
          // All journal mutators are deliberately synchronous. Keeping this
          // work inside the get callback prevents the transaction from going
          // inactive before its matching put is queued.
          const data = request.result || emptyJournal();
          const base = clone(data);
          result = mutator(data);
          if (result && typeof result.then === 'function') throw new Error('Local journal mutators must be synchronous.');
          const recoveryId = createRecoveryRecord(userId, base, clone(data));
          transaction.oncomplete = () => {
            removeRecoveryRecord(userId, recoveryId);
            announceChange(userId);
            void saveSnapshot(userId, data).catch(snapshotError);
            finish(resolve, result);
          };
          store.put({ ...clone(data), savedAt: now(), version: 1 }, userId);
        } catch (error) {
          try { transaction.abort(); } catch {}
          finish(reject, error);
        }
      };
    });
  });
  pendingChanges.set(userId, task);
  task.finally(() => { if (pendingChanges.get(userId) === task) pendingChanges.delete(userId); }).catch(() => {});
  return task;
}
const okay = data => ({ data });
const findAccount = (data, accountId) => data.accounts.find(item => item.id === accountId);
const findTrade = (data, tradeId) => data.accounts.flatMap(account => account.trades || []).find(item => item.id === tradeId);
const findMarkup = (data, markupId) => data.markups.find(item => item.id === markupId);
const touch = item => ({ ...item, updatedAt:now() });

export function configureLocalJournal(userId, enabled) { localUserId = enabled ? userId : null; }
export const isLocalJournal = () => !!localUserId;
export const hasPendingLocalJournalSave = (userId = localUserId) => !!pendingChanges.get(userId);
export function subscribeToLocalJournalChanges(userId, listener) {
  const channel = journalChannel();
  if (!channel) return () => {};
  const receive = event => {
    if (event.data?.type === 'journal-changed' && event.data.userId === userId) listener(event.data);
  };
  channel.addEventListener('message', receive);
  return () => channel.removeEventListener('message', receive);
}
export async function recoverPendingLocalJournal(userId = localUserId) {
  const target = storage();
  if (!target || !userId) return { recovered:0, pending:0, error:null };
  const prefix = `${RECOVERY_PREFIX}${encodeURIComponent(userId)}:`;
  const records = [];
  try {
    for (let index = 0; index < target.length; index += 1) {
      const key = target.key(index);
      if (!key?.startsWith(prefix)) continue;
      const value = JSON.parse(target.getItem(key));
      if (value?.version === 1 && value.userId === userId && value.base && value.next) records.push(value);
      else target.removeItem(key);
    }
  } catch (error) { return { recovered:0, pending:0, error:error?.message || 'Could not inspect journal recovery data.' }; }
  let recovered = 0;
  let pending = 0;
  for (const record of records.sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)))) {
    const database = await open();
    const outcome = await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE);
      let action = 'pending';
      transaction.oncomplete = () => resolve(action);
      transaction.onerror = () => reject(transaction.error || new Error('Could not recover the local journal.'));
      transaction.onabort = () => reject(transaction.error || new Error('Local journal recovery was cancelled.'));
      const request = store.get(userId);
      request.onerror = () => { try { transaction.abort(); } catch {} };
      request.onsuccess = () => {
        const current = request.result || emptyJournal();
        if (canonical(current) === canonical(record.next)) action = 'already-applied';
        else if (canonical(current) === canonical(record.base)) {
          action = 'recovered';
          store.put({ ...clone(record.next), savedAt:now(), version:1 }, userId);
        } else action = 'conflict';
      };
    }).finally(() => database.close());
    if (outcome === 'already-applied' || outcome === 'recovered') {
      removeRecoveryRecord(userId, record.operationId);
      if (outcome === 'recovered') { recovered += 1; announceChange(userId); }
    } else pending += 1;
  }
  return { recovered, pending, error:null };
}
export async function flushLocalJournal(userId = localUserId) {
  try {
    await pendingChanges.get(userId);
    return { error:null };
  } catch (error) { return { error:error?.message || 'Could not finish saving the local journal.' }; }
}
export async function hasLocalJournal(userId) { return !!(await read(userId)); }
export async function fetchAllUserData(userId) { try { return okay(await dataFor(userId)); } catch (error) { return { error:error.message || 'Could not load the journal stored on this device.' }; } }
export async function readProfileCaseStudyLibrary(userId) { const data=await dataFor(userId); return okay(data.profileCaseStudyLibrary || null); }
// Unlike readProfileCaseStudyLibrary this never creates a demo journal. It is
// used to protect an existing device copy before a Cloud Sync mode handoff.
export async function peekProfileCaseStudyLibrary(userId) { const data=await read(userId); return okay(data?.profileCaseStudyLibrary || null); }
export async function saveProfileCaseStudyLibrary(userId, library) { return change(data => { data.profileCaseStudyLibrary=clone(library); return okay(data.profileCaseStudyLibrary); }); }
export async function exportLocalJournal(userId) { await pendingChanges.get(userId); const data = await dataFor(userId); return { version:1, exportedAt:now(), data:clone(data), routine:clone(cachedRoutine(userId)) }; }
export async function importLocalJournal(userId, backup) {
  if (!backup || backup.version !== 1 || !backup.data || !Array.isArray(backup.data.accounts)) return { error:'This backup is not an AAICOREFX journal backup.' };
  await pendingChanges.get(userId);
  const data = { ...clone(backup.data), financeReady:true, balancesReady:true };
  // Backups may be restored into another login. Keep ownership scoped to the
  // signed-in user rather than trusting IDs from the exported file.
  for (const scope of ['account', 'balance']) {
    for (const row of Object.values(data.challengeProgress?.[scope] || {})) row.user_id = userId;
  }
  await write(data, userId);
  if (backup.routine !== undefined) { try { storage()?.setItem(routineCacheKey(userId),JSON.stringify(backup.routine)); } catch {} }
  return { data, routine:backup.routine ?? null };
}

const challengeColumn = scope => scope === 'balance' ? 'balance_id' : 'account_id';
function challengeOwner(data, scope, targetId) {
  return scope === 'balance'
    ? data.accounts.some(account => (account.balances || []).some(balance => balance.id === targetId))
    : data.accounts.some(account => account.id === targetId);
}
export async function readChallengeProgress(scope, targetId, userId) {
  if (userId !== localUserId) return { error: { message:'Local challenge user does not match the signed-in user.' } };
  await pendingChanges.get(userId);
  const data = await dataFor(userId);
  return { data:clone(data.challengeProgress?.[scope]?.[targetId] || null), error:null };
}
export async function saveChallengeProgress(scope, payload) {
  if (payload.user_id !== localUserId) return { error: { message:'Local challenge user does not match the signed-in user.' } };
  return change(data => {
    const targetId = payload[challengeColumn(scope)];
    if (!challengeOwner(data, scope, targetId)) return { error: { message:'Challenge account not found on this device.' } };
    data.challengeProgress ||= { account:{}, balance:{} };
    data.challengeProgress[scope] ||= {};
    data.challengeProgress[scope][targetId] = { ...clone(payload), updated_at:now() };
    return { error:null };
  });
}
export async function deleteChallengeProgress(scope, targetId, userId) {
  if (userId !== localUserId) return { error: { message:'Local challenge user does not match the signed-in user.' } };
  return change(data => { if (data.challengeProgress?.[scope]) delete data.challengeProgress[scope][targetId]; return { error:null }; });
}

export async function createAccount(userId, fields) { return change(data => { const accountId = fields.id || id(); const account = { ...fields, id:accountId, icon:fields.baseCurrency || 'USD', profileImage:'', balance:Number(fields.balance) || 0, workspaceType:fields.workspaceType || WORKSPACE_TYPES.STANDARD, trades:[], rules:[], checkins:{}, balances:[], finance:{enabled:!!fields.financeEnabled,tradingTarget:0}, savingsAccounts:[], financeMovements:[], createdAt:now(), updatedAt:now() }; data.accounts.push(account); return okay(account); }); }
export async function updateAccount(accountId, fields) { return change(data => { const account=findAccount(data,accountId); if (!account) return { error:'Account not found on this device.' }; Object.assign(account, touch(accountPatch(fields, { warn:true }))); return okay(clone(account)); }); }
export async function addRewardPreset(accountId, rewardPreset) { return change(data => { const account=findAccount(data,accountId); if (!account) return { error:'Account not found on this device.' }; const value=Number(rewardPreset); if (!(value > 0)) return okay({ account:clone(account), rewardPresets:account.rewardPresets || [] }); const rewardPresets=[...(account.rewardPresets || []).map(Number).filter(item=>Number.isFinite(item)&&item>0),value].filter((item,index,items)=>items.findIndex(other=>Math.abs(other-item)<1e-9)===index).sort((left,right)=>left-right); Object.assign(account,touch({ rewardPresets })); return okay({ account:clone(account), rewardPresets }); }); }
export async function deleteAccount(accountId) { return change(data => { data.accounts=data.accounts.filter(item=>item.id!==accountId); data.markups=data.markups.filter(item=>item.accountId!==accountId); data.reviews=data.reviews.filter(item=>item.accountId!==accountId); data.periodReviews=data.periodReviews.filter(item=>item.accountId!==accountId); return {}; }); }
export async function resetAccountData(accountId) { return change(data => { const account=findAccount(data,accountId); if (!account) return { error:'Account not found on this device.' }; account.trades=[]; account.checkins={}; return {}; }); }

export async function createWorkspaceBalance(userId, accountId, balance) { return change(data => { const account=findAccount(data,accountId); if (!account) return { error:'Account not found on this device.' }; const item=normaliseBalance({ ...balance, id:balance.id || id(), workspaceId:accountId }, account); account.balances=[...(account.balances||[]),item]; return okay(item); }); }
export async function updateWorkspaceBalance(userId, accountId, balance) { return change(data => { const account=findAccount(data,accountId); if (!account) return { error:'Account not found on this device.' }; const item=normaliseBalance({ ...balance, workspaceId:accountId }, account); account.balances=(account.balances||[]).map(current=>current.id===item.id?item:current); return okay(item); }); }
export async function deleteWorkspaceBalance(balanceId) { return change(data => { data.accounts.forEach(account => { account.balances=(account.balances||[]).filter(item=>item.id!==balanceId); account.trades=(account.trades||[]).map(trade=>({...trade,balanceResults:(trade.balanceResults||[]).filter(result=>result.balanceId!==balanceId)})); }); return {}; }); }

export async function saveFinanceSettings(userId, accountId, settings) { return change(data => { const account=findAccount(data,accountId); if (!account) return { error:'Account not found on this device.' }; account.finance={ enabled:!!settings.enabled, tradingTarget:Number(settings.tradingTarget)||0 }; return {}; }); }
export async function createSavingsAccount(userId, accountId, value) { return change(data => { const account=findAccount(data,accountId); if (!account) return { error:'Account not found on this device.' }; const item={id:id(),accountId,balanceId:value.balanceId||null,name:value.name||'Savings',target:Number(value.target)||0,allocationPct:Number(value.allocationPct)||0,interval:value.interval||'Manual',reminderMinutes:Number(value.reminderMinutes)||30,createdAt:now()}; account.savingsAccounts=[...(account.savingsAccounts||[]),item]; return okay(item); }); }
export async function updateSavingsAccount(savingsId, value) { return change(data => { for (const account of data.accounts) { const current=(account.savingsAccounts||[]).find(item=>item.id===savingsId); if (current) { Object.assign(current,{balanceId:value.balanceId||null,name:value.name||'Savings',target:Number(value.target)||0,allocationPct:Number(value.allocationPct)||0,interval:value.interval||'Manual',reminderMinutes:Number(value.reminderMinutes)||30}); return okay(current); } } return { error:'Savings account not found on this device.' }; }); }
export async function deleteSavingsAccount(savingsId) { return change(data => { data.accounts.forEach(account=>{account.savingsAccounts=(account.savingsAccounts||[]).filter(item=>item.id!==savingsId);}); return {}; }); }
export async function createFinanceMovement(userId, accountId, value) { return change(data => { const account=findAccount(data,accountId); const amount=Number(value.amount); if (!account) return { error:'Account not found on this device.' }; if (!(amount>0)) return { error:'Enter a cash-movement amount greater than zero.' }; const item={id:id(),accountId,balanceId:value.balanceId||null,type:value.type,amount,date:value.date,note:value.note||'',source:value.source||'trading',savingsAccountId:value.savingsAccountId||null,createdAt:now()}; account.financeMovements=[item,...(account.financeMovements||[])]; return okay(item); }); }
export async function updateFinanceMovement(movementId, value) { return change(data => { for (const account of data.accounts) { const current=(account.financeMovements||[]).find(item=>item.id===movementId); if (current) { Object.assign(current,{...value,id:movementId}); return okay(current); } } return {error:'Cash movement not found on this device.'}; }); }
export async function deleteFinanceMovement(movementId) { return change(data=>{data.accounts.forEach(account=>{account.financeMovements=(account.financeMovements||[]).filter(item=>item.id!==movementId);});return {};}); }

export async function createTrade(userId, accountId, value) { return change(data => { const account=findAccount(data,accountId); if (!account) return {error:'Account not found on this device.'}; const tradeId=value.id || id(); const existing=(account.trades||[]).find(item=>item.id===tradeId); const item=touch({...existing,...value,id:tradeId,accountId,createdAt:existing?.createdAt || now(),screenshots:value.screenshots ?? existing?.screenshots ?? {entry:[],exit:[]},balanceResults:value.balanceResults ?? existing?.balanceResults ?? []}); account.trades=existing ? account.trades.map(current=>current.id===tradeId?item:current) : [...(account.trades||[]),item]; return okay(item); }); }
export async function updateTrade(tradeId, value) { return change(data => { const trade=findTrade(data,tradeId); if (!trade) return {error:'Trade not found on this device.'}; Object.assign(trade,touch({...value,id:tradeId,accountId:trade.accountId})); return okay(trade); }); }
export async function deleteTrade(tradeId) { return change(data=>{data.accounts.forEach(account=>{account.trades=(account.trades||[]).filter(item=>item.id!==tradeId);});data.reviews=data.reviews.filter(item=>item.tradeId!==tradeId);return {};}); }
export async function saveTradeBalanceResults(userId, tradeId, results) { return change(data=>{const trade=findTrade(data,tradeId);if(!trade)return {error:'Trade not found on this device.'};trade.balanceResults=(results||[]).filter(item=>item?.balanceId).map(item=>({...item,id:item.id||id(),tradeId}));return okay(trade.balanceResults);}); }
export async function deleteTradeBalanceResultsNotIn(userId, tradeId, balanceIds) { return change(data=>{const trade=findTrade(data,tradeId);if(!trade)return {error:'Trade not found on this device.'};trade.balanceResults=(trade.balanceResults||[]).filter(item=>(balanceIds||[]).includes(item.balanceId));return {};}); }

export async function createRule(userId, accountId, text) { return change(data=>{const account=findAccount(data,accountId);if(!account)return {error:'Account not found on this device.'};const item={id:id(),text,active:true};account.rules=[...(account.rules||[]),item];return okay(item);}); }
export async function updateRule(ruleId, text) { return change(data=>{for(const account of data.accounts){const item=(account.rules||[]).find(rule=>rule.id===ruleId);if(item){item.text=text;return okay(item);}}return {error:'Rule not found on this device.'};}); }
export async function deleteRule(ruleId) { return change(data=>{data.accounts.forEach(account=>{account.rules=(account.rules||[]).filter(rule=>rule.id!==ruleId);Object.values(account.checkins||{}).forEach(day=>delete day[ruleId]);});return {};}); }
export async function setCheckin(userId, accountId, ruleId, date, checked) { return change(data=>{const account=findAccount(data,accountId);if(!account)return {error:'Account not found on this device.'};account.checkins={...(account.checkins||{}),[date]:{...(account.checkins?.[date]||{}),[ruleId]:!!checked}};return {};}); }
export async function saveManagedLists(userId, patch) { return change(data=>{if(patch.typeTags!==undefined)data.typeTags=patch.typeTags;if(patch.mistakeTags!==undefined)data.mistakeTags=patch.mistakeTags;if(patch.confluenceSessions!==undefined)data.confluenceSessions=patch.confluenceSessions;if(patch.instruments!==undefined)data.customInstruments=patch.instruments;return {};}); }
export async function saveTypeTags(userId,tags) { return saveManagedLists(userId,{typeTags:tags}); }

export async function createMarkup(userId, accountId, value) { return change(data=>{const existing=data.markups.find(item=>item.id===value.id);if(existing)return okay(existing);const item=touch({...value,id:value.id||id(),accountId,createdAt:now(),screenshots:value.screenshots||{}});data.markups=[item,...data.markups];return okay(item);}); }
export async function updateMarkup(markupId, value) { return change(data=>{const item=findMarkup(data,markupId);if(!item)return {error:'Markup not found on this device.'};Object.assign(item,touch({...value,id:markupId,accountId:item.accountId}));return okay(item);}); }
export async function deleteMarkup(markupId) { return change(data=>{data.markups=data.markups.filter(item=>item.id!==markupId);return {};}); }
export async function saveTradeReview(userId, accountId, value) { return change(data=>{const existing=value.id&&data.reviews.find(item=>item.id===value.id);const item=touch({...value,id:existing?.id||id(),accountId});data.reviews=existing?data.reviews.map(current=>current.id===item.id?item:current):[item,...data.reviews];return okay(item);}); }
export async function savePeriodReview(userId, accountId, value) { return change(data=>{const existing=data.periodReviews.find(item=>item.accountId===accountId&&item.type===value.type&&item.key===value.key);const item=touch({...value,id:existing?.id||id(),accountId});data.periodReviews=existing?data.periodReviews.map(current=>current.id===item.id?item:current):[item,...data.periodReviews];return okay(item);}); }
export async function hasMigratedLocalData() { return true; }
export async function markLocalDataMigrated() { return {}; }
export async function importLegacyAccount(userId, value) { const account=await createAccount(userId,value); if(account.error)return account; for(const trade of value.trades||[])await createTrade(userId,account.data.id,trade); for(const rule of value.rules||[])await createRule(userId,account.data.id,rule.text); return okay({accountId:account.data.id}); }

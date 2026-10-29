import test from 'node:test';
import assert from 'node:assert/strict';
import { createChallengeStorage } from './challengeStorage.js';
import * as local from './localJournalDb.js';

// Small asynchronous IndexedDB test double. Copies values at the database
// boundary so tests exercise the real local read/modify/write implementation.
const journals = new Map();
globalThis.indexedDB = {
  open() {
    const request = {};
    queueMicrotask(() => {
      request.result = {
        close() {},
        transaction() {
          const transaction = {
            objectStore: () => ({
              get(key) {
                const query = {};
                queueMicrotask(() => { query.result = structuredClone(journals.get(key)); query.onsuccess?.(); });
                return query;
              },
              put(value, key) {
                journals.set(key, structuredClone(value));
                queueMicrotask(() => transaction.oncomplete?.());
              },
            }),
          };
          return transaction;
        },
      };
      request.onsuccess?.();
    });
    return request;
  },
};

const payload = (scope, id, userId, activeLevel = 4) => ({
  [scope === 'balance' ? 'balance_id' : 'account_id']:id,
  user_id:userId, active_level:activeLevel, statuses:{1:'Passed',4:'In progress'},
  notes:{4:'Stay disciplined'}, automation:{mode:'risk',startedAt:'2026-10-08T12:00:00Z',levelCount:20,rewardRatio:1.35},
});
const noCloud = { from() { throw new Error('Local mode contacted Supabase'); } };
const db = createChallengeStorage({ isLocal:local.isLocalJournal, local, cloud:noCloud });

test('free challenges persist for account and balance, survive reload, and restore from backup', async () => {
  local.configureLocalJournal('free-user', true);
  const {data} = await local.fetchAllUserData('free-user');
  const account = data.accounts[0];
  for (const [scope, id] of [['account',account.id],['balance',account.balances[0].id]]) {
    assert.equal((await db.read(scope,id,'free-user')).data, null);
    assert.equal((await db.probe(scope,id)).error,null);
    assert.equal((await db.save(scope,payload(scope,id,'free-user'))).error,null);
  }
  local.configureLocalJournal(null,false);
  local.configureLocalJournal('free-user',true);
  assert.equal((await db.read('account',account.id,'free-user')).data.active_level,4);
  const backup = await local.exportLocalJournal('free-user');
  assert.equal(backup.data.challengeProgress.balance[account.balances[0].id].notes[4],'Stay disciplined');
  await db.remove('account',account.id,'free-user');
  assert.equal((await db.read('account',account.id,'free-user')).data,null);
  await local.importLocalJournal('free-user',JSON.parse(JSON.stringify(backup)));
  assert.equal((await db.read('account',account.id,'free-user')).data.automation.levelCount,20);
  assert.equal((await db.snapshot('free-user')).account[account.id].active_level,4);
});

test('concurrent trade and challenge saves do not overwrite each other',async () => {
  local.configureLocalJournal('concurrent-user',true);
  const {data} = await local.fetchAllUserData('concurrent-user');
  const account = data.accounts[0];
  await Promise.all([
    db.save('account',payload('account',account.id,'concurrent-user',5)),
    local.updateTrade(account.trades[0].id,{context:'Updated concurrently'}),
    db.save('balance',payload('balance',account.balances[0].id,'concurrent-user',6)),
  ]);
  const backup = await local.exportLocalJournal('concurrent-user');
  assert.equal(backup.data.accounts[0].trades[0].context,'Updated concurrently');
  assert.equal(backup.data.challengeProgress.account[account.id].active_level,5);
  assert.equal(backup.data.challengeProgress.balance[account.balances[0].id].active_level,6);
});

test('local challenges are user-isolated and legacy backups remain supported',async () => {
  local.configureLocalJournal('other-user',true);
  assert.ok((await db.read('account','anything','free-user')).error);
  assert.ok((await db.save('account',payload('account','anything','free-user'))).error);
  assert.ok((await db.save('account',payload('account','nonexistent','other-user'))).error);
  const backup = await local.exportLocalJournal('free-user');
  await local.importLocalJournal('other-user',backup);
  const account = backup.data.accounts[0];
  assert.equal((await db.read('account',account.id,'other-user')).data.user_id,'other-user');
  delete backup.data.challengeProgress;
  assert.ok((await local.importLocalJournal('other-user',backup)).data);
  assert.equal((await db.read('account',account.id,'other-user')).data,null);
});

test('cloud mode retains user-scoped cloud operations',async () => {
  const calls=[];
  const chain={};
  for (const method of ['select','eq','upsert','delete','limit']) chain[method]=(...args)=>{calls.push([method,...args]);return chain;};
  chain.maybeSingle=async()=>({data:null,error:null});
  const cloud={from:table=>{calls.push(['from',table]);return chain;}};
  const storage=createChallengeStorage({isLocal:()=>false,local:{},cloud});
  await storage.read('balance','balance-id','owner');
  assert.deepEqual(calls,[['from','balance_challenge_progress'],['select','*'],['eq','balance_id','balance-id'],['eq','user_id','owner']]);
  calls.length=0;
  storage.save('account',payload('account','account-id','owner'));
  assert.equal(calls[0][1],'challenge_progress');
  assert.deepEqual(calls[1][2],{onConflict:'account_id'});
  calls.length=0;
  storage.remove('account','account-id','owner');
  assert.deepEqual(calls.slice(-2),[['eq','account_id','account-id'],['eq','user_id','owner']]);
});

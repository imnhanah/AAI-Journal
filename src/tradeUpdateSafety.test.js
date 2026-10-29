import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applySessionRepairs,accountRemovalSnapshotMatches,tradeUpdateFailure} from './tradeUpdateSafety.js';
const before={id:'a',workspaceType:'multi_balance',balances:[{id:'b1'},{id:'b2'}],trades:[{id:'t',updatedAt:'v1',balanceResults:[{id:'r',balanceId:'b1',netPnl:10}]}],financeMovements:[]};
test('successful session repairs retain returned revision and existing balance results',()=>{
  const result=applySessionRepairs([before],[{repair:{accountId:'a',trade:before.trades[0]},result:{data:{id:'t',updatedAt:'v2',session:'London'}}}]);
  assert.equal(result[0].trades[0].updatedAt,'v2');
  assert.deepEqual(result[0].trades[0].balanceResults,before.trades[0].balanceResults);
  assert.equal(before.trades[0].updatedAt,'v1');
});
test('failed repairs and concurrent newer local changes are never overwritten',()=>{
  const fresh={...before,trades:[{...before.trades[0],updatedAt:'v3'}]};
  const repair={accountId:'a',trade:before.trades[0]};
  assert.equal(applySessionRepairs([fresh],[{repair,result:{data:{id:'t',updatedAt:'v2'}}}])[0].trades[0].updatedAt,'v3');
  assert.equal(applySessionRepairs([before],[{repair,result:{error:'offline'}}])[0].trades[0].updatedAt,'v1');
});
test('removal preflight detects changed, deleted and newly added trades and accounts',()=>{
  assert.equal(accountRemovalSnapshotMatches(before,structuredClone(before)),true);
  for(const fresh of [null,{...before,balances:[{id:'b1'}]},{...before,trades:[]},{...before,trades:[{...before.trades[0],updatedAt:'v2'}]},{...before,trades:[...before.trades,{id:'new'}]},{...before,trades:[{...before.trades[0],balanceResults:[]}]}])assert.equal(accountRemovalSnapshotMatches(before,fresh),false);
});
test('zero-row conflicts give recovery instructions without disabling the revision guard',()=>{
  assert.equal(tradeUpdateFailure({code:'PGRST116',details:'The result contains 0 rows'},()=>{throw Error('unexpected fallback');}).conflict,true);
  assert.deepEqual(tradeUpdateFailure({code:'42501'},error=>({error:error.code})),{error:'42501'});
  const db=readFileSync(new URL('./db.js',import.meta.url),'utf8');
  assert.ok(db.includes('query.eq("updated_at",x.updatedAt)'));
  const source=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  const start=source.indexOf('const handleSaveAccountSettings');
  assert.ok(source.indexOf('accountRemovalSnapshotMatches(account, freshAccount)',start)<source.indexOf('await updateAccount(updated.id, updated)',start));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scopeBacktests,backtestProfileKey,assertBacktestWorkspace} from './backtestWorkspace.js';
import {createPrivateCache} from './privateCache.js';

test('strategy tests are profile-scoped across workspace switches',()=>{
  const data={runs:[{id:'a',workspaceId:'demo'},{id:'b',workspaceId:'live'},{id:'old'}],trades:[{id:'1',runId:'a'},{id:'2',runId:'b'},{id:'3',runId:'old'}]};
  assert.deepEqual(scopeBacktests(data),data);
  assert.doesNotThrow(()=>assertBacktestWorkspace({workspaceId:'demo'},'live'));
});
test('profile cache is shared only by the same authenticated user',async()=>{
  const rows=new Map(),cache=createPrivateCache({read:key=>rows.get(key),write:(key,value)=>rows.set(key,value),evict:()=>{},clear:()=>rows.clear()});
  await cache.activate('user');
  const profile=backtestProfileKey('user');
  await cache.get(profile,async()=>({runs:[{id:'existing'}],trades:[]}));
  assert.equal(await cache.read(backtestProfileKey('other-user')),undefined);
  assert.notEqual(profile,backtestProfileKey('other-user'));
});
test('workspace switching no longer remounts or filters the profile test library',()=>{
  const journal=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  const line=journal.split('\n').find(line=>line.includes('<BacktestAccounts'));
  assert.match(line,/key=\{user.id\}/);
  assert.doesNotMatch(line,/workspaceId=/);
  const source=readFileSync(new URL('./BacktestAccounts.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(source,/workspaceId/);
  assert.match(source,/profileScope='profile'/);
  assert.doesNotMatch(journal,/findDemoWorkspaceId/);
  assert.match(journal,/readBacktestTrades\(user\.id,accounts\)/);
});

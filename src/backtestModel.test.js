import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {backtestStats,mergeBacktestDelta,protectTestTrade,orderTestTrades,legacyTestId,testType,testTypeLabel} from './backtestModel.js';
import {createPrivateCache} from './privateCache.js';
const run={id:'a',instrument:'EUR/USD',startingBalance:10000,tradeTarget:20};
const trade=(id,pnl,rr=null)=>({id,pnl,rr,date:'2026-10-07',time:`0${id}:00`,asset:'EUR/USD'});
test('test type defaults existing runs to backtest and labels forward tests',()=>{
 assert.equal(testType({}), 'backtest');assert.equal(testTypeLabel({}), 'Backtest');
 assert.equal(testType({testType:'forward'}), 'forward');assert.equal(testTypeLabel({testType:'forward'}), 'Forward Test');
});
test('simulation balance, outcomes, expectancy, drawdown and streak match closed trades only',()=>{
 const input=[trade('1',65),trade('2',-10),trade('3',51),trade('4',-20),trade('5',50),{...trade('6',999),context:'[aaicorefx-running-trade]'}];
 const s=backtestStats(run,input);
 assert.equal(s.balance,10136);assert.equal(s.total,5);assert.equal(s.wins,3);assert.equal(s.losses,2);assert.equal(s.winRate,60);assert.equal(s.drawdown,20);assert.equal(s.expectancy,27.2);assert.equal(s.averageR,null);assert.equal(s.streak,1);assert.equal(s.streakType,'win');assert.equal(s.bestDay[1],136);assert.deepEqual(input[0],trade('1',65));
 assert.equal(s.equity[0].balance,10000);assert.equal(s.equity.at(-1).balance,10136);assert.equal(s.profitFactor,166/30);
});
test('missing R:R is distinct from a recorded zero; empty and completed runs are correct',()=>{
 assert.equal(backtestStats(run,[]).winRate,null);assert.equal(backtestStats(run,[]).balance,10000);
 assert.equal(backtestStats({...run,tradeTarget:2},[trade('1',0,0),trade('2',20,2)]).averageR,1);
 assert.equal(backtestStats({...run,tradeTarget:1},[trade('1',20)]).status,'Completed');
 assert.equal(backtestStats(run,[trade('1',-1),trade('2',-2),trade('3',2)]).streak,1);
});
test('unfinished and malformed test records do not become closed trades or corrupt equity',()=>{
 const s=backtestStats(run,[null,{id:'missing'},{id:'invalid',pnl:'invalid'},{id:'empty',pnl:''},{id:'open',pnl:null},trade('1','25')]);
 assert.equal(s.total,1);assert.equal(s.net,25);assert.equal(s.balance,10025);
});
test('stable ID tie breaker and full delta retain more than 1000 records and remove deletions',()=>{
 const trades=Array.from({length:1201},(_,i)=>({...trade(String(i),1),updatedAt:'v1'}));
 const next=mergeBacktestDelta({runs:[],trades},{runVersions:[],tradeVersions:trades.map(({id,updatedAt})=>({id,updatedAt})),trades:[],runs:[]});
 assert.equal(next.trades.length,1201);assert.equal(backtestStats(run,next.trades).balance,11201);
 const changed={...trades[0],updatedAt:'v2',pnl:2};
 const updated=mergeBacktestDelta(next,{runVersions:[],runs:[],tradeVersions:[{id:changed.id,updatedAt:'v2'}],trades:[changed]});
 assert.equal(updated.trades.length,1);assert.equal(updated.trades[0].pnl,2);
 assert.deepEqual(orderTestTrades([{id:'z',date:'2020-01-01'},{id:'a',date:'2020-01-01'}]).map(t=>t.id),['a','z']);
});
test('incomplete backtest deltas cannot silently erase or shorten cached history',()=>{
 assert.throws(()=>mergeBacktestDelta({runs:[],trades:[]},{}),/Incomplete/);
 assert.throws(()=>mergeBacktestDelta({runs:[],trades:[{id:'a',updatedAt:'v1'}]},{runs:[],trades:[],runVersions:[],tradeVersions:[{id:'a',updatedAt:'v2'}]}),/Incomplete/);
});
test('instrument isolation and text-only edits preserve unloaded screenshots',()=>{
 assert.throws(()=>protectTestTrade(run,{asset:'XAU/USD'}),/limited/);
 const thin=protectTestTrade(run,{...trade('1',3),screenshots:{entry:[]}});
 assert.equal(thin.screenshots,undefined);assert.equal(thin.metadata.screenshots,undefined);
 const full=protectTestTrade(run,{...trade('1',3),screenshots:{entry:['data:image/png;base64,abc']},_mediaLoaded:true,mediaEdited:true});
 assert.equal(full.screenshots.entry.length,1);assert.equal(full.metadata._mediaLoaded,undefined);
 assert.equal(protectTestTrade(run,{...trade('1',3),screenshots:{entry:['bytes']},_mediaLoaded:true}).screenshots,undefined);
 assert.throws(()=>protectTestTrade(run,{...trade('1',3),updatedAt:'v1',mediaEdited:true,screenshots:{entry:[]}}),/Open screenshots/);
});
test('private backtest cache reuses matching versions, isolates records and users and clears on logout',async()=>{
 const records=new Map();const cache=createPrivateCache({read:k=>records.get(k),write:(k,v,valid)=>{if(valid())records.set(k,v);},evict:(u,p)=>{for(const k of records.keys())if(k.includes(u)&&p(k))records.delete(k);},clear:u=>{for(const k of records.keys())if(k.includes(u))records.delete(k);}});
 await cache.activate('alice');let calls=0;const fetch=async()=>{calls++;return {entry:['image']};};
 const key='journal:alice:backtest:media:trade1:v1';await cache.get(key,fetch);await cache.get(key,fetch);assert.equal(calls,1);
 await cache.get('journal:alice:backtest:media:trade1:v2',fetch);await cache.get('journal:alice:backtest:media:trade2:v1',fetch);assert.equal(calls,3);
 await assert.rejects(cache.get('journal:alice:backtest:media:failed:v1',async()=>{throw Error('failed');}));assert.equal(records.has('journal:alice:backtest:media:failed:v1'),false);
 await cache.activate('bob');assert.equal(records.size,0);await cache.activate(null);await assert.rejects(cache.get(key,fetch));
});
test('legacy import IDs are stable and isolated by owner and entity',async()=>{
 const id=await legacyTestId('u','run','EUR/USD');assert.equal(id,await legacyTestId('u','run','EUR/USD'));assert.notEqual(id,await legacyTestId('v','run','EUR/USD'));assert.notEqual(id,await legacyTestId('u','trade','EUR/USD'));assert.match(id,/^[0-9a-f-]{36}$/);
});
test('cloud contract uses RLS, thin deltas, lazy versioned media and no live tables',()=>{
 const sql=readFileSync(new URL('../supabase/backtest_accounts.sql',import.meta.url),'utf8');
 assert.match(sql,/enable row level security/g);assert.match(sql,/security invoker/);assert.match(sql,/user_id=auth.uid\(\)/);assert.match(sql,/screenshots=coalesce\(media,backtest_trades.screenshots\)/);assert.match(sql,/updated_at=media_version/);assert.doesNotMatch(sql,/security definer|service_role|public\.trades|limit 1000/i);
 const cloud=readFileSync(new URL('./backtestCloud.js',import.meta.url),'utf8');assert.match(cloud,/mergeBacktestDelta/);assert.match(cloud,/media:\$\{trade.id\}:\$\{trade.updatedAt\}/);assert.doesNotMatch(cloud,/select\(['"]\*/);
});

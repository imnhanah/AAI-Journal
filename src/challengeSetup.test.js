import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyChallenge,buildChallengePlan,challengeSetupFits,snapChallengeReward,challengeRewardRange,defaultChallengeReward,challengeFitRange} from './challengeModel.js';
import {resetAutomation,replayChallenge} from './challengeAutomation.js';
const now=new Date(2026,8,14,10,0);
const account={id:'a',challengeEnabled:true,challengeStartingBalance:20};
const row=(id,grossPnl)=>({id,grossPnl,pnl:0,createdAt:new Date(2026,8,14,11,Number(id)).toISOString(),closeDate:'2026-09-14',closeTime:`11:${String(id).padStart(2,'0')}`});
const adaptive=(rule,level=1)=>{
  const base={...emptyChallenge(),automation:{rewardRatio:3,adaptiveRiskPct:10,adaptiveDrawdownPct:50,adaptiveStepBack:rule}};
  return {...resetAutomation(base,[],'adaptive',1,now,10,100),testStartLevel:level};
};
const run=(base,trades)=>{
  // Earn the desired Adaptive rung with actual funded closes; a manually
  // selected Level 3 at only its Level 1 balance is no longer valid.
  const earned=base.automation?.mode==='adaptive' && base.testStartLevel===3 ? [
    {...row(0,30),id:'earned-1',pnl:30,createdAt:'2026-09-14T10:01:00Z'},
    {...row(0,39),id:'earned-2',pnl:39,createdAt:'2026-09-14T10:02:00Z'},
  ] : [];
  return replayChallenge(base,{...account,balance:100,trades:[...earned,...trades]});
};
test('defaults are 1.5R for Mode 1 and 2.8R for Mode 2',()=>{
  assert.equal(defaultChallengeReward('risk'),1.5);
  assert.equal(defaultChallengeReward('streak'),2.8);
  assert.equal(buildChallengePlan(20,'risk')[0].profit,6.75);
  assert.equal(buildChallengePlan(20,'streak')[0].profit,12.6);
});
test('R ranges snap to the nearest allowed value',()=>{
  assert.deepEqual(challengeRewardRange('risk'),[1.5,2]);
  assert.deepEqual(challengeRewardRange('streak'),[2.8,5]);
  assert.equal(snapChallengeReward('risk',1.2),1.5);
  assert.equal(snapChallengeReward('risk',3),2);
  assert.equal(snapChallengeReward('streak',2.9),2.9);
  assert.equal(snapChallengeReward('streak',9),5);
  assert.equal(snapChallengeReward('adaptive',0.5),1);
  assert.equal(snapChallengeReward('adaptive',6.5),6.5);
});
test('compatible setups list every fitting mode',()=>{
  const small=challengeSetupFits({balance:52.12}).map(f=>f.mode);
  assert.ok(small.includes('risk')&&small.includes('streak')&&small.includes('adaptive'));
  const big=challengeSetupFits({balance:10619});
  assert.deepEqual([...new Set(big.map(f=>f.mode))],['adaptive']);
  assert.equal(challengeFitRange({mode:'risk',balance:10619,levelCount:30}),null);
});
test('Adaptive One loss steps back on any loss above Level 1',()=>{
  const base=adaptive('one',3);
  assert.equal(run(base,[row(1,-1)]).activeLevel,2);
});
test('Adaptive Two losses steps back only on the second loss; a win does not reset it',()=>{
  const base=adaptive('two',3);
  const first=run(base,[row(1,-1)]);
  assert.equal(first.activeLevel,3);assert.equal(first.lossStreak,1);
  assert.equal(run(base,[row(1,-1),row(2,0.5)]).activeLevel,3);
  const start=run(base,[]).activeLevel;
  assert.equal(run(base,[row(1,-1),row(2,0.5),row(3,-1)]).activeLevel,start-1);
  assert.equal(run(base,[row(1,-1),row(2,0.5)]).activeLevel,start);
});
test('Adaptive Net loss steps back when the level net loss reaches its risk',()=>{
  const base=adaptive('net',3);
  assert.equal(run(base,[row(1,-0.5)]).activeLevel,3);
  assert.equal(run(base,[row(1,-100)]).activeLevel,2);
});
test('Mode 2 counts two losses on the same level; breakevens and small wins do not reset the count',()=>{
  const base=resetAutomation(emptyChallenge(),[],'streak',3,now,10,100);
  assert.equal(run(base,[row(1,-1),row(2,0),row(3,0.5)]).lossStreak,1);
  const start=run(base,[]).activeLevel;
  assert.equal(run(base,[row(1,-1),row(2,0.5),row(3,-1)]).activeLevel,start-1);
  assert.equal(run(base,[row(1,-1),row(2,0.5)]).activeLevel,start);
});
import {challengeMoney} from './challengeLifecycle.js';
test('total deposited = starting balance + deposits after activation; net profit = balance minus total deposited',()=>{
  const state={automation:{startedAt:'2026-10-06T09:00:00Z',startingBalance:100}};
  const acct={id:'a',balance:100,challengeEnabled:true,trades:[{id:'t',accountId:'a',grossPnl:20,pnl:20,date:'2026-10-06',createdAt:'2026-10-06T10:00:00Z'}],
    financeMovements:[{id:'d1',type:'deposit',source:'trading',amount:50,date:'2026-10-06',createdAt:'2026-10-06T12:00:00Z'},{id:'d0',type:'deposit',source:'trading',amount:30,date:'2026-10-01',createdAt:'2026-10-01T12:00:00Z'}]};
  const money=challengeMoney(state,acct);
  assert.equal(money.depositsAfterStart,50);
  assert.equal(money.totalDeposited,150);
  assert.equal(money.netProfit,money.liveBalance-150);
});

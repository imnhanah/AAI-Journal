import test from 'node:test';
import assert from 'node:assert/strict';
import {resetAutomation,replayChallenge} from './challengeAutomation.js';
import {emptyChallenge,CHALLENGE_PLAN,changeChallengeStatus} from './challengeModel.js';
import {fundedChallengeLevel} from './challengeLifecycle.js';
const now=new Date(2026,8,14,10,0);
const account={id:'a',challengeEnabled:true,challengeStartingBalance:20};
// These tests isolate gross-based progression; lifecycle tests cover net balance.
const row=(id,grossPnl,extra={})=>({id,grossPnl,pnl:0,createdAt:new Date(2026,8,14,11,Number(id)).toISOString(),closeDate:'2026-09-14',closeTime:`11:${String(id).padStart(2,'0')}`,...extra});
const start=(mode,level=1,old=[])=>resetAutomation(emptyChallenge(),old,mode,level,now);
const replay=(base,trades,patch={})=>replayChallenge(base,{...account,trades,...patch});
test('withdrawals and trading transfers fall back to the funded level without changing trade profit',()=>{
  for (const type of ['withdrawal','transfer']) {
    const trades=[row(1,2,{pnl:2})];
    const movement={type,source:'trading',amount:1,createdAt:new Date(2026,8,14,12).toISOString()};
    const state=replay(start('risk',4),trades,{financeMovements:[movement]});
    assert.equal(state.activeLevel,fundedChallengeLevel(CHALLENGE_PLAN,21));
    assert.equal(state.liveBalance,21);
    assert.equal(state.levelPnl,0);
    assert.equal(trades[0].pnl,2);
    assert.equal(state.statuses[4],'Step back');
    assert.match(state.notes[4],type === 'withdrawal' ? /withdrawal/ : /transfer out/);
    assert.equal(replay(start('risk',4),trades).activeLevel,4);
  }
});
test('a new challenge captures the live account balance at its checkpoint',()=>{
  const historical=row(1,80,{pnl:80,createdAt:new Date(2026,8,14,9,0).toISOString()});
  const baseline=resetAutomation(emptyChallenge(),[historical],'risk',1,now,30,100);
  const state=replayChallenge(baseline,{...account,balance:20,trades:[historical]});
  assert.equal(baseline.automation.startingBalance,100);
  assert.equal(state.liveBalance,100);
  assert.equal(state.counted,0);
});
test('Adaptive Balance stays at Level 1 after a loss and fails only at its configured drawdown floor',()=>{
  const baseline=resetAutomation({...emptyChallenge(),automation:{rewardRatio:3,adaptiveRiskPct:2,adaptiveDrawdownPct:10}},[],'adaptive',1,now,10,100);
  const safeLoss=row(1,-2,{pnl:-2});
  const safe=replayChallenge(baseline,{...account,balance:100,trades:[safeLoss]});
  assert.equal(safe.activeLevel,1);
  assert.equal(safe.failed,false);
  const failedLoss=row(1,-11,{pnl:-11});
  const failed=replayChallenge(baseline,{...account,balance:100,trades:[failedLoss]});
  assert.equal(failed.failed,true);
});
test('the active level reconciles to the current live balance when a loss does not trigger a streak step-back',()=>{
  const loss=row(1,-1,{pnl:-9});
  const baseline=resetAutomation(emptyChallenge(),[],'streak',1,now,30,55.99);
  const state=replayChallenge(baseline,{...account,balance:55.99,trades:[loss]});
  // In the Mode 2 ladder, $46.99 is above level 2's start ($33.95) but
  // below level 3's start ($52.55), so it belongs at level 2.
  assert.equal(state.liveBalance,46.99);
  assert.equal(state.activeLevel,2);
  assert.equal(state.statuses[1],'Jumped');
  assert.equal(state.statuses[2],'In progress');
  assert.equal(state.statuses[3],'Step back');
});
test('a risk-limit step-back is never re-promoted by the remaining funded balance',()=>{
  const baseline=resetAutomation(emptyChallenge(),[],'risk',1,now,30,100);
  // $100 starts on level 7. The gross loss fails that rung, while the small
  // net loss leaves enough capital to fund it; replay must retain level 6.
  const state=replayChallenge(baseline,{...account,balance:100,trades:[row(1,-30,{pnl:-0.01})]});
  assert.equal(state.liveBalance,99.99);
  assert.equal(state.activeLevel,6);
  assert.equal(state.statuses[7],'Step back');
  assert.equal(state.statuses[6],'In progress');
  assert.equal(state.fundingJumps[7],undefined);
});
test('cash out within current funding preserves progress; savings-funded transfers do not reduce trading capital',()=>{
  const when=new Date(2026,8,14,12).toISOString();
  assert.equal(replay(start('risk'),[row(1,2,{pnl:2})],{financeMovements:[{type:'withdrawal',source:'trading',amount:1,createdAt:when}]}).levelPnl,2);
  assert.equal(replay(start('risk',4),[],{financeMovements:[{type:'transfer',source:'savings',amount:100,createdAt:when}]}).activeLevel,4);
});
test('activity counts repeated downward moves even after a level is revisited',()=>{
  const base=start('risk',4);
  const trades=[row(1,-10),row(2,14),row(3,-10)];
  const state=replay(base,trades);
  assert.equal(state.stepBacks,2);
  assert.equal(state.activeLevel,3);
  assert.equal(replay(base,trades.slice(0,2)).stepBacks,1);
  assert.equal(replay(base,[...trades.slice(0,2),{...trades[2],grossPnl:0}]).stepBacks,1);
  assert.equal(replay(base,[]).stepBacks,0);
});
test('activity excludes level-one boundary, deposits and foreign trades from step-backs',()=>{
  assert.equal(replay(start('risk'),[row(1,-10)]).stepBacks,0);
  assert.equal(replay(start('risk',4),[row(1,-10,{accountId:'b'})]).stepBacks,0);
  const state=replay(start('risk',4),[],{financeMovements:[{type:'deposit',amount:100,createdAt:new Date(2026,8,14,12).toISOString()}]});
  assert.equal(state.stepBacks,0);
});
test('manual step-backs retain their count after their status is replaced',()=>{
  let state=changeChallengeStatus(emptyChallenge(),4,'Step back');
  state=changeChallengeStatus(state,4,'Pass');
  state=changeChallengeStatus(state,4,'Step back');
  assert.equal(replay(state,[]).stepBacks,2);
  assert.equal(replay(changeChallengeStatus(state,4,'Step back'),[]).stepBacks,2);
});
test('manual and disabled accounts never move',()=>{
  assert.equal(replay(start(null),[row(1,100)]).activeLevel,1);
  assert.equal(replay(start('risk'),[row(1,100)],{challengeEnabled:false}).activeLevel,1);
});
test('gross profits accumulate, ignore costs, and excess advances one level only',()=>{
  const state=replay(start('risk'),[row(1,2),row(2,4)]);
  assert.equal(state.activeLevel,2);assert.equal(state.levelPnl,0);
  assert.equal(replay(start('risk'),[row(1,100000)]).activeLevel,2);
});
test('Mode 1 accumulates signed gross P&L until risk threshold',()=>{
  const state=replay(start('risk',4),[row(1,-4),row(2,-6)]);
  assert.equal(state.activeLevel,3);assert.equal(state.levelPnl,0);
  assert.equal(replay(start('risk',4),[row(1,-4),row(2,2),row(3,-6)]).activeLevel,4);
});
test('Mode 2 steps back on any two losses, including tiny ones',()=>{
  const state=replay(start('streak',4),[row(1,-.01),row(2,-.01)]);
  assert.equal(state.activeLevel,3);assert.equal(state.lossStreak,0);
  assert.equal(replay(start('streak',4),[row(1,-100)]).activeLevel,4);
});
test('Mode 2 uses the 3.1R target while retaining its two-loss step-back rule',()=>{
  assert.equal(replay(start('streak'),[row(1,6)]).activeLevel,1);
  assert.equal(replay(start('streak'),[row(1,13.95)]).activeLevel,2);
});
test('breakeven preserves streak; a win resets it',()=>{
  assert.equal(replay(start('streak',4),[row(1,-1),row(2,0),row(3,-1)]).activeLevel,3);
  const state=replay(start('streak',4),[row(1,-1),row(2,.1),row(3,-1)]);
  assert.equal(state.activeLevel,4);assert.equal(state.lossStreak,1);
});
test('manual checkpoint freezes prior progress and resets counters',()=>{
  const trades=[row(1,-1)];
  const state=replay(start('streak',4),trades);
  const base=resetAutomation(state,trades,'streak',5,new Date(2026,8,14,12));
  const result=replay(base,[...trades,row(2,-1,{createdAt:new Date(2026,8,14,13).toISOString(),closeTime:'13:00'})]);
  assert.equal(result.activeLevel,5);assert.equal(result.lossStreak,1);
  assert.equal(result.counted,1);
});
test('mode changes start fresh and preserve manually selected level',()=>{
  const base=resetAutomation({...emptyChallenge(),activeLevel:5},[row(1,200)],'risk',5,now);
  assert.equal(replay(base,[row(1,200),row(2,18)]).activeLevel,6);
});
test('pre-checkpoint and foreign-account trades do not count; close timing is optional',()=>{
  const result=replay(start('risk'),[row(2,100,{createdAt:new Date(2026,8,14,9,59).toISOString()}),row(3,100,{accountId:'b'})]);
  assert.equal(result.counted,0);
  assert.equal(replay(start('risk'),[row(1,6,{closeDate:'',closeTime:''})]).activeLevel,2);
  assert.equal(replay(start('risk'),[row(4,6,{closeTime:''})]).activeLevel,2);
});
test('gross edits and deletions replay; close date and time changes have no effect',()=>{
  const base=start('risk');const trade=row(1,6);
  assert.equal(replay(base,[trade]).activeLevel,2);
  assert.equal(replay(base,[{...trade,grossPnl:1}]).activeLevel,1);
  assert.equal(replay(base,[]).activeLevel,1);
  assert.equal(replay(base,[{...trade,closeDate:'',closeTime:''}]).activeLevel,2);
  assert.deepEqual(replay(base,[trade]),replay(base,[{...trade,closeDate:'2030-01-01',closeTime:'00:00'}]));
  assert.deepEqual(replay(base,[trade]),replay(base,[trade]));
});
test('bounds stop at level one and complete after level thirty',()=>{
  assert.equal(replay(start('risk'),[row(1,-10)]).activeLevel,1);
  const state=replay(start('risk',30),[row(1,CHALLENGE_PLAN[29].profit),row(2,-100000)]);
  assert.equal(state.activeLevel,31);
});
test('chronological replay is stable regardless of input order',()=>{
  const trades=[row(1,-.1),row(2,.1),row(3,-.1)];
  assert.deepEqual(replay(start('streak',4),trades),replay(start('streak',4),[...trades].reverse()));
});
test('reset excludes all existing trades, including those without close timing',()=>{
  const old=row(1,100,{closeDate:'',closeTime:''});
  const base=start('risk',1,[old]);
  assert.deepEqual(base.automation.excludedIds,[1]);
  assert.equal(replay(base,[old,row(2,6,{closeDate:'',closeTime:''})]).activeLevel,2);
  assert.equal(replay(base,[old]).counted,0);
});
test('entry dates in the past do not exclude newly logged trades',()=>{
  assert.equal(replay(start('risk'),[row(1,6,{date:'2020-01-01',time:'00:00',closeDate:''})]).activeLevel,2);
});
test('a trade imported after automation starts is explicitly included in challenge replay',()=>{
  const imported=row(99,-1,{id:'imported',createdAt:new Date(2026,8,14,9,0).toISOString()});
  const base={...start('streak',2),automation:{...start('streak',2).automation,includedIds:['imported']}};
  const state=replay(base,[imported]);
  assert.equal(state.counted,1);
  assert.equal(state.lossStreak,1);
});
test('running trades never count toward automated challenge progress',()=>{
  const running=row(99,0,{context:'[aaicorefx-running-trade]'});
  const state=replay(start('risk'),[running]);
  assert.equal(state.counted,0);
  assert.equal(state.levelPnl,0);
  assert.equal(state.activeLevel,1);
});

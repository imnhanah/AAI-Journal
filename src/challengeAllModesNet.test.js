import test from 'node:test';
import assert from 'node:assert/strict';
import {replayChallenge,resetAutomation,challengeTradePasses,challengeProfitTarget} from './challengeAutomation.js';
import {emptyChallenge,buildChallengePlan} from './challengeModel.js';
import {scopeChallengeAccount} from './challengeLifecycle.js';
const at=new Date('2026-11-20T10:00:00Z');
const trade=(id,grossPnl,pnl=grossPnl,extra={})=>({id:String(id),grossPnl,pnl,commission:Math.max(0,grossPnl-pnl),swap:0,status:'closed',createdAt:`2026-11-20T11:${String(id).padStart(2,'0')}:00Z`,...extra});
function fixture(mode,{start,rule='one'}={}){
 start??=mode==='adaptive'?100:25;
 const ratio=mode==='streak'?3.1:mode==='adaptive'?3:1.5;
 const base=resetAutomation({...emptyChallenge(),automation:{rewardRatio:ratio,adaptiveRiskPct:10,adaptiveDrawdownPct:50,adaptiveStepBack:rule}},[],mode,1,at,30,start);
 const account={id:'a',balance:start,challengeEnabled:true,trades:[]};
 const plan=buildChallengePlan(start,mode,30,ratio,base.automation);
 return{base,account,plan,run:trades=>replayChallenge(base,{...account,trades})};
}
for(const mode of ['risk','streak','adaptive']){
 test(`${mode}: gross target minus one cent costs cannot pass despite surplus balance`,()=>{
  const f=fixture(mode);const target=challengeProfitTarget(f.plan[0],mode,f.account.balance);
  const state=f.run([trade(1,target,target-.01)]);
  assert.ok(state.liveBalance>=f.plan[0].end-.01);
  assert.equal(state.activeLevel,1);assert.notEqual(state.statuses[1],'Pass');assert.equal(state.levelPnl,Math.round((target-.01)*100)/100);
 });
 test(`${mode}: net profit at exactly target after commission and swap passes`,()=>{
  const f=fixture(mode);const target=challengeProfitTarget(f.plan[0],mode,f.account.balance);
  const row=trade(1,target+1,target,{commission:.6,swap:.4});
  const state=f.run([row]);assert.equal(state.activeLevel,2);assert.equal(state.statuses[1],'Pass');
 });
 test(`${mode}: positive gross turning negative after costs never passes`,()=>{
  const f=fixture(mode);const state=f.run([trade(1,100,-.01,{commission:100,swap:.01})]);
  assert.notEqual(state.statuses[1],'Pass');assert.equal(state.activeLevel,1);
 });
 test(`${mode}: changing gross alone cannot change progress when recorded net is identical`,()=>{
  const f=fixture(mode);const target=challengeProfitTarget(f.plan[0],mode,f.account.balance);
  assert.deepEqual(f.run([trade(1,target+10,target)]),f.run([trade(1,target+1,target)]));
 });
}
test('Mode 2 counts two net losses even if each trade has positive gross P&L',()=>{
 const f=fixture('streak',{start:55.99});
 const rows=[trade(1,.01,-.01,{commission:.02}),trade(2,.02,-.01,{commission:.02,swap:.01})];
 const one=f.run(rows.slice(0,1)),two=f.run(rows);assert.equal(one.activeLevel,3);assert.equal(one.lossStreak,1);assert.equal(two.activeLevel,2);assert.equal(two.lossStreak,0);assert.equal(two.stepBacks,1);
});
test('Mode 2 net breakevens and net profits do not count as losses, regardless of gross',()=>{
 const f=fixture('streak',{start:55.99});
 const state=f.run([trade(1,.01,-.01),trade(2,-1,0),trade(3,-1,.01)]);
 assert.equal(state.activeLevel,3);assert.equal(state.lossStreak,1);
});
test('Mode 2 retains one loss through a small net win, then steps back on the next net loss',()=>{
 const f=fixture('streak',{start:55.99});
 const state=f.run([trade(1,.01,-.01),trade(2,1,.01),trade(3,.01,-.01)]);
 assert.equal(state.activeLevel,2);assert.equal(state.stepBacks,1);
});
function adaptiveAtThree(rule,tail){
 const f=fixture('adaptive',{rule});
 return f.run([trade(1,35,35),trade(2,45,45),...tail]);
}
test('Adaptive One loss uses net results after costs',()=>{
 const state=adaptiveAtThree('one',[trade(3,1,-.01)]);assert.equal(state.activeLevel,2);assert.equal(state.stepBacks,1);
});
test('Adaptive Two losses uses net and preserves first count through net breakeven',()=>{
 const first=adaptiveAtThree('two',[trade(3,.01,-.01)]);assert.equal(first.activeLevel,3);assert.equal(first.lossStreak,1);
 const second=adaptiveAtThree('two',[trade(3,.01,-.01),trade(4,10,0),trade(5,.01,-.01)]);assert.equal(second.activeLevel,2);assert.equal(second.stepBacks,1);
});
test('Adaptive Net loss accumulates net results, including costs, against current risk',()=>{
 // Level 3 begins at $180. A $10 net loss leaves $170; its $17 current
 // risk is reached cumulatively by the next $7 net loss.
 const first=adaptiveAtThree('net',[trade(3,1,-10)]);assert.equal(first.activeLevel,3);assert.equal(first.levelPnl,-10);
 const second=adaptiveAtThree('net',[trade(3,1,-10),trade(4,1,-7)]);assert.equal(second.activeLevel,2);assert.equal(second.stepBacks,1);
});
test('per-balance progression and losses use that balance net P&L only',()=>{
 const f=fixture('streak',{start:55.99});const balance={id:'a',startingBalance:55.99,isActive:true,challengeEnabled:true,challengeMode:'streak',challengeReward:3.1};
 const workspace={balances:[balance],trades:[1,2].map(id=>({...trade(id,100,100),balanceResults:[{balanceId:'a',grossPnl:.01,commission:.02,swap:0,status:'closed'}]}))};
 const before=structuredClone(workspace);const state=replayChallenge(f.base,scopeChallengeAccount(workspace,balance));assert.equal(state.activeLevel,2);assert.equal(state.stepBacks,1);assert.deepEqual(workspace,before);
});
test('net-only pass API rejects gross-only inputs and invalid recorded net values',()=>{
 assert.equal(challengeTradePasses({grossPnl:10,profitTarget:10,netBalance:500,balanceTarget:500}),false);
 for(const value of [null,undefined,'',NaN,Infinity])assert.equal(challengeTradePasses({netPnl:value,profitTarget:10,netBalance:500,balanceTarget:500}),false);
});

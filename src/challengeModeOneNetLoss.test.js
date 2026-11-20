import test from 'node:test';
import assert from 'node:assert/strict';
import {modeOneTradeStepsBack,replayChallenge,resetAutomation} from './challengeAutomation.js';
import {buildChallengePlan,emptyChallenge} from './challengeModel.js';
import {scopeChallengeAccount} from './challengeLifecycle.js';
const at=new Date('2026-11-20T10:00:00Z');
const trade=(id,grossPnl,pnl,extra={})=>({id:String(id),accountId:'account',grossPnl,pnl,commission:Math.max(0,grossPnl-pnl),swap:0,status:'closed',date:'2026-11-20',createdAt:`2026-11-20T11:${String(id).padStart(2,'0')}:00Z`,screenshots:{entry:[],exit:[]},...extra});
function run(trades,{start=40,level=1}={}){
 const base=resetAutomation({...emptyChallenge(),automation:{rewardRatio:1.5}},[],'risk',level,at,30,start);
 return replayChallenge(base,{id:'account',challengeEnabled:true,challengeReward:1.5,balance:start,trades});
}
test('strict forty-percent boundary uses net P&L and exact cents',()=>{
 for(const [net,expected] of [[-3.19,false],[-3.20,false],[-3.21,true]])assert.equal(modeOneTradeStepsBack(net,8),expected);
 assert.equal(modeOneTradeStepsBack(-1.80,4.5),false);assert.equal(modeOneTradeStepsBack(-1.81,4.5),true);
 // 40% of $4.51 is $1.804; do not round that threshold upward to $1.81.
 assert.equal(modeOneTradeStepsBack(-1.80,4.51),false);assert.equal(modeOneTradeStepsBack(-1.81,4.51),true);
 for(const net of [0,3.21,null,undefined,'',NaN,Infinity])assert.equal(modeOneTradeStepsBack(net,8),false);
 for(const risk of [0,-8,null,undefined,'',NaN,Infinity])assert.equal(modeOneTradeStepsBack(-3.21,risk),false);
});
test('Level 3 with spare capital stays at exactly $3.20 and steps back for $3.21 net',()=>{
 assert.equal(buildChallengePlan(20,'risk',30,1.5)[2].risk,8);
 assert.equal(run([trade(1,-3.20,-3.20)]).activeLevel,3);
 const state=run([trade(1,-3.20,-3.21)]);assert.equal(state.activeLevel,2);assert.equal(state.stepBacks,1);assert.equal(state.statuses[3],'Step back');
});
test('commission and swap count through recorded net; gross loss alone cannot trigger',()=>{
 assert.equal(run([trade(1,-3,-3.21,{commission:.20,swap:.01})]).activeLevel,2);
 assert.equal(run([trade(1,.1,-3.21,{commission:3.2,swap:.11})]).activeLevel,2);
 assert.equal(run([trade(1,-8,-.01)]).activeLevel,3);
 assert.equal(run([trade(1,-8,0)]).activeLevel,3);
});
test('small losses and intervening wins do not accumulate toward the single-trade trigger',()=>{
 const events=[trade(1,-2,-2),trade(2,-2,-2),trade(3,1,1)];
 const state=run(events,{start:47});assert.equal(state.activeLevel,3);assert.equal(state.stepBacks,0);
 assert.equal(run([...events,trade(4,-3.21,-3.21)],{start:47}).activeLevel,2);
});
test('minimum balance remains independent even for an exact-threshold or smaller loss',()=>{
 const start=buildChallengePlan(20,'risk',30,1.5)[2].start;
 const below=run([trade(1,-.01,-.01)],{start});assert.equal(below.activeLevel,2);assert.match(below.notes[3],/available capital/);
 assert.equal(run([trade(1,-3.20,-3.20)],{start}).activeLevel,2);
 assert.equal(run([trade(1,-1.81,-1.81)],{start:25}).activeLevel,1);
});
test('balance-scoped Mode 1 uses only that account net result and retains source trades',()=>{
 const balance={id:'account',startingBalance:40,isActive:true,challengeEnabled:true,challengeMode:'risk',challengeReward:1.5};
 const parent={id:'workspace',balances:[balance],trades:[{...trade(1,100,100),accountId:'workspace',balanceResults:[{balanceId:'account',grossPnl:-3,commission:.20,swap:.01,status:'closed'}]}]};
 const before=structuredClone(parent),scoped=scopeChallengeAccount(parent,balance);
 const base=resetAutomation({...emptyChallenge(),automation:{rewardRatio:1.5}},[],'risk',1,at,30,40);
 assert.equal(replayChallenge(base,scoped).activeLevel,2);assert.deepEqual(parent,before);
});
test('editing net costs replays progress; open, old and foreign trades do not trigger',()=>{
 const original=trade(1,-3,-3.21),before=structuredClone(original);
 assert.equal(run([original]).activeLevel,2);
 assert.equal(run([{...original,pnl:-3.20,commission:.20}]).activeLevel,3);
 assert.equal(run([{...original,status:'open'}]).activeLevel,3);
 assert.equal(run([{...original,accountId:'other'}]).activeLevel,3);
 assert.equal(run([{...original,createdAt:'2026-11-20T09:00:00Z'}]).activeLevel,3);
 assert.deepEqual(original,before);
});

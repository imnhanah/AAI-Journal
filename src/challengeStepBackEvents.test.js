import test from 'node:test';
import assert from 'node:assert/strict';
import {resetAutomation,replayChallenge} from './challengeAutomation.js';
import {emptyChallenge} from './challengeModel.js';
const at=new Date('2026-11-20T10:00:00Z');
const trades=values=>values.map((pnl,index)=>({id:String(index),accountId:'account',grossPnl:pnl,pnl,commission:0,swap:0,status:'closed',createdAt:`2026-11-20T11:${String(index).padStart(2,'0')}:00Z`}));
function run(values,{mode='risk',start=100,level=1,manual=0,financeMovements=[]}={}){
 const base=resetAutomation({...emptyChallenge(),automation:{rewardRatio:1.5,manualStepBacks:manual}},[],mode,level,at,30,start);
 const account={id:'account',challengeEnabled:true,balance:start,trades:trades(values),financeMovements};
 return {state:replayChallenge(base,account),base,account};
}
test('reported three-trade pattern counts three events instead of four levels',()=>{
 const first=run([-50]).state,second=run([-50,-8]).state,third=run([-50,-8,-5]).state;
 assert.equal(first.activeLevel,4);assert.equal(first.stepBacks,1);
 assert.equal(second.activeLevel,3);assert.equal(second.stepBacks,2);
 assert.equal(third.activeLevel,2);assert.equal(third.stepBacks,3);assert.equal(third.counted,3);
});
test('one trade crossing several balance floors and the risk rule counts once',()=>{
 const state=run([-70]).state;assert.equal(state.activeLevel,2);assert.equal(state.stepBacks,1);
 assert.equal(state.liveBalance,30);assert.equal(state.statuses[5],'Step back');
});
test('a balance-only step-back counts once when the loss is below the forty-percent trigger',()=>{
 const state=run([-.01],{start:35.75}).state;assert.equal(state.activeLevel,2);assert.equal(state.stepBacks,1);
});
test('withdrawal or trading transfer crossing several levels is one independent event',()=>{
 for(const type of ['withdrawal','transfer']){
  const movement={id:type,type,source:'trading',amount:70,createdAt:'2026-11-20T11:00:00Z'};
  const state=run([],{financeMovements:[movement]}).state;assert.equal(state.activeLevel,2);assert.equal(state.stepBacks,1);assert.equal(state.counted,0);
 }
});
test('manual actions remain counted separately; replay never adds the same events again',()=>{
 const {state,base,account}=run([-50,-8,-5],{manual:2});
 assert.equal(state.stepBacks,5);
 assert.deepEqual(replayChallenge(base,account),state);
 assert.deepEqual(replayChallenge(base,account),state);
});
test('checkpoint and current-capital reconciliation do not manufacture new events',()=>{
 const base={activeLevel:6,statuses:{6:'In progress'},notes:{},automation:{mode:'risk',rewardRatio:1.5,levelCount:30,startedAt:at.toISOString(),startingBalance:100,excludedIds:[],manualStepBacks:0}};
 const old={id:'old',grossPnl:-70,pnl:-70,createdAt:'2026-11-20T09:00:00Z',status:'closed'};
 const state=replayChallenge(base,{id:'account',challengeEnabled:true,balance:100,trades:[old]});
 assert.equal(state.activeLevel,2);assert.equal(state.stepBacks,0);assert.equal(state.counted,0);
});
test('a failed trade crossing the failure floor still counts as one downward event',()=>{
 const state=run([-90]).state;assert.equal(state.failed,true);assert.equal(state.activeLevel,1);assert.equal(state.stepBacks,1);
 assert.equal(run([-1],{start:20}).state.stepBacks,0);
});
test('derived counting does not mutate trades or saved checkpoint data',()=>{
 const {state,base,account}=run([-50,-8,-5]);const previous=structuredClone({base,account});
 assert.equal(replayChallenge(base,account).stepBacks,3);assert.equal(state.stepBacks,3);
 assert.deepEqual({base,account},previous);
});

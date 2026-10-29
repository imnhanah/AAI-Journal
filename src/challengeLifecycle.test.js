import test from 'node:test';
import assert from 'node:assert/strict';
import {buildChallengePlan,emptyChallenge,canUseLossStreak} from './challengeModel.js';
import {resetAutomation,replayChallenge} from './challengeAutomation.js';
import {scopeChallengeAccount,pruneChallengeTrades,linkedChallengeTrades,challengeLifecycle} from './challengeLifecycle.js';
import {accountLossGuardrails} from './accountRisk.js';
const base=()=>resetAutomation(emptyChallenge(),[],'risk',1,new Date('2026-10-06T09:00:00Z'));
const account={id:'a',balance:20,challengeEnabled:true};
const loss={id:'loss',accountId:'a',grossPnl:-1,pnl:-1,date:'2026-10-06',createdAt:'2026-10-06T10:00:00Z'};
const deposit=amount=>({id:'cash',type:'deposit',source:'trading',amount,date:'2026-10-06',createdAt:'2026-10-06T12:00:00Z'});
test('startup without an account returns an unlocked lifecycle',()=>{
  assert.deepEqual(challengeLifecycle({},null),{liveBalance:0,failed:false,settingsLocked:false});
});
test('loading balance placeholders do not crash challenge setup',()=>{
  const scoped=scopeChallengeAccount({balances:[null],trades:[],financeMovements:[]},{});
  assert.deepEqual(scoped.balances,[]);
  assert.doesNotThrow(()=>challengeLifecycle({},scoped));
});
test('custom rewards change targets but retain every risk, lot and stop loss',()=>{
  const original=buildChallengePlan(20,'risk');
  const custom=buildChallengePlan(20,'risk',30,2);
  custom.forEach((row,index)=>{assert.equal(row.risk,original[index].risk);assert.equal(row.lots,original[index].lots);assert.equal(row.sl,original[index].sl);assert.equal(row.profit,Math.round(row.risk*200)/100);});
  assert.equal(canUseLossStreak(2.8),true);assert.equal(canUseLossStreak(2.81),true);
});
test('one dollar below the minimum fails; only a restoring deposit reactivates',()=>{
  const failed=replayChallenge(base(),{...account,trades:[loss]});
  assert.equal(failed.failed,true);assert.equal(failed.liveBalance,19);
  const insufficient=replayChallenge(base(),{...account,trades:[loss],financeMovements:[deposit(.5)]});
  assert.equal(insufficient.failed,true);
  const recovered=replayChallenge(base(),{...account,trades:[loss],financeMovements:[deposit(1)]});
  assert.equal(recovered.failed,false);assert.equal(recovered.activeLevel,1);assert.equal(recovered.liveBalance,20);
  const profit={...loss,id:'later',grossPnl:20,pnl:20,createdAt:'2026-10-06T11:00:00Z'};
  assert.equal(replayChallenge(base(),{...account,trades:[loss,profit]}).failed,true);
});
test('deposits select the highest affordable starting level, without trading passes',()=>{
  const baseline={...base(),automation:{...base().automation,mode:'streak'}};
  const result=replayChallenge(baseline,{...account,trades:[],financeMovements:[deposit(80)]});
  assert.equal(result.liveBalance,100);assert.equal(result.activeLevel,4);
  assert.equal(Object.values(result.statuses).includes('Pass'),false);
  assert.deepEqual([result.statuses[1],result.statuses[2],result.statuses[3]],['Jumped','Jumped','Jumped']);
  assert.equal(result.fundingJumps[2],'Jumped due to deposit-funded balance');
});
test('starting balance funds skipped levels without counting them as trading passes',()=>{
  const baseline={...base(),automation:{...base().automation,mode:'streak'}};
  const result=replayChallenge(baseline,{...account,balance:100,trades:[]});
  assert.equal(result.activeLevel,4);
  assert.deepEqual([result.statuses[1],result.statuses[2],result.statuses[3]],['Jumped','Jumped','Jumped']);
  assert.equal(result.statuses[4],'In progress');
  assert.equal(result.fundingJumps[1],'Jumped due to starting balance');
  assert.equal(result.stepBacks,0);
});
test('deposit jump preserves earned passes and replay removes labels when deposit is deleted',()=>{
  const win={...loss,id:'win',grossPnl:6,pnl:6};
  const result=replayChallenge(base(),{...account,trades:[win],financeMovements:[deposit(80)]});
  assert.equal(result.statuses[1],'Pass');
  assert.equal(result.statuses[2],'Jumped');
  assert.equal(result.fundingJumps[1],undefined);
  const removed=replayChallenge(base(),{...account,trades:[win],financeMovements:[]});
  assert.equal(removed.statuses[1],'Pass');
  assert.equal(removed.statuses[2],'In progress');
  assert.deepEqual(removed.fundingJumps,{});
});
test('open linked trades lock settings without contributing to balance or progression',()=>{
  const open={...loss,status:'open',pnl:-100,grossPnl:-100};
  const state=replayChallenge(base(),{...account,trades:[open]});
  assert.equal(state.settingsLocked,true);assert.equal(state.counted,0);assert.equal(state.liveBalance,20);
  assert.equal(linkedChallengeTrades(base(),{...account,trades:[open]}).length,1);
});
test('activating a challenge leaves previously logged trades outside the new challenge',()=>{
  const historical={...loss,id:'historical',createdAt:'2026-10-05T09:00:00Z'};
  const unstarted={...account,trades:[historical]};
  assert.equal(linkedChallengeTrades({automation:null},unstarted).length,0);
  assert.equal(challengeLifecycle({automation:null},unstarted).settingsLocked,false);

  const activated=resetAutomation(emptyChallenge(),[historical],'risk',1,new Date('2026-10-06T09:00:00Z'));
  const afterActivation={...loss,id:'new-trade',createdAt:'2026-10-06T10:00:00Z'};
  assert.deepEqual(linkedChallengeTrades(activated,{...account,trades:[historical,afterActivation]}).map(trade=>trade.id),['new-trade']);
  assert.equal(challengeLifecycle(activated,{...account,trades:[historical,afterActivation]}).settingsLocked,true);
});
test('shared-trade removal preserves other accounts and recalculates aggregate totals',()=>{
  const workspace={trades:[{id:'shared',pnl:8,balanceResults:[{balanceId:'a',grossPnl:10,netPnl:9,commission:1},{balanceId:'b',grossPnl:-1,netPnl:-1}]}]};
  const retained=pruneChallengeTrades(workspace,'a',['shared']);
  assert.equal(retained.length,1);assert.equal(retained[0].pnl,-1);assert.equal(retained[0].balanceResults[0].balanceId,'b');
  assert.equal(pruneChallengeTrades({...workspace,trades:retained},'b',['shared']).length,0);
});
test('guardrails are isolated by account and a deposit does not clear a breach',()=>{
  const a={id:'a',startingBalance:20,guardrails:{dailyLossLimitPct:2}};
  const b={id:'b',startingBalance:100,guardrails:{dailyLossLimitPct:2}};
  const workspace={balances:[a,b],trades:[{...loss,balanceResults:[{balanceId:'a',grossPnl:-1,netPnl:-1,status:'closed'}]}],financeMovements:[{...deposit(100),balanceId:'a'}]};
  const now=new Date(2026,9,6,13);
  assert.equal(accountLossGuardrails(scopeChallengeAccount(workspace,a),now).tradeEntryLocked,true);
  assert.equal(accountLossGuardrails(scopeChallengeAccount(workspace,b),now).tradeEntryLocked,false);
});

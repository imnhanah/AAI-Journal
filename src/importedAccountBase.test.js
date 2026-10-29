import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileImportedBases as reconcile} from './importedAccountBase.js';
import {scopedFinanceProfitCycle} from './financeScope.js';
import {scopeChallengeAccount,liveChallengeBalance} from './challengeLifecycle.js';
import {readFileSync} from 'node:fs';
const fixture = () => ({workspaceType:'multi_balance',balance:55.99,
  balances:[{id:'pepper',startingBalance:0}],
  trades:[{date:'2026-10-07',closeDate:'2026-10-07',pnl:-3.06,balanceResults:[{balanceId:'pepper',grossPnl:-3.06,netPnl:-3.06}]}],
  financeMovements:[{type:'deposit',amount:55.99,date:'2026-10-05',source:'trading',note:'[Imported account base] Transfer',balanceId:'pepper'}]});
test('statement deposit plus net loss produces 52.93 without rewriting data',()=>{
  const original=fixture(), repaired=reconcile(original);
  assert.equal(repaired.balances[0].startingBalance,55.99);
  assert.equal(original.balances[0].startingBalance,0);
  assert.equal(scopedFinanceProfitCycle(repaired,'pepper').availableCapital,52.93);
  assert.equal(Number(liveChallengeBalance(scopeChallengeAccount(repaired,repaired.balances[0])).toFixed(2)),52.93);
});
test('repeated reconciliation and already funded imports never double count',()=>{
  const repaired=reconcile(fixture());
  assert.equal(reconcile(repaired),repaired);
});
test('legacy untargeted funding belongs only to primary account',()=>{
  const a=fixture();delete a.financeMovements[0].balanceId;
  a.balance+=100;a.balances.push({id:'second',startingBalance:100});
  const repaired=reconcile(a);
  assert.equal(repaired.balances[0].startingBalance,55.99);
  assert.equal(repaired.balances[1].startingBalance,100);
});
test('unexplained discrepancies and normal deposits leave starting balances untouched',()=>{
  const a=fixture();a.balance=200;assert.equal(reconcile(a),a);
  const b=fixture();b.financeMovements[0].note='Manual deposit';assert.equal(reconcile(b),b);
  const c=fixture();c.financeMovements[0].balanceId='missing';assert.equal(reconcile(c),c);
});
test('zeroed bases and untargeted deposit recover the unique broker account, not its neighbour',()=>{
  const a=fixture();a.balance=0;a.balances.unshift({id:'other',startingBalance:0});
  delete a.financeMovements[0].balanceId;a.trades[0].context='Imported cTrader position #ctrader:1';
  const repaired=reconcile(a);
  assert.equal(repaired.balance,55.99);
  assert.equal(repaired.balances[0].startingBalance,0);
  assert.equal(repaired.balances[1].startingBalance,55.99);
  assert.equal(repaired.financeMovements[0].balanceId,'pepper');
  assert.equal(scopedFinanceProfitCycle(repaired,'pepper').availableCapital,52.93);
  assert.equal(reconcile(repaired),repaired);
});
test('ambiguous untargeted deposits are not moved between accounts',()=>{
  const a=fixture();a.balance=0;delete a.financeMovements[0].balanceId;
  a.balances.push({id:'second',startingBalance:0});
  a.trades[0].context='Imported cTrader position #ctrader:1';
  a.trades.push({context:'Imported cTrader position #ctrader:2',balanceResults:[{balanceId:'second'}]});
  assert.equal(reconcile(a),a);
});
test('import persists the selected starting base and refreshes the open settings draft',()=>{
  const source=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(source,/importIntoAccount\(plan, progress, multiBalanceWorkspace \? selectedBalanceId : null\)/);
  assert.match(source,/updateWorkspaceBalance\(user.id, targetAccount.id, fundedBalance\)/);
  assert.match(source,/nextAccount.balances =/);
  assert.match(source,/startingBalance:funded.startingBalance/);
});

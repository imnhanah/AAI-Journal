import test from 'node:test';
import assert from 'node:assert/strict';
import { scopedFinanceProfitCycle as cycle, savingsOwner, savingsForBalance, savingsBalance } from './financeScope.js';
const fixture = () => ({workspaceType:'multi_balance', balance:3000,
  balances:[{id:'a',startingBalance:1000},{id:'b',startingBalance:2000}],
  savingsAccounts:[{id:'legacy'},{id:'sb',balanceId:'b'}],
  trades:[{date:'2026-10-01',closeDate:'2026-10-01',pnl:300,balanceResults:[{balanceId:'a',netPnl:100},{balanceId:'b',netPnl:200}]}],financeMovements:[]});
test('each baseline and profit is scoped to the selected balance',()=>{const a=fixture();assert.deepEqual(cycle(a,'a'),{baseline:1000,profit:100,availableCapital:1100});assert.equal(cycle(a,'b').profit,200);assert.equal(cycle(a,'b').baseline,2000);});
test('a cash movement resets only the source account cycle',()=>{const a=fixture();a.financeMovements.push({type:'deposit',source:'trading',balanceId:'a',amount:50,date:'2026-10-02'});assert.equal(cycle(a,'a').baseline,1150);assert.equal(cycle(a,'a').profit,0);assert.equal(cycle(a,'b').profit,200);});
test('cross-account savings transfer debits source, credits destination savings only',()=>{const a=fixture();a.financeMovements.push({type:'transfer',source:'trading',balanceId:'a',savingsAccountId:'sb',amount:10,date:'2026-10-02'});assert.equal(cycle(a,'a').baseline,1090);assert.equal(cycle(a,'a').profit,0);assert.equal(cycle(a,'b').baseline,2000);assert.equal(cycle(a,'b').profit,200);assert.equal(savingsBalance(a,'sb'),10);assert.equal(savingsBalance(a,'legacy'),0);});
test('savings withdrawal never resets trading baseline or profit',()=>{const a=fixture();a.financeMovements.push({type:'withdrawal',source:'savings',balanceId:'b',savingsAccountId:'sb',amount:5,date:'2026-10-02'});assert.equal(cycle(a,'b').profit,200);assert.equal(cycle(a,'b').baseline,2000);assert.equal(savingsBalance(a,'sb'),-5);});
test('legacy plans and unscoped movements belong to Account 1',()=>{const a=fixture();assert.equal(savingsOwner(a,a.savingsAccounts[0]),'a');assert.deepEqual(savingsForBalance(a,'b').map(x=>x.id),['sb']);a.financeMovements.push({type:'deposit',source:'trading',amount:20,date:'2026-10-02'});assert.equal(cycle(a,'a').baseline,1120);assert.equal(cycle(a,'b').profit,200);});
test('open trades do not contribute to available profit',()=>{const a=fixture();a.trades[0].status='open';assert.equal(cycle(a,'a').profit,0);});
test('deleting a cash movement replays the previous baseline',()=>{const a=fixture();a.financeMovements.push({type:'transfer',source:'trading',balanceId:'a',amount:10,date:'2026-10-02'});assert.equal(cycle(a,'a').profit,0);a.financeMovements=[];assert.equal(cycle(a,'a').profit,100);});
test('single-account journals retain their own starting balance',()=>{const a={balance:100,trades:[{date:'2026-10-01',closeDate:'2026-10-01',pnl:20}],financeMovements:[]};assert.deepEqual(cycle(a),{baseline:100,profit:20,availableCapital:120});});

import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAccountFinancialData, validateFinanceMovement, validateTradeFinancialData} from './financialValidation.js';
import {summarizeClosedTrades} from './journalStats.js';
import {scopedFinanceProfitCycle, savingsBalance} from './financeScope.js';
import {savingsAllocation} from './savingsSchedule.js';
import {accountLossGuardrails} from './accountRisk.js';

const validAccount = () => ({
  id:'account', balance:'1000', dailyLossLimitPct:'5', monthlyLossLimitPct:'10',
  trades:[{id:'trade', date:'2026-10-01', closeDate:'2026-10-01', pnl:'100', grossPnl:'105', commission:'4', swap:'1'}],
  financeMovements:[{id:'deposit', type:'deposit', amount:'50', date:'2026-10-02'}],
});

test('finite financial strings, zero, and negative values remain valid', () => {
  const account=validAccount();
  account.trades.push({id:'loss',date:'2026-10-03',closeDate:'2026-10-03',pnl:'-25',grossPnl:'-25',commission:0,swap:0});
  assert.deepEqual(validateAccountFinancialData(account),{valid:true,issues:[]});
  assert.equal(summarizeClosedTrades(account.trades).netPnl,75);
  assert.deepEqual(scopedFinanceProfitCycle(account),{baseline:1150,profit:-25,availableCapital:1125});
});

test('malformed trade values fail closed with record and field details', () => {
  const account=validAccount();
  account.trades[0].grossPnl='bad';
  const validation=validateAccountFinancialData(account);
  assert.equal(validation.valid,false);
  assert.deepEqual(validation.issues[0],{recordType:'trade',recordId:'trade',field:'grossPnl',value:'bad',reason:'not-finite'});
  const stats=summarizeClosedTrades(account.trades);
  assert.equal(stats.valid,false);assert.equal(stats.grossPnl,null);assert.equal(stats.netPnl,null);
});

test('closed balance results are validated even when the legacy parent P&L is blank', () => {
  const trade={id:'multi',pnl:'',balanceResults:[{balanceId:'b1',grossPnl:'25',commission:'bad',swap:0,status:'closed'}]};
  const validation=validateTradeFinancialData(trade);
  assert.equal(validation.valid,false);
  assert.deepEqual(validation.issues[0],{recordType:'trade balance result',recordId:'multi:b1',field:'commission',value:'bad',reason:'not-finite'});
});

test('malformed P&L blocks finance and savings totals instead of producing NaN', () => {
  const account=validAccount();account.trades[0].pnl='not-a-number';
  const finance=scopedFinanceProfitCycle(account);
  const savings=savingsAllocation(account,{id:'save',allocationPct:10});
  assert.equal(finance.valid,false);assert.equal(finance.availableCapital,null);
  assert.equal(savings.valid,false);assert.equal(savings.remaining,null);
});

test('malformed cash movements fail closed without being treated as zero', () => {
  const account=validAccount();account.financeMovements[0].amount=Infinity;account.financeMovements[0].savingsAccountId='save';
  const movement=validateFinanceMovement(account.financeMovements[0]);
  assert.equal(movement.valid,false);assert.equal(movement.issues[0].field,'amount');
  assert.equal(scopedFinanceProfitCycle(account).valid,false);
  assert.equal(savingsBalance(account,'save').valid,false);
});

test('invalid balances and guardrail percentages lock risk decisions with structured issues', () => {
  const account=validAccount();account.balance='Infinity';account.dailyLossLimitPct='bad';
  const guardrails=accountLossGuardrails(account,new Date('2026-10-02T12:00:00Z'));
  assert.equal(guardrails.valid,false);assert.equal(guardrails.tradeEntryLocked,true);
  assert.equal(guardrails.guardrailBalance,null);
  assert.deepEqual(guardrails.issues.map(item=>item.field),['balance','dailyLossLimitPct']);
});

test('invalid savings targets and allocation percentages are reported rather than treated as zero', () => {
  const account=validAccount();account.savingsAccounts=[{id:'save',target:'bad',allocationPct:'Infinity'}];
  const validation=validateAccountFinancialData(account);
  assert.equal(validation.valid,false);
  assert.deepEqual(validation.issues.map(item=>item.field),['target','allocationPct']);
});

test('malformed persisted collection rows fail closed with structured issues instead of throwing', () => {
  const account=validAccount();
  account.balances=[null];
  account.savingsAccounts=[undefined];
  account.trades=[null];
  account.financeMovements=[null];
  const validation=validateAccountFinancialData(account);
  assert.equal(validation.valid,false);
  assert.deepEqual(validation.issues.map(({recordType,field,reason})=>({recordType,field,reason})),[
    {recordType:'balance',field:'record',reason:'invalid-record'},
    {recordType:'savings account',field:'record',reason:'invalid-record'},
    {recordType:'trade',field:'record',reason:'invalid-record'},
    {recordType:'cash movement',field:'record',reason:'invalid-record'},
  ]);
});

test('Infinity and NaN are rejected for direct trade validation', () => {
  for (const value of [Infinity,NaN,'Infinity','NaN']) {
    const validation=validateTradeFinancialData({id:'bad',closeDate:'2026-10-01',pnl:value});
    assert.equal(validation.valid,false,String(value));
    assert.equal(validation.issues[0].field,'pnl');
  }
});

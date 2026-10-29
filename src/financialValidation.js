const blank = value => value === '' || value == null;

export function finiteFinancialNumber(value) {
  if (blank(value)) return { valid:false, reason:'missing' };
  const number = Number(value);
  return Number.isFinite(number) ? { valid:true, value:number } : { valid:false, reason:'not-finite' };
}

const optionalFinancialNumber = (value, fallback = 0) => blank(value) ? { valid:true, value:fallback } : finiteFinancialNumber(value);
const issue = (recordType, record, field, value, reason) => ({
  recordType,
  recordId: String(record?.id || record?.accountId || 'unsaved'),
  field,
  value,
  reason,
});

function check(issues, recordType, record, field, value, { optional=false, fallback=0 } = {}) {
  const result = optional ? optionalFinancialNumber(value, fallback) : finiteFinancialNumber(value);
  if (!result.valid) issues.push(issue(recordType, record, field, value, result.reason));
  return result;
}

function financialCollection(issues, account, field, value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  issues.push(issue('account', account, field, value, 'invalid-collection'));
  return [];
}

function invalidRecord(issues, recordType, record) {
  if (record && typeof record === 'object' && !Array.isArray(record)) return false;
  issues.push(issue(recordType, record, 'record', record, 'invalid-record'));
  return true;
}

export function validateTradeFinancialData(trade) {
  const issues = [];
  if (!trade || trade.status === 'open') return { valid:true, issues };
  const closedResults = (trade.balanceResults || []).filter(result => result && result.status !== 'open' && result.grossPnl !== '' && result.grossPnl != null);
  if (!blank(trade.pnl)) {
    const pnl = check(issues, 'trade', trade, 'pnl', trade.pnl);
    if (pnl.valid) check(issues, 'trade', trade, 'grossPnl', trade.grossPnl ?? trade.pnl, { optional:true, fallback:0 });
    check(issues, 'trade', trade, 'commission', trade.commission, { optional:true });
    check(issues, 'trade', trade, 'swap', trade.swap, { optional:true });
  } else if (!closedResults.length) return { valid:true, issues };
  for (const result of closedResults) {
    const row = { ...result, id: result.id || `${trade.id || 'unsaved'}:${result.balanceId || 'balance'}` };
    const net = result.netPnl;
    if (blank(net)) check(issues, 'trade balance result', row, 'grossPnl', result.grossPnl);
    else check(issues, 'trade balance result', row, 'netPnl', net);
    check(issues, 'trade balance result', row, 'commission', result.commission, { optional:true });
    check(issues, 'trade balance result', row, 'swap', result.swap, { optional:true });
  }
  return { valid:issues.length === 0, issues };
}

export function validateFinanceMovement(movement) {
  const issues = [];
  if (movement && ['deposit','withdrawal','transfer'].includes(movement.type)) check(issues, 'cash movement', movement, 'amount', movement.amount);
  return { valid:issues.length === 0, issues };
}

export function validateAccountFinancialData(account) {
  const issues = [];
  if (!account) return { valid:true, issues };
  check(issues, 'account', account, 'balance', account.balance, { optional:true });
  check(issues, 'account', account, 'dailyLossLimitPct', account.dailyLossLimitPct, { optional:true });
  check(issues, 'account', account, 'monthlyLossLimitPct', account.monthlyLossLimitPct, { optional:true });
  for (const balance of financialCollection(issues, account, 'balances', account.balances)) {
    if (invalidRecord(issues, 'balance', balance)) continue;
    check(issues, 'balance', balance, 'startingBalance', balance.startingBalance, { optional:true });
    check(issues, 'balance', balance, 'dailyLossLimitPct', balance.guardrails?.dailyLossLimitPct, { optional:true });
    check(issues, 'balance', balance, 'monthlyLossLimitPct', balance.guardrails?.monthlyLossLimitPct, { optional:true });
  }
  for (const saving of financialCollection(issues, account, 'savingsAccounts', account.savingsAccounts)) {
    if (invalidRecord(issues, 'savings account', saving)) continue;
    check(issues, 'savings account', saving, 'target', saving.target, { optional:true });
    check(issues, 'savings account', saving, 'allocationPct', saving.allocationPct, { optional:true });
  }
  for (const trade of financialCollection(issues, account, 'trades', account.trades)) {
    if (!invalidRecord(issues, 'trade', trade)) issues.push(...validateTradeFinancialData(trade).issues);
  }
  for (const movement of financialCollection(issues, account, 'financeMovements', account.financeMovements)) {
    if (!invalidRecord(issues, 'cash movement', movement)) issues.push(...validateFinanceMovement(movement).issues);
  }
  return { valid:issues.length === 0, issues };
}

export function invalidFinancialResult(issues, fields = {}) {
  return { valid:false, issues, ...fields };
}

export function financialValidationMessage(issues = []) {
  const first = issues[0];
  if (!first) return 'Financial data needs correction before calculations can continue.';
  const label = `${first.recordType} ${first.recordId}`;
  return `Financial data needs correction: ${label} has an invalid ${first.field} value. Review and correct the record before continuing.`;
}

import { activeBalances, isMultiBalanceWorkspace } from './balanceModel.js';
import {invalidFinancialResult, validateAccountFinancialData, validateFinanceMovement} from './financialValidation.js';

// Untargeted historical records belong to the original trading account.
export function savingsOwner(account, saving) {
  return saving?.balanceId || activeBalances(account)[0]?.id || null;
}
export function savingsForBalance(account, balanceId) {
  return (account.savingsAccounts || []).filter(saving => !balanceId || savingsOwner(account, saving) === balanceId);
}
export function savingsBalance(account, savingsId) {
  const issues = (account.financeMovements || []).filter(movement => movement.savingsAccountId === savingsId).flatMap(movement => validateFinanceMovement(movement).issues);
  if (issues.length) return invalidFinancialResult(issues, { balance:null });
  return (account.financeMovements || []).reduce((sum, movement) => {
    if (movement.savingsAccountId !== savingsId) return sum;
    if (movement.type === 'transfer') return sum + Number(movement.amount || 0);
    if (movement.type === 'withdrawal' && movement.source === 'savings') return sum - Number(movement.amount || 0);
    return sum;
  }, 0);
}
export function scopedFinanceProfitCycle(account, balanceId = null) {
  const validation = validateAccountFinancialData(account);
  if (!validation.valid) return invalidFinancialResult(validation.issues, { baseline:null, profit:null, availableCapital:null });
  const balances = activeBalances(account);
  const scoped = isMultiBalanceWorkspace(account) && balanceId;
  const selected = balances.find(balance => balance.id === balanceId);
  let running = Number(scoped ? selected?.startingBalance || 0 : account.balance || 0);
  let baseline = running, profit = 0;
  const events = [];
  for (const trade of account.trades || []) {
    if (!trade.closeDate || trade.status === 'open') continue;
    const result = (trade.balanceResults || []).find(item => item.balanceId === balanceId);
    if (scoped && !result && (trade.balanceResults?.length || balances[0]?.id !== balanceId)) continue;
    const value = scoped && result ? Number(result.netPnl ?? (Number(result.grossPnl || 0) - Number(result.commission || 0) - Number(result.swap || 0))) : Number(trade.pnl || 0);
    events.push({ date: trade.date, kind: 'trade', value });
  }
  for (const movement of account.financeMovements || []) {
    if (scoped && (movement.balanceId || balances[0]?.id) !== balanceId) continue;
    // Savings-only withdrawals have no effect on trading capital or its cycle.
    if (movement.type === 'withdrawal' && movement.source === 'savings') continue;
    if (movement.note?.startsWith('[Imported account base]')) continue;
    const value = movement.type === 'deposit' ? Number(movement.amount) : movement.source === 'trading' ? -Number(movement.amount) : 0;
    if (!value) continue;
    events.push({ date: movement.date, kind: 'cash', value, createdAt: movement.createdAt });
  }
  events.sort((a, b) => String(a.date).localeCompare(String(b.date)) || ({ trade: 0, cash: 1 }[a.kind] - { trade: 0, cash: 1 }[b.kind]) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  for (const event of events) {
    running += event.value;
    if (event.kind === 'trade') profit += event.value;
    else { baseline = running; profit = 0; }
  }
  return { baseline, profit, availableCapital: running };
}

export const IMPORTED_ACCOUNT_BASE = '[Imported account base]';
const cents = value => Math.round((Number(value) || 0) * 100);

// Older imports raised accounts.balance but not workspace_balances.starting_balance.
// Recover only an exact, fully explained discrepancy; never guess from trade P&L
// or replace an intentionally entered starting balance with a broker snapshot.
// This is a read-time correction, not a background write to the user's journal.
export function reconcileImportedBases(account) {
  if (!account?.balances?.length) return account;
  const deposits = (account.financeMovements || []).filter(item =>
    item.type === 'deposit' && item.note?.startsWith(IMPORTED_ACCOUNT_BASE));
  const funding = deposits.reduce((sum, item) => sum + cents(item.amount), 0);
  const starting = account.balances.reduce((sum, item) => sum + cents(item.startingBalance), 0);
  const stored = cents(account.balance);
  // A later settings save could also reset the aggregate base to zero. Funding
  // is recoverable in this case only when *every* starting base is zero.
  if (!funding || (stored - starting !== funding && !(stored === 0 && starting === 0))) return account;
  const primary = account.balances.find(item => item.isActive !== false)?.id;
  const brokerOwners = new Set((account.trades || []).filter(trade => /Imported (?:cTrader|MetaTrader) position #/.test(trade.context || ''))
    .flatMap(trade => (trade.balanceResults || []).map(result => result.balanceId)));
  const fallback = brokerOwners.size === 1 ? [...brokerOwners][0] : primary;
  // Do not guess ownership when historical broker imports span several accounts.
  if (brokerOwners.size > 1 && deposits.some(item => !item.balanceId)) return account;
  if (deposits.some(item => !account.balances.some(balance => balance.id === (item.balanceId || fallback)))) return account;
  const movements = (account.financeMovements || []).map(item => deposits.includes(item) && !item.balanceId ? {...item,balanceId:fallback} : item);
  return { ...account, balance: (starting + funding) / 100, financeMovements: movements, balances: account.balances.map(balance => {
    const addition = deposits.filter(item => (item.balanceId || fallback) === balance.id)
      .reduce((sum, item) => sum + cents(item.amount), 0);
    return addition ? { ...balance, startingBalance: (cents(balance.startingBalance) + addition) / 100 } : balance;
  }) };
}

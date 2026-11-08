// Account-targeted results created before `net_pnl` was persisted still carry
// their gross P&L and costs. Resolve those records the same way as current
// results rather than treating their missing net value as zero.
export function balanceResultNetPnl(result) {
  const stored = result?.netPnl;
  if (stored !== '' && stored != null) {
    const value = Number(stored);
    if (Number.isFinite(value)) return value;
  }
  return (Number(result?.grossPnl) || 0)
    - (Number(result?.commission) || 0)
    - (Number(result?.swap) || 0);
}

// Keep a missing database value distinct from a real, recorded zero. The
// former lets the balance ledger recover legacy gross/cost records.
export function persistedBalanceResultNetPnl(value) {
  return value == null || value === '' ? null : Number(value);
}

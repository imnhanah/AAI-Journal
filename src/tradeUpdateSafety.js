export const STALE_TRADE_MESSAGE = 'This trade changed or is no longer available. Sync your journal and reopen Account settings before trying again.';
export const STALE_ACCOUNT_MESSAGE = 'Account data changed since this page loaded. The latest journal has been loaded; reopen Account settings and review the account list before trying again.';
export const PARTIAL_SETTINGS_MESSAGE = 'Account settings were not fully saved. Some earlier changes may already be saved. Sync your journal and review the accounts and trades before trying again.';

export function tradeUpdateFailure(error, fallback) {
  if (error?.code === 'PGRST116' && /0 rows/i.test(error.details || '')) {
    return {error:STALE_TRADE_MESSAGE, conflict:true};
  }
  return fallback(error);
}

// Carry the server's revision forward, but never overwrite a newer local row.
export function applySessionRepairs(accounts, results) {
  const saved = new Map(results.filter(({result})=>!result.error && result.data)
    .map(({repair,result})=>[`${repair.accountId}:${repair.trade.id}`, {before:repair.trade, saved:result.data}]));
  return accounts.map(account=>({...account,trades:(account.trades || []).map(trade=>{
    const repair=saved.get(`${account.id}:${trade.id}`);
    if (!repair || trade.updatedAt !== repair.before.updatedAt) return trade;
    return {...trade,...repair.saved,balanceResults:trade.balanceResults || []};
  })}));
}

const canonical = value => JSON.stringify(value, (_,v)=>v && typeof v==='object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(key=>[key,v[key]])) : v);
const signature = account => canonical({
  id:account?.id, workspaceType:account?.workspaceType,
  balances:[...(account?.balances || [])].sort((a,b)=>String(a.id).localeCompare(String(b.id))),
  trades:(account?.trades || []).map(trade=>({id:trade.id,updatedAt:trade.updatedAt,balanceResults:trade.balanceResults || []})).sort((a,b)=>String(a.id).localeCompare(String(b.id))),
  movements:[...(account?.financeMovements || [])].sort((a,b)=>String(a.id).localeCompare(String(b.id))),
});
export const accountRemovalSnapshotMatches = (before, fresh) => !!before && !!fresh && signature(before)===signature(fresh);

import {buildChallengePlan, challengeFailureFloor} from './challengeModel.js';
import {validateAccountFinancialData} from './financialValidation.js';

export const tradeLoggedAt = trade => Date.parse(trade.createdAt || `${trade.date}T${trade.time || '00:00'}`);
export const closedChallengeTrade = trade => trade.status !== 'open' && !String(trade.context || '').includes('[aaicorefx-running-trade]');
export function linkedChallengeTrades(state, account) {
  const config = state?.automation;
  if (!account?.challengeEnabled) return [];
  // A challenge has not begun until it has a checkpoint. This is especially
  // important while a trader is enabling a challenge for an account that
  // already has journal history: those earlier trades must not immediately
  // become linked and lock the setup controls.
  if (!config?.startedAt) return [];
  const excluded = new Set(config?.excludedIds || []);
  const included = new Set(config?.includedIds || []);
  return (account.trades || []).filter(trade => !excluded.has(trade.id) && (!trade.accountId || trade.accountId === account.id) &&
    (included.has(trade.id) || tradeLoggedAt(trade) >= Date.parse(config.startedAt)));
}
export function scopeChallengeAccount(workspace = {}, balance = {}) {
  const balances = Array.isArray(workspace.balances) ? workspace.balances.filter(item => item && typeof item === 'object') : [];
  const primary = balances.filter(item => item.isActive !== false)[0]?.id === balance.id;
  return {
    ...workspace, ...balance, balances, id:balance.id, balance:Number(balance.startingBalance) || 0,
    dailyLossLimitPct:Number(balance.guardrails?.dailyLossLimitPct) || 0,
    monthlyLossLimitPct:Number(balance.guardrails?.monthlyLossLimitPct) || 0,
    monthlyGoalPct:Number(balance.goals?.monthlyGoalPct) || 0,
    yearlyGoalPct:Number(balance.goals?.yearlyGoalPct) || 0,
    trades:(workspace.trades || []).flatMap(trade => {
      const result = (trade.balanceResults || []).find(item => item.balanceId === balance.id);
      if (!result) return primary && !(trade.balanceResults || []).length ? [{...trade,accountId:balance.id}] : [];
      const open = result.status === 'open' || result.grossPnl === '' || result.grossPnl == null;
      return [{...trade,accountId:balance.id,grossPnl:result.grossPnl,commission:result.commission,swap:result.swap,pnl:result.netPnl ?? (Number(result.grossPnl || 0)-Number(result.commission || 0)-Number(result.swap || 0)),status:open?'open':'closed',context:open?'[aaicorefx-running-trade]':'',date:result.closeDate || trade.date}];
    }),
    financeMovements:(workspace.financeMovements || []).filter(item => item.balanceId === balance.id || (!item.balanceId && primary)),
  };
}
export const cashImpact = item => item.type === 'deposit' ? (item.note?.startsWith('[Imported account base]') ? 0 : Number(item.amount || 0)) : item.source === 'trading' ? -Number(item.amount || 0) : 0;
export const liveChallengeBalance = account => {
  if (!validateAccountFinancialData(account).valid) return null;
  return Math.round((Number(account.balance ?? account.challengeStartingBalance ?? 0) + (account.trades || []).filter(closedChallengeTrade).reduce((sum,trade)=>sum+Number(trade.pnl || 0),0) + (account.financeMovements || []).reduce((sum,item)=>sum+cashImpact(item),0))*100)/100;
};
// A challenge locks in the real trading balance at the instant it begins.
// Older saved challenges derive that same amount from activity before their
// checkpoint, so they continue to display accurately.
export function challengeStartingBalance(state, account) {
  if (!validateAccountFinancialData(account).valid) return null;
  const captured = Number(state?.automation?.startingBalance);
  if (Number.isFinite(captured) && captured > 0) return Math.round(captured * 100) / 100;
  const startedAt = Date.parse(state?.automation?.startedAt || '');
  if (!Number.isFinite(startedAt)) return liveChallengeBalance(account);
  const base = Number(account?.balance ?? account?.challengeStartingBalance ?? 0);
  const trades = (account?.trades || []).filter(closedChallengeTrade).filter(trade => tradeLoggedAt(trade) < startedAt).reduce((sum,trade) => sum + Number(trade.pnl || 0),0);
  const cash = (account?.financeMovements || []).filter(item => Date.parse(item.createdAt || `${item.date}T23:59:59`) < startedAt).reduce((sum,item) => sum + cashImpact(item),0);
  return Math.round((base + trades + cash) * 100) / 100;
}
export const fundedChallengeLevel = (plan, balance) => plan.reduce((level,row)=>Math.round(balance*100) >= Math.round(row.start*100) ? row.level : level,1);
export function challengeLifecycle(state, account) {
  if (!account) return {liveBalance:0,failed:false,settingsLocked:false};
  const validation = validateAccountFinancialData(account);
  if (!validation.valid) return {valid:false,issues:validation.issues,liveBalance:null,failed:true,settingsLocked:true};
  const startingBalance=challengeStartingBalance(state,account);
  const mode=state.automation?.mode || account.challengeMode || 'risk';
  const plan = buildChallengePlan(startingBalance, mode, state.automation?.levelCount || account.challengeLevelCount, state.automation?.rewardRatio ?? account.challengeReward, state.automation);
  const liveBalance = liveChallengeBalance(account);
  const minimum=Math.round(challengeFailureFloor(startingBalance,mode,state.automation)*100);
  const checkpoint=Date.parse(state.automation?.startedAt || '1970-01-01T00:00:00Z');
  const events=[...(account.trades || []).filter(closedChallengeTrade).map(trade=>({at:tradeLoggedAt(trade),amount:Number(trade.pnl || 0),deposit:false})),...(account.financeMovements || []).map(item=>({at:Date.parse(item.createdAt || `${item.date}T23:59:59`),amount:cashImpact(item),deposit:item.type==='deposit' && cashImpact(item)>0}))].sort((a,b)=>a.at-b.at);
  let balance=Math.round(Number(account.balance ?? account.challengeStartingBalance ?? 0)*100);
  for(const event of events.filter(item=>item.at<checkpoint))balance+=Math.round(event.amount*100);
  let failed=balance<minimum;
  for(const event of events.filter(item=>item.at>=checkpoint)) {
    balance+=Math.round(event.amount*100);
    if(balance<minimum)failed=true;
    else if(event.deposit)failed=false;
  }
  return {liveBalance, failed:!!account.challengeEnabled && plan.length > 0 && failed, settingsLocked:linkedChallengeTrades(state,account).length>0};
}
export function pruneChallengeTrades(workspace, balanceId, ids) {
  const remove = new Set(ids);
  return (workspace.trades || []).flatMap(trade => {
    if (!remove.has(trade.id)) return [trade];
    const retained = balanceId ? (trade.balanceResults || []).filter(result=>result.balanceId!==balanceId) : [];
    if (!retained.length) return [];
    const total = key => retained.reduce((sum,result)=>sum+Number(result[key] || 0),0);
    return [{...trade,balanceResults:retained,grossPnl:total('grossPnl'),commission:total('commission'),swap:total('swap'),pnl:retained.reduce((sum,result)=>sum+Number(result.netPnl ?? (Number(result.grossPnl || 0)-Number(result.commission || 0)-Number(result.swap || 0))),0)}];
  });
}

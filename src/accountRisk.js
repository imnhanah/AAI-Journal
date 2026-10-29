import {closedChallengeTrade, cashImpact, liveChallengeBalance} from './challengeLifecycle.js';
import {invalidFinancialResult, validateAccountFinancialData} from './financialValidation.js';

// Replay each account independently. A breach stays active for its day/month,
// even if a later deposit increases the available balance.
export function accountLossGuardrails(account, now=new Date()) {
  const validation = validateAccountFinancialData(account);
  if (!validation.valid) return invalidFinancialResult(validation.issues, {
    dailyLossLimitPct:null, monthlyLossLimitPct:null, dailyPnl:null, monthlyPnl:null,
    dailyLossCap:null, monthlyLossCap:null, guardrailBalance:null,
    dailyLossHit:false, monthlyLossHit:false, tradeEntryLocked:true,
  });
  const pad=value=>String(value).padStart(2,'0');
  const day=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  const month=day.slice(0,7);
  const dailyPct=Number(account.dailyLossLimitPct || 0);
  const monthlyPct=Number(account.monthlyLossLimitPct || 0);
  const events=[...(account.trades || []).filter(closedChallengeTrade).map(trade=>({date:trade.date,at:trade.createdAt || `${trade.date}T${trade.time || '00:00'}`,pnl:Number(trade.pnl || 0)})),...(account.financeMovements || []).map(item=>({date:item.date,at:item.createdAt || `${item.date}T23:59:59`,cash:cashImpact(item)}))].filter(event=>event.date<=day).sort((a,b)=>a.date.localeCompare(b.date)||a.at.localeCompare(b.at));
  let balance=Number(account.balance || 0),dailyPnl=0,monthlyPnl=0,dailyLossHit=false,monthlyLossHit=false;
  for(const event of events) {
    balance+=event.cash ?? event.pnl;
    if(event.pnl==null)continue;
    if(event.date===day)dailyPnl+=event.pnl;
    if(event.date.slice(0,7)===month)monthlyPnl+=event.pnl;
    const funding=Math.max(0,balance);
    if(event.date===day && dailyPct>0 && dailyPnl<0 && dailyPnl<=-funding*dailyPct/100)dailyLossHit=true;
    if(event.date.slice(0,7)===month && monthlyPct>0 && monthlyPnl<0 && monthlyPnl<=-funding*monthlyPct/100)monthlyLossHit=true;
  }
  const guardrailBalance=Math.max(0,liveChallengeBalance(account));
  return {dailyLossLimitPct:dailyPct,monthlyLossLimitPct:monthlyPct,dailyPnl,monthlyPnl,dailyLossCap:guardrailBalance*dailyPct/100,monthlyLossCap:guardrailBalance*monthlyPct/100,guardrailBalance,dailyLossHit,monthlyLossHit,tradeEntryLocked:dailyLossHit||monthlyLossHit};
}

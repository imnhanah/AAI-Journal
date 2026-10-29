import {invalidFinancialResult, validateTradeFinancialData} from './financialValidation.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const norm = (value, max) => clamp(value / max * 100, 0, 100);
const classify = (pnl, cap) => Math.abs(pnl) <= cap ? 'be' : pnl > 0 ? 'win' : 'loss';

// Accept closed records only; presentation and running-trade filtering stay in the journal.
export function summarizeClosedTrades(trades, cap = 0) {
  const source = Array.isArray(trades) ? trades : [];
  const issues = source.flatMap(trade => validateTradeFinancialData(trade).issues);
  if (issues.length) return invalidFinancialResult(issues, {
    total:null, wins:null, losses:null, be:null, netPnl:null, winRate:null, avgWin:null,
    avgLoss:null, avgWinLoss:null, averageR:null, profitFactor:null, streak:null,
    streakType:null, bestWinStreak:null, bestLossStreak:null, consistency:null,
    recovery:null, thunderScore:null, sorted:[], byDay:{}, dayClasses:[], dayWinRate:null,
    grossPnl:null, grossProfit:null, totalCommission:null, totalSwap:null,
  });
  // A save may be briefly optimistic while the database response arrives.
  // Ignore an invalid placeholder rather than allowing one malformed row to
  // take down the entire journal view.
  const sorted = source.filter(t => t && t.pnl !== null && t.pnl !== '' && Number.isFinite(Number(t.pnl))).map(t => ({...t, pnl:Number(t.pnl)})).sort((a,b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`) || String(a.id || '').localeCompare(String(b.id || '')));
  const total = sorted.length;
  const wins = sorted.filter((t) => classify(t.pnl, cap) === "win");
  const losses = sorted.filter((t) => classify(t.pnl, cap) === "loss");
  const be = sorted.filter((t) => classify(t.pnl, cap) === "be");
  const netPnl = sorted.reduce((s, t) => s + t.pnl, 0);
  const winRate = total ? (wins.length / total) * 100 : 0;
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;
  const avgWinLoss = avgLoss ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
  const recordedR = sorted.filter(t => t.rr !== '' && t.rr != null && Number.isFinite(Number(t.rr)));
  const averageR = recordedR.length ? recordedR.reduce((sum,t) => sum + Number(t.rr),0) / recordedR.length : null;
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const grossPnl = sorted.reduce((s, t) => s + Number(t.grossPnl ?? t.pnl), 0);
  const totalCommission = sorted.reduce((s, t) => s + Number(t.commission || 0), 0);
  const totalSwap = sorted.reduce((s, t) => s + Number(t.swap || 0), 0);
  const profitFactor = grossLoss ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // streak + best runs (trade-level)
  let streak = 0, streakType = null, bestWinStreak = 0, bestLossStreak = 0, run = 0, runType = null;
  sorted.forEach((t) => {
    const type = classify(t.pnl, cap);
    if (type === runType) run++;
    else { run = 1; runType = type; }
    if (type === "win") bestWinStreak = Math.max(bestWinStreak, run);
    if (type === "loss") bestLossStreak = Math.max(bestLossStreak, run);
  });
  for (let i = sorted.length - 1; i >= 0; i--) {
    const type = classify(sorted[i].pnl, cap);
    if (streakType === null) { streakType = type; streak = type === "be" ? 0 : 1; if (type === "be") break; }
    else if (type === streakType) streak++;
    else break;
  }

  const mean = total ? netPnl / total : 0;
  const variance = total ? sorted.reduce((s, t) => s + Math.pow(t.pnl - mean, 2), 0) / total : 0;
  const consistency = total ? clamp(100 - (Math.sqrt(variance) / (Math.abs(mean) || 1)) * 18, 0, 100) : 0;

  let afterLossTotal = 0, afterLossWins = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (classify(sorted[i - 1].pnl, cap) === "loss") {
      afterLossTotal++;
      if (classify(sorted[i].pnl, cap) === "win") afterLossWins++;
    }
  }
  const recovery = afterLossTotal ? (afterLossWins / afterLossTotal) * 100 : 0;

  const thunderScore = Math.round(
    winRate * 0.3 + norm(profitFactor, 3) * 0.25 + norm(avgWinLoss, 3) * 0.15 +
    consistency * 0.15 + recovery * 0.15
  );

  const byDay = {};
  sorted.forEach((t) => { byDay[t.date] = (byDay[t.date] || 0) + t.pnl; });
  const dayEntries = Object.entries(byDay).sort(([a], [b]) => (a < b ? -1 : 1));
  const dayClasses = dayEntries.map(([date, pnl]) => ({ date, pnl, cls: classify(pnl, cap) }));
  const dayWinRate = dayClasses.length ? (dayClasses.filter((d) => d.cls === "win").length / dayClasses.length) * 100 : 0;

  return {
    total, wins: wins.length, losses: losses.length, be: be.length, netPnl, winRate, avgWin, avgLoss,
    avgWinLoss, averageR, profitFactor, streak, streakType, bestWinStreak, bestLossStreak, consistency, recovery,
    thunderScore, sorted, byDay, dayClasses, dayWinRate, grossPnl, grossProfit, totalCommission, totalSwap,
  };
}


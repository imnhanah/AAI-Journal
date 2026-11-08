import { startOfDisplayWeek } from './displayPreferences.js';

const dateKey = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const clampMobileDashboardValue = (value, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));

// Presentation-only derivatives. Trade scope, closed-trade status, P&L, and
// the configured trading-week start remain owned by existing journal logic.
export function mobileDashboardCumulative(trades = []) {
  let running = 0;
  return [...trades]
    .sort((left, right) => `${left.closeDate || left.date || ''} ${left.closeTime || left.time || ''}`.localeCompare(`${right.closeDate || right.date || ''} ${right.closeTime || right.time || ''}`))
    .map(trade => {
      running += Number(trade.pnl) || 0;
      return { date: trade.closeDate || trade.date, cumulative: Math.round(running * 100) / 100 };
    });
}

export function mobileDashboardWeek(trades = [], now = new Date(), weekStart) {
  const firstDay = startOfDisplayWeek(now, weekStart);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(firstDay);
    date.setDate(firstDay.getDate() + index);
    const key = dateKey(date);
    const matches = trades.filter(trade => (trade.closeDate || trade.date) === key);
    const pnl = matches.reduce((total, trade) => total + (Number(trade.pnl) || 0), 0);
    return { date, key, trades: matches, count: matches.length, pnl: Math.round(pnl * 100) / 100 };
  });
  return { days, firstDay, activeDays: days.filter(day => day.count > 0).length };
}

export function mobileChallengeJourney(state = {}, plan = []) {
  if (!plan.length) return { enabled: false, activeLevel: 0, nextLevel: 0, progress: 0, passed: 0, complete: false };
  const passed = Object.values(state.statuses || {}).filter(status => status === 'Pass').length;
  const complete = passed >= plan.length || Number(state.activeLevel) === plan.length + 1;
  const activeLevel = complete ? plan.length : clampMobileDashboardValue(Number(state.activeLevel) || 1, 1, plan.length);
  const row = plan[activeLevel - 1];
  const progress = complete ? 100 : row?.profit > 0
    ? clampMobileDashboardValue((Math.max(0, Number(state.levelPnl) || 0) / row.profit) * 100)
    : 0;
  return { enabled: true, activeLevel, nextLevel: complete ? plan.length : Math.min(plan.length, activeLevel + 1), progress, passed, complete };
}

const clampPercent = value => clampMobileDashboardValue(Number(value) || 0);
const closeKey = trade => `${trade.closeDate || trade.date || ''} ${trade.closeTime || trade.time || ''}`;
export const mobileDashboardRecent = trades => [...trades].sort((left, right) => closeKey(right).localeCompare(closeKey(left)));

// Same five axes as the desktop Core Score radar.
export function mobileCoreScoreAxes(stats = {}) {
  const profitFactor = Number.isFinite(stats.profitFactor) ? stats.profitFactor : 0;
  const payoff = Number.isFinite(stats.avgWinLoss) ? stats.avgWinLoss : 0;
  return [
    { label: 'Win rate', value: clampPercent(stats.winRate), display: `${Math.round(Number(stats.winRate) || 0)}%` },
    { label: 'PF', value: clampPercent(profitFactor / 5 * 100), display: profitFactor.toFixed(2) },
    { label: 'Avg win/loss', value: clampPercent(payoff / 3 * 100), display: payoff.toFixed(2) },
    { label: 'Consist.', value: clampPercent(stats.consistency), display: `${Math.round(Number(stats.consistency) || 0)}` },
    { label: 'Recov.', value: clampPercent(stats.recovery), display: `${Math.round(Number(stats.recovery) || 0)}%` },
  ];
}

export function mobileDashboardEquity(dayClasses = []) {
  let running = 0;
  return dayClasses.map(day => {
    running += Number(day.pnl) || 0;
    return { label: String(day.date).slice(5), value: Math.round(running * 100) / 100 };
  });
}

export function mobileDashboardMomentum(sorted = [], monthKey = '', openingBalance = 0) {
  const ordered = mobileDashboardRecent(sorted);
  const lastSix = ordered.slice(0, 6);
  const lastSixNet = lastSix.reduce((total, trade) => total + (Number(trade.pnl) || 0), 0);
  const priorNet = ordered.slice(6).reduce((total, trade) => total + (Number(trade.pnl) || 0), 0);
  const base = (Number(openingBalance) || 0) + priorNet;
  const groupBy = (trades, keyFor) => Object.entries(trades.reduce((all, trade) => {
    const key = keyFor(trade);
    all[key] = all[key] || { count: 0, pnl: 0 };
    all[key].count += 1;
    all[key].pnl += Number(trade.pnl) || 0;
    return all;
  }, {}));
  const month = sorted.filter(trade => (trade.closeDate || trade.date || '').slice(0, 7) === monthKey);
  const bestSession = groupBy(month, trade => trade.entrySession || trade.session || 'Unclassified').sort((left, right) => right[1].pnl - left[1].pnl)[0];
  const hotPair = groupBy(month, trade => trade.asset || '—').sort((left, right) => right[1].count - left[1].count)[0];
  return {
    closes: lastSix.length,
    net: lastSixNet,
    percent: base > 0 ? lastSixNet / base * 100 : null,
    green: lastSix.filter(trade => Number(trade.pnl) > 0).length,
    bestSession: bestSession ? { name: bestSession[0], pnl: bestSession[1].pnl } : null,
    hotPair: hotPair ? { name: hotPair[0], pnl: hotPair[1].pnl } : null,
  };
}

// Chart geometry for the phone Dashboard's lightweight SVG charts.
export function mobileChartLine(values = [], width = 320, height = 70, top = 6, bottom = 6) {
  const high = Math.max(...values, 0), low = Math.min(...values, 0), range = (high - low) || 1;
  const y = value => top + (high - value) / range * (height - top - bottom);
  const step = values.length > 1 ? (width - 12) / (values.length - 1) : 0;
  return { points: values.map((value, index) => [6 + index * step, y(value)]), zero: y(0) };
}

export function mobileSmoothPath(points = []) {
  if (!points.length) return '';
  let path = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let index = 0; index < points.length - 1; index++) {
    const before = points[index - 1] || points[index], from = points[index], to = points[index + 1], after = points[index + 2] || to;
    path += ` C${(from[0] + (to[0] - before[0]) / 6).toFixed(1)},${(from[1] + (to[1] - before[1]) / 6).toFixed(1)} ${(to[0] - (after[0] - from[0]) / 6).toFixed(1)},${(to[1] - (after[1] - from[1]) / 6).toFixed(1)} ${to[0].toFixed(1)},${to[1].toFixed(1)}`;
  }
  return path;
}

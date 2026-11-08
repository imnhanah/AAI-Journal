import {startOfDisplayWeek, weekStartOffset} from './displayPreferences.js';

export const classifyCalendarPnl = (pnl, cap = 0) => (
  Math.abs(Number(pnl) || 0) <= cap ? 'be' : Number(pnl) > 0 ? 'win' : 'loss'
);

export const isRunningCalendarTrade = (trade) => {
  const results = trade?.balanceResults || [];
  if (results.some((result) => result?.grossPnl !== '' && result?.grossPnl != null)) return false;
  return trade?.pnl === null || trade?.pnl === '' || String(trade?.context || '').includes('[aaicorefx-running-trade]');
};

export const closedCalendarTrades = (trades) => (
  Array.isArray(trades) ? trades.filter((trade) => trade && !isRunningCalendarTrade(trade)) : []
);

export function groupCalendarTradesByDay(trades, cap = 0) {
  const days = {};
  closedCalendarTrades(trades).forEach((trade) => {
    if (!trade.date) return;
    const day = days[trade.date] || {pnl: 0, count: 0, wins: 0, losses: 0, breakeven: 0, rTotal: 0, rCount: 0};
    const pnl = Number(trade.pnl) || 0;
    const outcome = classifyCalendarPnl(pnl, cap);
    day.pnl += pnl;
    day.count += 1;
    if (outcome === 'win') day.wins += 1;
    if (outcome === 'loss') day.losses += 1;
    if (outcome === 'be') day.breakeven += 1;
    if (Number.isFinite(Number(trade.rr))) { day.rTotal += Number(trade.rr); day.rCount += 1; }
    days[trade.date] = day;
  });
  Object.values(days).forEach((day) => { day.cls = classifyCalendarPnl(day.pnl, cap); });
  return days;
}

// Cash movements stay visually and mathematically separate from realised trade
// performance. This merely annotates the already-derived day map for the UI.
export function addCalendarCashMovements(byDay, movements = [], impactForMovement) {
  const next = {...byDay};
  movements.forEach((movement) => {
    if (!movement?.date) return;
    const impact = Number(impactForMovement?.(movement));
    if (!Number.isFinite(impact)) return;
    const day = {...(next[movement.date] || {pnl: 0, count: 0, wins: 0, losses: 0, breakeven: 0, rTotal: 0, rCount: 0, cls: 'be'})};
    day.cash = (Number(day.cash) || 0) + impact;
    day.cashCount = (Number(day.cashCount) || 0) + 1;
    day.cashType = movement.type || 'transfer';
    next[movement.date] = day;
  });
  return next;
}

export function buildCalendarMonthGrid(year, month, byDay) {
  const firstDay = new Date(year, month, 1);
  const leading = weekStartOffset(firstDay);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({length: leading}, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const value = byDay[iso];
    cells.push({day, iso, pnl: value?.pnl || 0, count: value?.count || 0, cls: value?.cls || 'be', cash: value?.cash || 0, cashCount: value?.cashCount || 0, cashType: value?.cashType || 'transfer'});
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({length: cells.length / 7}, (_, index) => cells.slice(index * 7, index * 7 + 7));
}

export function calendarMonthSummary(trades, year, month, cap = 0) {
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthTrades = closedCalendarTrades(trades).filter((trade) => trade.date?.slice(0, 7) === monthKey);
  const byDay = groupCalendarTradesByDay(monthTrades, cap);
  const outcomes = monthTrades.reduce((totals, trade) => {
    const outcome = classifyCalendarPnl(trade.pnl, cap);
    totals[outcome] += 1;
    return totals;
  }, {win: 0, loss: 0, be: 0});
  return {trades: monthTrades, byDay, netPnl: monthTrades.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0), activeDays: Object.keys(byDay).length, wins: outcomes.win, losses: outcomes.loss, breakeven: outcomes.be};
}

export function calendarWeeklyBreakdown(trades, year, month, cap = 0) {
  const summary = calendarMonthSummary(trades, year, month, cap);
  return buildCalendarMonthGrid(year, month, summary.byDay).map((cells, index) => {
    const active = cells.filter((cell) => cell?.count);
    const pnl = active.reduce((sum, cell) => sum + cell.pnl, 0);
    const wins = active.filter((cell) => cell.cls === 'win').length;
    const dated = cells.filter(Boolean);
    return {label: `Week ${index + 1}`, range: dated.length ? `${dated[0].iso}–${dated.at(-1).iso}` : '', pnl, winRate: active.length ? wins / active.length * 100 : 0, count: active.length, tradeCount: active.reduce((sum, cell) => sum + cell.count, 0), cells};
  });
}

const calendarDateFromISO = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
};
const calendarDateISO = (date) => date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '';

export function calendarWeeklyPerformance(trades, cap = 0, balance = 0) {
  const weeks = {};
  closedCalendarTrades(trades).forEach((trade) => {
    const date = calendarDateFromISO(trade.date);
    if (!date) return;
    const key = calendarDateISO(startOfDisplayWeek(date));
    const row = weeks[key] || {key, pnl: 0, wins: 0, count: 0};
    row.pnl += Number(trade.pnl) || 0;
    row.count += 1;
    if (classifyCalendarPnl(trade.pnl, cap) === 'win') row.wins += 1;
    weeks[key] = row;
  });
  return Object.values(weeks).sort((a, b) => a.key.localeCompare(b.key)).map((row) => {
    const start = calendarDateFromISO(row.key);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return {...row, endKey: calendarDateISO(end), winRate: row.count ? row.wins / row.count * 100 : 0, pctGain: balance ? row.pnl / balance * 100 : 0};
  });
}

export function calendarMonthlyPerformance(trades, cap = 0, balance = 0) {
  const months = {};
  closedCalendarTrades(trades).forEach((trade) => {
    const key = trade.date?.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(key || '')) return;
    const row = months[key] || {key, pnl: 0, wins: 0, count: 0};
    row.pnl += Number(trade.pnl) || 0;
    row.count += 1;
    if (classifyCalendarPnl(trade.pnl, cap) === 'win') row.wins += 1;
    months[key] = row;
  });
  return Object.values(months).sort((a, b) => a.key.localeCompare(b.key)).map((row) => ({...row, winRate: row.count ? row.wins / row.count * 100 : 0, pctGain: balance ? row.pnl / balance * 100 : 0}));
}

export function calendarDayOfWeekPerformance(trades, cap = 0) {
  const weekdays = {};
  closedCalendarTrades(trades).forEach((trade) => {
    const date = calendarDateFromISO(trade.date);
    if (!date) return;
    const dow = date.getDay();
    const row = weekdays[dow] || {dow, pnl: 0, wins: 0, count: 0};
    row.pnl += Number(trade.pnl) || 0;
    row.count += 1;
    if (classifyCalendarPnl(trade.pnl, cap) === 'win') row.wins += 1;
    weekdays[dow] = row;
  });
  return Object.values(weekdays).map((row) => ({...row, winRate: row.count ? row.wins / row.count * 100 : 0})).sort((a, b) => b.pnl - a.pnl);
}

// Calendar-contiguous ranges, with balances replayed before filtering the view.
export function monthlyPnlRange(trades, { balance = 0, year, range = 'year', now = new Date(), isWin = pnl => pnl > 0 } = {}) {
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const selectedYear = Number(year) || now.getFullYear();
  const grouped = new Map();
  for (const trade of trades) {
    const key = String(trade.date || '').slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) continue;
    const month = grouped.get(key) || { key, pnl: 0, count: 0, wins: 0 };
    const pnl = Number(trade.pnl) || 0;
    month.pnl += pnl;
    month.count++;
    if (isWin(pnl)) month.wins++;
    grouped.set(key, month);
  }
  const keys = [...grouped.keys()].sort();
  const indexOf = key => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1;
  const keyOf = index => `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`;
  const end = indexOf(keys.at(-1) > currentKey ? keys.at(-1) : currentKey);
  const yearEnd = Math.min(selectedYear * 12 + 11, end);
  const start = range === 'year' ? selectedYear * 12 : range === '12m' ? end - 11 : range === '3y' ? end - 35 : indexOf(keys[0] || currentKey);
  const last = range === 'year' ? yearEnd : end;
  let running = Number(balance) || 0;
  for (const key of keys) if (indexOf(key) < start) running += grouped.get(key).pnl;
  const rows = [];
  // An empty account stays empty, rather than implying months of activity.
  if (keys.length) for (let index = start; index <= last; index++) {
    const key = keyOf(index);
    const month = grouped.get(key) || { key, pnl: 0, count: 0, wins: 0 };
    const openingBalance = running;
    running += month.pnl;
    rows.push({ ...month, label: `${key.slice(5, 7)}/${key.slice(0, 4)}`, openingBalance, closingBalance: running, returnPct: openingBalance ? month.pnl / openingBalance * 100 : 0, winRate: month.count ? month.wins / month.count * 100 : 0 });
  }
  const active = rows.filter(month => month.count);
  const total = rows.reduce((sum, month) => sum + month.pnl, 0);
  const years = [...new Set(rows.map(month => month.key.slice(0, 4)))].map(value => {
    const months = rows.filter(month => month.key.startsWith(value));
    return { year: value, first: months[0].key, middle: months[Math.floor((months.length - 1) / 2)].key };
  });
  return { rows, years, total, average: total / Math.max(1, active.length), best: active.length ? active.reduce((a, b) => b.pnl > a.pnl ? b : a) : null, worst: active.length ? active.reduce((a, b) => b.pnl < a.pnl ? b : a) : null, positive: active.filter(month => month.pnl > 0).length, negative: active.filter(month => month.pnl < 0).length, activeCount: active.length };
}

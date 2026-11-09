// Presentation helpers for the phone Journal timeline and trade detail page.
const dayOf = trade => trade.date || trade.closeDate || '';
export const journalSortKey = trade => `${dayOf(trade)} ${trade.time || ''}`;
export const journalNewestFirst = trades => [...trades].sort((left, right) => journalSortKey(right).localeCompare(journalSortKey(left)));

export function journalMonths(trades = []) {
  const groups = new Map();
  journalNewestFirst(trades).forEach(trade => {
    const key = dayOf(trade).slice(0, 7) || 'undated';
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(trade);
  });
  return [...groups].map(([key, items]) => ({key, trades:items}));
}

export const journalWeekOfMonth = date => String(Math.ceil(Number(String(date).slice(8, 10)) / 7));

const unique = values => [...new Set(values.filter(Boolean))];
export function journalFilterOptions(trades = []) {
  return {
    instruments: unique(trades.map(trade => trade.asset)).sort(),
    years: unique(trades.map(trade => dayOf(trade).slice(0, 4))).sort().reverse(),
    months: unique(trades.map(trade => dayOf(trade).slice(5, 7))).sort(),
    sessions: unique(trades.map(trade => trade.entrySession || trade.session)).sort(),
    models: unique(trades.map(trade => trade.entryType || trade.confluenceSession)).sort(),
  };
}

export function journalHeldLabel(trade) {
  if(!trade.date || !trade.time || !trade.closeDate || !trade.closeTime) return null;
  const minutes = Math.round((Date.parse(`${trade.closeDate}T${trade.closeTime}`) - Date.parse(`${trade.date}T${trade.time}`)) / 60000);
  if(!Number.isFinite(minutes) || minutes < 0) return null;
  if(minutes < 60) return `${minutes}m`;
  if(minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d ${Math.floor(minutes % 1440 / 60)}h`;
}

// Gross, costs and per-account figures, preferring the per-account record when one exists.
export function journalTradeMoney(trade, balances = []) {
  const results = trade.balanceResults || [];
  const number = value => Number(value) || 0;
  const commission = results.length ? results.reduce((sum, row) => sum + number(row.commission), 0) : number(trade.commission);
  const swap = results.length ? results.reduce((sum, row) => sum + number(row.swap), 0) : number(trade.swap);
  const gross = results.length ? results.reduce((sum, row) => sum + number(row.grossPnl), 0) : trade.grossPnl ?? null;
  const accounts = results.map(row => ({
    id: row.balanceId,
    name: balances.find(balance => balance.id === row.balanceId)?.name || 'Account',
    pnl: row.netPnl ?? (number(row.grossPnl) - number(row.commission) - number(row.swap)),
  }));
  return {gross, costs: commission + swap, accounts};
}

export function journalActiveFilters(filters = {}) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const results = {win:'Wins', loss:'Losses', be:'Break-even', running:'Running'};
  const chips = [];
  if(filters.result && filters.result !== 'All') chips.push({key:'result', label:results[filters.result] || filters.result});
  if(filters.direction && filters.direction !== 'All') chips.push({key:'direction', label:filters.direction});
  if(filters.review && filters.review !== 'All') chips.push({key:'review', label:filters.review === 'needs' ? 'Needs review' : 'Reviewed'});
  if(filters.instrument) chips.push({key:'instrument', label:filters.instrument});
  if(filters.year) chips.push({key:'year', label:filters.year});
  if(filters.month) chips.push({key:'month', label:months[Number(filters.month) - 1] || filters.month});
  if(filters.week) chips.push({key:'week', label:`Week ${filters.week}`});
  (filters.sessions || []).forEach(session => chips.push({key:'sessions', value:session, label:session}));
  if(filters.model) chips.push({key:'model', label:filters.model});
  return chips;
}

export function journalClearFilter(filters, chip) {
  if(chip.key === 'sessions') return {...filters, sessions:filters.sessions.filter(item => item !== chip.value)};
  if(chip.key === 'month') return {...filters, month:'', week:''};
  return {...filters, [chip.key]:['result','direction','review'].includes(chip.key) ? 'All' : ''};
}

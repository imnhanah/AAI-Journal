// Presentation helpers for the phone Analytics screen. Trade scope, P&L and
// grades stay owned by AnalyticsPage; this only shapes them for display.
const dateOf = trade => trade.closeDate || trade.date || '';
const round2 = value => Math.round((Number(value) || 0) * 100) / 100;

export function pulseMoney(value, currency = 'USD', signed = true) {
  const amount = Number(value) || 0;
  const text = new Intl.NumberFormat(undefined, {style:'currency', currency, minimumFractionDigits:2, maximumFractionDigits:2}).format(Math.abs(amount));
  return `${amount < 0 ? '-' : signed && amount > 0 ? '+' : ''}${text}`;
}

export function pulseMonthly(trades = []) {
  const totals = trades.reduce((all, trade) => {
    const key = dateOf(trade).slice(0, 7);
    if (key) all[key] = (all[key] || 0) + (Number(trade.pnl) || 0);
    return all;
  }, {});
  return Object.keys(totals).sort().slice(-12).map(key => ({
    key, value: round2(totals[key]),
    label: new Date(`${key}-15T12:00:00`).toLocaleDateString(undefined, {month:'short'}),
  }));
}

// Round tick values that always include zero, for the bar charts' left axis.
export function pulseTicks(values = []) {
  const high = Math.max(0, ...values), low = Math.min(0, ...values), span = (high - low) || 1;
  const rough = span / 3, power = 10 ** Math.floor(Math.log10(rough)), unit = rough / power;
  const step = (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
  const top = Math.ceil(high / step) * step, bottom = Math.floor(low / step) * step, ticks = [];
  for (let tick = top; tick >= bottom - step / 2; tick -= step) ticks.push(Math.round(tick * 100) / 100);
  return { ticks, high: top || step, low: bottom };
}

const tile = (label, value, tone = '') => ({ label, value, tone });
const toneOf = value => Number(value) > 0 ? 'pos' : Number(value) < 0 ? 'neg' : '';
const statRow = (id, name, row, grade, currency, pnlLabel) => {
  const winRate = Number(row.winRate) || 0, losses = (row.count || 0) - (row.wins || 0);
  return {
    id, name, grade, value: row.netPnl,
    sub: `${row.count} trade${row.count === 1 ? '' : 's'} · ${winRate.toFixed(0)}% win rate`,
    details: [
      tile(pnlLabel, pulseMoney(row.netPnl, currency), toneOf(row.netPnl)),
      tile('Win rate', `${winRate.toFixed(0)}%`, winRate >= 50 ? 'pos' : 'amb'),
      tile('Avg RR', Number.isFinite(row.avgRR) ? `${row.avgRR.toFixed(2)}R` : '—'),
      tile('Record', `${row.wins || 0}W / ${Math.max(0, losses)}L`),
      tile('Best trade', Number.isFinite(row.best) ? pulseMoney(row.best, currency) : '—', toneOf(row.best)),
      tile('Worst trade', Number.isFinite(row.worst) ? pulseMoney(row.worst, currency) : '—', toneOf(row.worst)),
    ],
  };
};

export function pulseSessionRows(sessionStats = [], trades = []) {
  return sessionStats.filter(row => row.count > 0).map(row => {
    const matching = trades.filter(trade => (trade.entrySession || trade.session) === row.session);
    const pnls = matching.map(trade => Number(trade.pnl) || 0);
    return {
      ...row,
      best: pnls.length ? Math.max(...pnls) : undefined,
      worst: pnls.length ? Math.min(...pnls) : undefined,
      avgRR: Number.isFinite(row.avgRR) ? row.avgRR : matching.length ? matching.reduce((sum, trade) => sum + (Number(trade.rr) || 0), 0) / matching.length : undefined,
    };
  }).sort((left, right) => right.netPnl - left.netPnl);
}

const planDirection = bias => /bull/i.test(bias || '') ? 'BUY' : /bear/i.test(bias || '') ? 'SELL' : null;
export function pulseMarkupRows(markups = [], trades = [], currency = 'USD', statusFor = status => status) {
  return [...markups].sort((left, right) => String(right.date || '').localeCompare(String(left.date || ''))).map(markup => {
    const linked = trades.filter(trade => trade.premarketMarkupId === markup.id);
    const value = linked.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0);
    const wins = linked.filter(trade => Number(trade.pnl) > 0).length;
    const direction = planDirection(markup.bias);
    const matched = direction ? linked.filter(trade => trade.direction === direction).length : 0;
    const state = linked.length ? 'Executed' : statusFor(markup.status) || 'Planned';
    const execution = linked.length ? `${linked.length} trade${linked.length === 1 ? '' : 's'} · ${Math.round(wins / linked.length * 100)}% WR` : 'Waiting for trade';
    const bias = markup.bias || 'Neutral';
    return {
      id: markup.id, name: `${markup.instrument || 'Markup'} · ${markup.date || '—'}`,
      grade: /bull/i.test(bias) ? 'Bull' : /bear/i.test(bias) ? 'Bear' : 'Flat', badGrade: /bear/i.test(bias),
      value, sub: `${state} · ${execution}`,
      details: [
        tile('State', state, state === 'Executed' ? 'pos' : ''),
        tile('Outcome', linked.length ? pulseMoney(value, currency) : '—', toneOf(value)),
        tile('Status', linked.length ? 'Realised' : 'Pending'),
        tile('Direction', bias),
        tile('Execution', execution.split(' · ')[0]),
        tile('Match', linked.length && direction ? `${Math.round(matched / linked.length * 100)}%` : '—'),
      ],
    };
  });
}

export function pulseBreakdown(by, {tagStats = [], confluenceStats = [], instrumentStats = [], sessionStats = [], trades = [], markups = [], gradeFor = () => '', statusFor, currency = 'USD'}) {
  const grade = row => row.grade || gradeFor(row.winRate, row.netPnl, row.count);
  if (by === 'model') return tagStats.map(row => statRow(row.tag, row.tag, row, grade(row), currency, 'Net P&L'));
  if (by === 'conf') return confluenceStats.map(row => statRow(row.name, row.name, row, grade(row), currency, 'Tagged P&L'));
  if (by === 'inst') return instrumentStats.map(row => statRow(row.asset, row.asset, row, grade(row), currency, 'Net P&L'));
  if (by === 'session') return pulseSessionRows(sessionStats, trades).map(row => statRow(row.session, row.session, row, grade(row), currency, 'Net P&L'));
  return pulseMarkupRows(markups, trades, currency, statusFor);
}

export function pulseDrawdown(equityData = []) {
  if (!equityData.length) return null;
  const current = Number(equityData.at(-1).equity) || 0;
  const peak = Math.max(...equityData.map(point => Number(point.equity) || 0));
  if (peak <= 0 || current >= peak) return null;
  return { peak, current, amount: peak - current, percent: (peak - current) / peak * 100 };
}

// Notes only appear when the journal has something real to say.
export function pulseInsights({tagStats = [], confluenceStats = [], equityData = [], guardrails = {}, currency = 'USD'}) {
  const notes = [];
  const sampled = tagStats.filter(row => row.count >= 2);
  if (sampled.length >= 2) {
    const weakest = [...sampled].sort((left, right) => left.winRate - right.winRate || left.netPnl - right.netPnl)[0];
    notes.push({id:'trim', tone:'amber', icon:'chart', title:'Trim first', strong:weakest.tag, text:` wins ${weakest.winRate.toFixed(0)}% of its trades and made ${pulseMoney(weakest.netPnl, currency, false)} from ${weakest.count}.`, action:`Open ${weakest.tag}`, jump:{by:'model', id:weakest.tag}});
  }
  const costliest = [...confluenceStats].sort((left, right) => left.netPnl - right.netPnl)[0];
  if (costliest?.netPnl < 0) notes.push({id:'tag', tone:'red', icon:'warn', title:'Costliest tag', strong:costliest.name, text:` has cost ${pulseMoney(Math.abs(costliest.netPnl), currency, false)}, the lowest tagged result.`, action:'See confluences', jump:{by:'conf', id:costliest.name}});
  const drawdown = pulseDrawdown(equityData);
  if (drawdown) notes.push({id:'drawdown', tone:'purple', icon:'chart', title:'Drawdown', lead:'You sit ', strong:`${drawdown.percent.toFixed(2)}% below`, text:` the ${pulseMoney(drawdown.peak, currency, false)} high, ${pulseMoney(drawdown.amount, currency, false)} to win back.`, action:'See the equity curve', jump:{top:true}});
  const configured = guardrails.dailyLossLimitPct || guardrails.monthlyLossLimitPct;
  const caps = [guardrails.dailyLossLimitPct && `daily ${guardrails.dailyLossLimitPct}%`, guardrails.monthlyLossLimitPct && `monthly ${guardrails.monthlyLossLimitPct}%`].filter(Boolean).join(' and ');
  notes.push(guardrails.tradeEntryLocked
    ? {id:'risk', tone:'red', icon:'shield', title:'Risk limits', strong:'A loss limit is active.', text:' Review your account settings before entering another trade.', action:'Open risk settings', settings:true}
    : {id:'risk', tone:'purple', icon:'shield', title:'Risk limits', strong:configured ? 'Within your limits.' : 'No loss limits set.', text:configured ? ` Watching your ${caps} loss caps.` : ' Add daily and monthly caps when you are ready.', action:configured ? 'Review risk settings' : 'Set up risk limits', settings:true});
  return notes;
}

export function psychologyMetrics(trades, breakevenCap = 0) {
  const rows = [...trades].sort((a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`));
  const moods = new Map(), mistakes = new Map(), shifts = new Map();
  let tagged = 0, clean = 0, mistakeTrades = 0, checks = 0, checked = 0, statePairs = 0, stable = 0;
  const recovery = [];
  rows.forEach((trade, index) => {
    const rules = trade.ruleEvaluations || [];
    const before = String(trade.moodBefore || '').trim(), after = String(trade.moodAfter || '').trim();
    const pnl = Number(trade.pnl) || 0;
    const tags = [...new Set(trade.mistakes || [])];
    const passed = rules.filter(rule => rule.checked).length;
    checks += rules.length; checked += passed;
    if (tags.length) mistakeTrades++;
    tags.forEach(tag => mistakes.set(tag, (mistakes.get(tag) || 0) + 1));
    if (before) {
      tagged++;
      if (rules.length && passed === rules.length && !tags.length) clean++;
      const mood = moods.get(before) || {mood: before, count: 0, wins: 0, pnl: 0, evaluated: 0, checks: 0, checked: 0};
      mood.count++; mood.wins += pnl > breakevenCap ? 1 : 0; mood.pnl += pnl;
      mood.evaluated += rules.length ? 1 : 0; mood.checks += rules.length; mood.checked += passed;
      moods.set(before, mood);
    }
    if (before && after) {
      statePairs++;
      if (before === after) stable++;
      else {
        const key = `${before} → ${after}`;
        const shift = shifts.get(key) || {label: key, count: 0, pnl: 0};
        shift.count++; shift.pnl += pnl; shifts.set(key, shift);
      }
    }
    if (pnl < -breakevenCap && rows[index + 1]) recovery.push(rows[index + 1]);
  });
  const percent = (part, total) => total ? part / total * 100 : null;
  const moodRows = [...moods.values()].map(mood => ({...mood, winRate: percent(mood.wins, mood.count), adherence: percent(mood.checked, mood.checks)})).sort((a, b) => b.count - a.count || a.mood.localeCompare(b.mood));
  const leading = moodRows.filter(mood => mood.count >= 3).sort((a, b) => b.winRate - a.winRate || b.count - a.count)[0] || null;
  return {
    total: rows.length, tagged, clean, mistakeTrades, moodRows, leading,
    coverage: percent(tagged, rows.length), cleanRate: percent(clean, rows.length), mistakeRate: percent(mistakeTrades, rows.length),
    mistakes: [...mistakes].map(([name, count]) => ({name, count, share: percent(count, rows.length)})).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    shifts: [...shifts.values()].sort((a, b) => b.count - a.count), statePairs, changed: statePairs - stable, stableRate: percent(stable, statePairs),
    overallAdherence: percent(checked, checks), evaluated: rows.filter(trade => trade.ruleEvaluations?.length).length,
    recoveryCount: recovery.length, recoveryWinRate: percent(recovery.filter(trade => Number(trade.pnl) > breakevenCap).length, recovery.length),
    recoveryCleanRate: percent(recovery.filter(trade => !trade.mistakes?.length).length, recovery.length),
    recoveryPnl: recovery.length ? recovery.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0) / recovery.length : null,
  };
}

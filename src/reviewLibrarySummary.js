export function reviewLibrarySignals(months, quarters, annual) {
  const active = months.filter(period => period.stats.total > 0);
  const ranked = [...active].sort((a, b) => b.stats.returnPct - a.stats.returnPct);
  const pending = active.filter(period => period.stats.reviewed < period.stats.total);
  const complete = active.filter(period => period.stats.reviewed === period.stats.total);
  const ratings = annual.stats.trades.map(trade => Number(trade.rating)).filter(value => Number.isFinite(value) && value > 0 && value <= 5);
  let winningStreak = 0;
  const latestActive = months.findLastIndex(period => period.stats.total > 0);
  for (let index = latestActive; index >= 0; index -= 1) {
    if (!months[index].stats.total || months[index].stats.netPnl <= 0) break;
    winningStreak += 1;
  }
  return {
    best: ranked[0], weakest: ranked.at(-1), pending, complete,
    activeCount: active.length,
    averageRating: ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null,
    ratedCount: ratings.length, winningStreak,
    completedQuarters: quarters.filter(period => period.stats.total && period.stats.reviewed === period.stats.total).length,
    bestQuarter: [...quarters].filter(period => period.stats.total).sort((a, b) => b.stats.returnPct - a.stats.returnPct)[0],
    highestWinQuarter: [...quarters].filter(period => period.stats.total).sort((a, b) => b.stats.winRate - a.stats.winRate)[0],
  };
}

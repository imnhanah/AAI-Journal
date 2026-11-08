// Display helpers for the phone Psychology page. Nothing here changes a stored value.
export const moodBarTone = rate => rate == null ? 'is-neutral' : rate >= 60 ? 'is-gain' : rate >= 40 ? 'is-amber' : 'is-drop';

export function holdComparison(winHold, lossHold) {
  if (winHold == null || lossHold == null) return 'Add entry and exit times to compare how long you hold winners and losers.';
  if (!winHold && !lossHold) return 'Winners and losers are held for about the same time.';
  const ratio = winHold >= lossHold ? winHold / Math.max(lossHold, 1) : lossHold / Math.max(winHold, 1);
  if (ratio < 1.1) return 'Winners and losers are held for about the same time.';
  return winHold >= lossHold ? `Winners are held about ${ratio.toFixed(1)}× longer than losers.` : `Losers are held about ${ratio.toFixed(1)}× longer than winners.`;
}

export function holdWidths(winHold, lossHold) {
  const longest = Math.max(winHold || 0, lossHold || 0);
  return longest ? {win:(winHold || 0) / longest * 100, loss:(lossHold || 0) / longest * 100} : {win:0, loss:0};
}

// Chart coordinates for real equity and the target baseline, on one shared scale.
export function growthChart(rows, width = 340, height = 190, left = 56, right = 10, top = 10, bottom = 26) {
  const values = rows.flatMap(row => [Number(row.actual), Number(row.target)]).filter(Number.isFinite);
  if (!values.length) return null;
  const low = Math.min(...values), high = Math.max(...values), spare = (high - low || Math.abs(high) || 100) * .15;
  const min = low - spare, max = high + spare;
  const x = index => rows.length > 1 ? left + index / (rows.length - 1) * (width - left - right) : (left + width - right) / 2;
  const y = value => top + (1 - (value - min) / (max - min)) * (height - top - bottom);
  const line = key => rows.map((row, index) => `${index ? 'L' : 'M'}${x(index)} ${y(Number(row[key]))}`).join(' ');
  return {x, y, actual:line('actual'), target:line('target'), area:`${line('actual')} V${height - bottom} H${x(0)} Z`, ticks:[0, .5, 1].map(step => max - step * (max - min)), bottom:height - bottom, left, right:width - right, height};
}

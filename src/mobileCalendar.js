export function formatCompactAmount(value) {
  const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
  const absolute = Math.abs(amount);
  const unit = absolute >= 1e6 ? 1e6 : absolute >= 1e3 ? 1e3 : 1;
  const suffix = unit === 1e6 ? 'M' : unit === 1e3 ? 'K' : '';
  const decimals=absolute>=10000&&absolute<1000000?0:1;
  const number = unit === 1 ? Math.round(absolute).toString() : (absolute / unit).toFixed(decimals).replace(/\.0$/, '');
  return `${amount < 0 ? '-' : '+'}${number}${suffix}`;
}
// Compatibility for existing consumers; both names use one implementation.
export const compactCalendarAmount=formatCompactAmount;

// Merge adjacent quiet weeks only; never hide an active week between them.
export function mobileCalendarWeeks(snapshots) {
  return snapshots.reduce((rows, snapshot, index) => {
    const previous = rows.at(-1);
    if (!snapshot.count && previous && !previous.snapshot.count) previous.end = index + 1;
    else rows.push({start: index + 1, end: index + 1, snapshot});
    return rows;
  }, []);
}

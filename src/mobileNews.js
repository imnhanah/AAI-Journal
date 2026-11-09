// Presentation helpers for the phone News screen.
export const newsWeekTitle = offset => offset === 0 ? 'This week' : offset === 1 ? 'Next week' : offset === -1 ? 'Last week' : offset < 0 ? `${Math.abs(offset)} weeks ago` : `In ${offset} weeks`;

export function newsEventTiming(event, now = Date.now()) {
  const time = Date.parse(event?.isoDate);
  return Number.isFinite(time) && time < now ? 'Past' : 'Upcoming';
}

export function newsDayTiming(dayKey, todayKey = new Date().toDateString()) {
  if(dayKey === todayKey) return 'Today';
  return new Date(dayKey) < new Date(todayKey) ? 'Past' : 'Upcoming';
}

const IMPACT_ORDER = ['high', 'medium', 'low', 'holiday'];
// Dots show the day's most important events first when they will not all fit.
export function newsImpactDots(events = [], limit = 4) {
  return [...events].map(event => event.impact).sort((left, right) => IMPACT_ORDER.indexOf(left) - IMPACT_ORDER.indexOf(right)).slice(0, limit);
}

export function newsFilterCount(filters, categories = [], allCategories = [], weekOffset = 0) {
  const impactChanged = !filters.impact.high || !filters.impact.medium || filters.impact.low;
  return (filters.currencies.length ? 1 : 0) + (impactChanged ? 1 : 0) + (categories.length !== allCategories.length ? 1 : 0) + (weekOffset !== 0 ? 1 : 0);
}

export const START_PAGES = ['last', 'dashboard', 'markups', 'tradelog', 'reviews', 'analytics', 'calendar', 'psychology', 'news', 'challenge', 'finance', 'backtest', 'management'];
export function normaliseDisplayPreferences(metadata = {}) {
  return { weekStart: metadata.week_start === 'sunday' ? 'sunday' : 'monday', startPage: START_PAGES.includes(metadata.start_page) ? metadata.start_page : 'dashboard', hideBalances: metadata.hide_balances === true };
}
// The journal already uses render-scoped regional and currency configuration.
// This configuration is presentation-only; savings windows never read it.
let current = normaliseDisplayPreferences();
export function setDisplayPreferences(preferences) { current = preferences; }
export function displayPreferences() { return current; }
export function weekStartOffset(date, weekStart = current.weekStart) { return (date.getDay() - (weekStart === 'sunday' ? 0 : 1) + 7) % 7; }
export function startOfDisplayWeek(date, weekStart = current.weekStart) {
  const start = new Date(date); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - weekStartOffset(start, weekStart)); return start;
}
export function displayWeekdays(weekStart = current.weekStart) { return weekStart === 'sunday' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; }
export function resolveStartPage(metadata, lastPage, available = START_PAGES) {
  const preference = normaliseDisplayPreferences(metadata).startPage;
  const selected = preference === 'last' ? (lastPage === 'insights' ? 'psychology' : lastPage) : preference;
  return selected !== 'last' && available.includes(selected) ? selected : 'dashboard';
}
export function displayMetadata(preferences) { return {week_start: preferences.weekStart, start_page: preferences.startPage, hide_balances: preferences.hideBalances}; }
const moneyPattern = /[+−-]?(?:US\$|CA\$|A\$|NZ\$|HK\$|S\$|[$€£¥₵₹₦₩₽₺]|(?:USD|EUR|GBP|JPY|CAD|AUD|NZD|CHF|GHS|NGN|INR|ZAR|AED)\s+)[\s\u00a0]*[+−-]?\d(?:[\d,.]|[ \u00a0\u202f](?=\d{3}(?:[^\d]|$)))*(?:[kKmMbB](?!\w))?/g;
export function maskMoneyText(text) { return String(text).replace(moneyPattern, match => `${match.match(/(?:US\$|CA\$|A\$|NZ\$|HK\$|S\$|[$€£¥₵₹₦₩₽₺]|[A-Z]{3})/)?.[0] || ''}••••`); }

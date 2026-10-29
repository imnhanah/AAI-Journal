export const NEWS_FILTER_KEY = "tj:news-filters:v1";
export const NEWS_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"];
export const DEFAULT_NEWS_FILTERS = { impact: { high: true, medium: true, low: false }, currencies: [] };

export function normalizeNewsFilters(value) {
  return {
    impact: Object.fromEntries(["high", "medium", "low"].map((level) => [level, typeof value?.impact?.[level] === "boolean" ? value.impact[level] : DEFAULT_NEWS_FILTERS.impact[level]])),
    currencies: [...new Set(Array.isArray(value?.currencies) ? value.currencies.filter((currency) => NEWS_CURRENCIES.includes(currency)) : [])],
  };
}

export function toggleNewsCurrency(selected, currency) {
  if (currency === "ALL") return [];
  if (!NEWS_CURRENCIES.includes(currency)) return selected;
  return selected.includes(currency) ? selected.filter((item) => item !== currency) : [...selected, currency];
}

export function matchesNewsFilters(event, filters) {
  return Boolean((filters.impact[event.impact] || event.impact === "holiday") &&
    (!filters.currencies.length || filters.currencies.includes(event.currency) || event.currency === "All"));
}

export function readNewsFilters(storage) {
  try { return normalizeNewsFilters(JSON.parse(storage.getItem(NEWS_FILTER_KEY))); }
  catch { return normalizeNewsFilters(null); }
}

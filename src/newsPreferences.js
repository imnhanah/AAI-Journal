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

// Keep this preference per signed-in profile.  It deliberately remains in
// browser storage on logout, so a returning user keeps the market focus they
// chose without leaking that choice to another profile on the same device.
export function newsFilterKey(userId) {
  return userId ? `${NEWS_FILTER_KEY}:${encodeURIComponent(userId)}` : NEWS_FILTER_KEY;
}

export function readNewsFilters(storage, userId) {
  try {
    const saved = storage.getItem(newsFilterKey(userId));
    // Preserve a previously saved browser-wide preference once for existing
    // users. Subsequent saves move it to that user's own key.
    const legacy = userId && saved == null ? storage.getItem(NEWS_FILTER_KEY) : saved;
    return normalizeNewsFilters(JSON.parse(legacy));
  } catch { return normalizeNewsFilters(null); }
}

export function saveNewsFilters(storage, filters, userId) {
  storage.setItem(newsFilterKey(userId), JSON.stringify(normalizeNewsFilters(filters)));
  // The old key was shared by every profile. Once the active profile has
  // claimed it, remove it so a different profile starts with its own choice.
  if (userId) storage.removeItem?.(NEWS_FILTER_KEY);
}

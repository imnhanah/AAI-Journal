const VERSION = 1;
const keyFor = (userId) => `tj:journal-cache:${VERSION}:${userId}`;

// Screenshots can be large data URLs. Cache the journal records locally but
// deliberately leave image payloads out so localStorage stays small.
const withoutImages = (items = []) => items.map((item) => {
  if (!item || typeof item !== "object") return item;
  const compactShots = shots => shots.filter(shot => !String(typeof shot === "string" ? shot : shot?.src || "").startsWith("data:image/"));
  if (Array.isArray(item.screenshots)) { const screenshots = compactShots(item.screenshots); return { ...item, _cachedImagePayload: screenshots.length !== item.screenshots.length, screenshots }; }
  if (item.screenshots && typeof item.screenshots === "object") {
    const screenshots = Object.fromEntries(Object.entries(item.screenshots).map(([key, value]) => [key, Array.isArray(value) ? compactShots(value) : value]));
    const omitted = Object.entries(item.screenshots).some(([key, value]) => Array.isArray(value) && value.length !== screenshots[key].length);
    return { ...item, _cachedImagePayload: omitted, screenshots };
  }
  return item;
});

export function readJournalCache(userId) {
  try {
    const cached = JSON.parse(localStorage.getItem(keyFor(userId)) || "null");
    return cached?.data?.accounts ? cached : null;
  } catch { return null; }
}

export function writeJournalCache(userId, data, syncSignature = null) {
  try {
    const compact = {
      ...data,
      accounts: (data.accounts || []).map((account) => ({ ...account, trades: withoutImages(account.trades) })),
      markups: withoutImages(data.markups),
      reviews: withoutImages(data.reviews),
    };
    localStorage.setItem(keyFor(userId), JSON.stringify({ cachedAt: new Date().toISOString(), syncSignature, data: compact }));
    return true;
  } catch { return false; }
}

export function clearJournalCache(userId) {
  try { localStorage.removeItem(keyFor(userId)); } catch {}
}

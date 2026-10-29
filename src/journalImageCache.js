const DATABASE = "tj-journal-images";
import { privateCache } from './privateCacheRuntime';
const STORE = "snapshots";

const requestValue = request => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const openDatabase = () => new Promise((resolve, reject) => {
  if (!window.indexedDB) { reject(new Error("IndexedDB is unavailable")); return; }
  const request = window.indexedDB.open(DATABASE, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const imageSnapshot = (data = {}) => ({
  trades: Object.fromEntries((data.accounts || []).flatMap(account => (account.trades || []).map(trade => [trade.id, trade.screenshots]))),
  markups: Object.fromEntries((data.markups || []).map(markup => [markup.id, markup.screenshots])),
  reviews: Object.fromEntries((data.reviews || []).map(review => [review.id, review.screenshots])),
});

// Never replace current revisioned references with an old cached screenshot.
const restore = (item, saved, revisioned) => {
  if (revisioned && !item._cachedImagePayload) return item.screenshots;
  return JSON.stringify(item.screenshots || null).includes('tj-image:') ? item.screenshots : (saved ?? item.screenshots);
};

export async function writeJournalImageCache(userId, data) {
  const ticket = privateCache.token();
  if (ticket.owner !== userId) return false;
  try {
    const database = await openDatabase();
    if (!privateCache.valid(ticket)) { database.close(); return false; }
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(imageSnapshot(data), userId);
    await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
    database.close();
    return true;
  } catch { return false; }
}

export async function hydrateJournalImages(userId, data) {
  const ticket = privateCache.token();
  if (ticket.owner !== userId) return {data,found:false};
  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE, "readonly");
    const images = await requestValue(transaction.objectStore(STORE).get(userId));
    database.close();
    if (!privateCache.valid(ticket)) return {data,found:false};
    if (!images) return { data, found: false };
    return {
      found: true,
      data: {
        ...data,
        accounts: (data.accounts || []).map(account => ({ ...account, trades: (account.trades || []).map(trade => ({ ...trade, screenshots: restore(trade, images.trades?.[trade.id], data.imageReferences) })) })),
        markups: (data.markups || []).map(markup => ({ ...markup, screenshots: restore(markup, images.markups?.[markup.id], data.imageReferences) })),
        reviews: (data.reviews || []).map(review => ({ ...review, screenshots: restore(review, images.reviews?.[review.id], data.imageReferences) })),
      },
    };
  } catch { return { data, found: false }; }
}

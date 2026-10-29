import { createPrivateCache } from './privateCache';
import { clearJournalCache } from './journalCache';

const memory = new Map();
export const openPrivateDatabase = () => new Promise((resolve, reject) => {
  const request = indexedDB.open('tj-cloud-cache', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('records');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const owned = (key, user) => key === `journal:${user}` || String(key).startsWith(`journal:${user}:`) || (String(key).startsWith('tj-image:') && (() => { try { return JSON.parse(String(key).slice(9)).user === user; } catch { return false; } })());
async function evict(user, predicate) {
  const matches = key => owned(key, user) && predicate(key);
  for (const key of memory.keys()) if (matches(key)) memory.delete(key);
  try {
    const db = await openPrivateDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('records', 'readwrite');
      const request = tx.objectStore('records').openCursor();
      request.onsuccess = () => { const cursor = request.result; if (!cursor) return; if (matches(cursor.key)) cursor.delete(); cursor.continue(); };
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* Disabled IndexedDB has no persistent cache to remove. */ }
  // Legacy inline-image snapshots have no per-image revision keys. Discard
  // their cached copy on changes rather than restoring an old/deleted image.
  await clearLegacyImages(user);
}
async function clearLegacy(user) {
  clearJournalCache(user);
  try { if (JSON.parse(localStorage.getItem('tj:journal-change') || 'null')?.user === user) localStorage.removeItem('tj:journal-change'); } catch {}
  await clearLegacyImages(user);
}
async function clearLegacyImages(user) {
  // Remove only this owner's cached copy, never journal data in Supabase.
  try {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('tj-journal-images', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
      request.onsuccess = () => resolve(request.result); request.onerror = reject;
    });
    await new Promise((resolve, reject) => { const tx = db.transaction('snapshots','readwrite'); tx.objectStore('snapshots').delete(user); tx.oncomplete = resolve; tx.onerror = reject; });
    db.close();
  } catch { /* Memory-only browser. */ }
}
export const privateCache = createPrivateCache({
  async read(key) {
    if (memory.has(key)) return memory.get(key);
    try { const db = await openPrivateDatabase(); const value = await new Promise((resolve, reject) => { const request = db.transaction('records').objectStore('records').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); db.close(); return value; } catch { return undefined; }
  },
  async write(key, value, valid) {
    if (!valid()) return;
    memory.set(key, value);
    try { const db = await openPrivateDatabase(); if (!valid()) { db.close(); return; } await new Promise((resolve, reject) => { const tx = db.transaction('records','readwrite'); tx.objectStore('records').put(value,key); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); db.close(); } catch { /* Memory cache still works. */ }
  },
  evict,
  async clear(user) { await evict(user, () => true); await clearLegacy(user); },
});

export async function activatePrivateUser(user) { await privateCache.activate(user || null); }
export function notifyJournalMutation(table, mediaChanged = false, id = null, remote = false) {
  const user = privateCache.token().owner;
  void privateCache.invalidate(key => {
    if (table === 'accounts' && mediaChanged && key.startsWith('tj-image:')) return true;
    if (table === 'period_reviews' && key.startsWith(`journal:${user}:period_reviews:`)) return !id || key.includes(`:${id}:`);
    if (!mediaChanged || !key.startsWith('tj-image:')) return false;
    try { const ref = JSON.parse(key.slice(9)); return ref.table === table && (!id || ref.id === id); } catch { return true; }
  });
  if (!user) return;
  if (!remote) { try { localStorage.setItem('tj:journal-change', JSON.stringify({ user, table, mediaChanged, id, nonce: crypto.randomUUID() })); } catch {} }
  else window.dispatchEvent(new CustomEvent('tj:journal-changed'));
}
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key !== 'tj:journal-change' || !event.newValue) return;
  try { const message = JSON.parse(event.newValue); if (message.user === privateCache.token().owner) notifyJournalMutation(message.table, message.mediaChanged, message.id, true); } catch {}
});

// One inbox for the whole app. Any part of the app calls postNotice(); the bell listens, keeps a short record,
// shows a 6 second toast (banner on phones) and lets the member read, act on, clear and undo.
// Admin messages come from the server and are merged in by the bell; they ignore the member's switch.

export const NOTICE_EVENT = 'aai:notice';
export const NOTICE_TOAST_MS = 6000;
export const NOTICE_UNDO_MS = 6000;
export const NOTICE_LIMIT = 40;
export const NOTICE_KINDS = ['guard', 'claim', 'fail', 'savings', 'missed', 'goal', 'news'];

const storeKey = userId => `aai-notices:v1:${userId}`;
const switchKey = userId => `aai-notices-on:v1:${userId}`;

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 220);

// postNotice({ key, kind, title, text, urgent, to, label })
//   key    one stable string per event, so the same event never lands twice
//   urgent shows under "Needs you now" until it is read
//   to     where the action goes: 'finance' | 'challenge' | 'analytics' | 'news'
export function postNotice(notice) {
  if (typeof window === 'undefined' || !notice?.key) return;
  window.dispatchEvent(new CustomEvent(NOTICE_EVENT, { detail: notice }));
}

export function normalizeNotice(raw, now = Date.now()) {
  if (!raw || !raw.key || !NOTICE_KINDS.includes(raw.kind)) return null;
  const title = clean(raw.title);
  if (!title) return null;
  return { id: `app:${clean(raw.key)}`, source: 'app', kind: raw.kind, title, text: clean(raw.text), urgent: !!raw.urgent, to: raw.to || '', label: clean(raw.label), quiet: !!raw.quiet, at: Number.isFinite(raw.at) ? raw.at : now, read: false };
}

export function readNotices(userId, storage = globalThis.localStorage) {
  if (!userId) return [];
  try {
    const saved = JSON.parse(storage?.getItem(storeKey(userId)) || '[]');
    return Array.isArray(saved) ? saved.filter(item => item && item.id && item.title && item.source === 'app').slice(0, NOTICE_LIMIT) : [];
  } catch { return []; }
}

export function writeNotices(userId, items, storage = globalThis.localStorage) {
  if (!userId) return;
  try { storage?.setItem(storeKey(userId), JSON.stringify(items.slice(0, NOTICE_LIMIT))); } catch { /* A blocked device keeps the in-session list. */ }
}

export function noticesSwitchedOn(userId, storage = globalThis.localStorage) {
  try { return storage?.getItem(switchKey(userId)) !== 'off'; } catch { return true; }
}

export function saveNoticesSwitch(userId, on, storage = globalThis.localStorage) {
  try { storage?.setItem(switchKey(userId), on ? 'on' : 'off'); } catch { /* Keep the in-session choice. */ }
}

// Each event is announced once per member, even after it was cleared. Returns true the first time a key is seen.
export function claimNoticeKey(userId, id, storage = globalThis.localStorage) {
  const key = `aai-notices-seen:v1:${userId}`;
  let seen = [];
  try { const saved = JSON.parse(storage?.getItem(key) || '[]'); if (Array.isArray(saved)) seen = saved; } catch { /* Fall through with an empty memory. */ }
  if (seen.includes(id)) return false;
  try { storage?.setItem(key, JSON.stringify([...seen, id].slice(-300))); } catch { /* Keep going; the in-list check still stops repeats. */ }
  return true;
}

// Adds a notice unless that event is already in the list. Newest first, capped.
export function addNotice(items, notice) {
  if (!notice || items.some(item => item.id === notice.id)) return { items, added: false };
  return { items: [notice, ...items].sort((a, b) => b.at - a.at).slice(0, NOTICE_LIMIT), added: true };
}

export const markRead = (items, id) => items.map(item => item.id === id && !item.read ? { ...item, read: true } : item);
export const markAllRead = items => items.map(item => item.read ? item : { ...item, read: true });
export const removeIds = (items, ids) => items.filter(item => !ids.includes(item.id));
export const restoreItems = (items, back) => back.reduce((list, item) => list.some(entry => entry.id === item.id) ? list : [...list, item], items).sort((a, b) => b.at - a.at).slice(0, NOTICE_LIMIT);

// "Needs you now" = urgent and still unread. Everything else is "Earlier". Admin messages are never urgent.
export function groupNotices(items) {
  const sorted = [...items].sort((a, b) => b.at - a.at);
  const now = sorted.filter(item => item.urgent && !item.read);
  return { now, earlier: sorted.filter(item => !now.includes(item)) };
}

export function noticeTime(at, now = Date.now()) {
  const ms = now - at;
  if (!Number.isFinite(ms) || ms < 60000) return 'Just now';
  if (ms < 3600000) return `${Math.floor(ms / 60000)} min`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)} h`;
  if (ms < 172800000) return 'Yesterday';
  return `${Math.floor(ms / 86400000)} d`;
}

export const adminToNotice = note => ({ id: `admin:${note.id}`, source: 'admin', adminId: note.id, kind: 'admin', title: note.title, text: note.body, urgent: false, to: '', label: '', at: Date.parse(note.createdAt) || 0, read: !!note.read });

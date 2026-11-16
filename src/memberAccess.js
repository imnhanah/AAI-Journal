// Member-side access status. The server (my_access, RLS) is authoritative; this only reads it for display.
// A failed or malformed lookup is "unavailable", never a valid empty journal and never permission.
// ?memberaccess=demo (dev server only) shows the screens with fake data and never calls the server. ?state=deleting|suspended|banned|unavailable|active picks the state.
const demoParams = (() => { try { return import.meta.env?.DEV && new URLSearchParams(window.location.search).get('memberaccess') === 'demo' ? new URLSearchParams(window.location.search) : null; } catch { return null; } })();
export const memberAccessUiEnabled = import.meta.env?.VITE_MEMBER_ACCESS_UI === 'true' || !!demoParams;
let demoNotes = [
  { id: 'n3', title: 'Scheduled maintenance', body: 'The journal will be read-only for 20 minutes on Friday at 02:00 UTC.', created_at: new Date(Date.now() - 3600000).toISOString(), read_at: null },
  { id: 'n2', title: 'New Challenge screens', body: 'Challenge now shows your phase progress at a glance.', created_at: new Date(Date.now() - 9 * 86400000).toISOString(), read_at: new Date().toISOString() },
];

const STATUSES = ['active', 'suspended', 'banned', 'deleting'];
export const SUPPORT_EMAIL = 'aaicorefx@gmail.com';

export const unavailableAccess = () => ({ available: false, status: null, deletionAt: null, journalCloudWriteAllowed: false, imageUploadAllowed: false, supportEmail: SUPPORT_EMAIL });

const FEATURE_KEYS = ['trade_logs', 'finance', 'challenge', 'case_studies', 'strategy_testing'];
const count = value => Number.isInteger(value) && value >= 0;

// Strict on purpose: anything incomplete or inconsistent is "unavailable", never extra permission.
export function normalizeAccess(raw) {
  if (!raw || typeof raw !== 'object' || raw.available !== true || !STATUSES.includes(raw.status)) return unavailableAccess();
  const features = raw.features;
  const featuresOk = features && typeof features === 'object' && !Array.isArray(features)
    && Object.keys(features).length === FEATURE_KEYS.length && FEATURE_KEYS.every(key => typeof features[key] === 'boolean');
  const deletionAt = typeof raw.deletion_at === 'string' && Number.isFinite(Date.parse(raw.deletion_at)) ? raw.deletion_at : null;
  const deletionOk = raw.status === 'deleting' ? !!deletionAt : raw.deletion_at == null;
  const limitOk = raw.account_limit === null || count(raw.account_limit);
  if (!featuresOk || !deletionOk || !limitOk || typeof raw.multiple_accounts_allowed !== 'boolean' || !count(raw.accounts_used)
    || typeof raw.journal_cloud_write_allowed !== 'boolean' || typeof raw.image_upload_allowed !== 'boolean') return unavailableAccess();
  return {
    available: true,
    status: raw.status,
    deletionAt,
    features: { ...features },
    multipleAccountsAllowed: raw.multiple_accounts_allowed,
    accountLimit: raw.account_limit,
    accountsUsed: raw.accounts_used,
    journalCloudWriteAllowed: raw.journal_cloud_write_allowed,
    imageUploadAllowed: raw.image_upload_allowed,
    supportEmail: typeof raw.support_email === 'string' && raw.support_email ? raw.support_email : SUPPORT_EMAIL,
  };
}

const getClient = async client => client || (await import('./supabaseClient.js')).supabase;

export async function fetchMyAccess({ client } = {}) {
  if (demoParams) {
    const state = demoParams.get('state') || 'active';
    if (state === 'unavailable') return unavailableAccess();
    return normalizeAccess({ available: true, status: state, deletion_at: state === 'deleting' ? new Date(Date.now() + 11 * 86400000).toISOString() : null, features: Object.fromEntries(FEATURE_KEYS.map(key => [key, !(demoParams.get('off') || '').split(',').includes(key)])), multiple_accounts_allowed: demoParams.get('multi') !== '0', account_limit: Number.isInteger(Number(demoParams.get('limit'))) && demoParams.get('limit') ? Number(demoParams.get('limit')) : null, accounts_used: 1, journal_cloud_write_allowed: state === 'active', image_upload_allowed: state === 'active', support_email: SUPPORT_EMAIL });
  }
  try {
    const { data, error } = await (await getClient(client)).rpc('my_access');
    if (error) return unavailableAccess();
    return normalizeAccess(data);
  } catch { return unavailableAccess(); }
}

// Plain CSV text from the server. Every cell is fixed table text or JSON, never a spreadsheet formula.
export async function exportMyRecords({ client } = {}) {
  if (demoParams) return { csv: 'table,record_json\r\n"demo","{}"\r\n' };
  try {
    const { data, error } = await (await getClient(client)).rpc('export_my_records');
    if (error || typeof data !== 'string' || !data.startsWith('table,record_json')) return { error: 'Export is unavailable right now.' };
    return { csv: data };
  } catch { return { error: 'Export is unavailable right now.' }; }
}

export function downloadCsv(text, name = `aaicorefx-records-${new Date().toISOString().slice(0, 10)}.csv`) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---- Notifications (announcements from Admin). Plain text only; the caller is derived on the server. ----
const asNote = row => (row && typeof row.id === 'string' && typeof row.title === 'string' && typeof row.body === 'string')
  ? { id: row.id, title: row.title, body: row.body, createdAt: row.created_at || null, read: !!row.read_at } : null;

export async function fetchMyNotifications({ client } = {}) {
  if (demoParams) return { notes: demoNotes.map(asNote) };
  try {
    const { data, error } = await (await getClient(client)).rpc('my_notifications', { after: null });
    if (error || !Array.isArray(data)) return { error: 'Notifications are unavailable right now.' };
    return { notes: data.map(asNote).filter(Boolean).reverse() };
  } catch { return { error: 'Notifications are unavailable right now.' }; }
}

export async function markNotificationRead(id, { client } = {}) {
  if (demoParams) { demoNotes = demoNotes.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n); return true; }
  try { const { data, error } = await (await getClient(client)).rpc('mark_notification_read', { id }); return !error && data === true; } catch { return false; }
}

export async function clearNotification(id, { client } = {}) {
  if (demoParams) { demoNotes = demoNotes.filter(n => n.id !== id); return true; }
  try { const { data, error } = await (await getClient(client)).rpc('clear_notification', { id }); return !error && data === true; } catch { return false; }
}

// Overlays the server's my_access answer on the membership state. Only ever narrows permissions.
// No answer yet (flag off or still loading) leaves the state unchanged; RLS stays the authority.
export function applyMemberAccess(membership, access, enabled = memberAccessUiEnabled) {
  if (!enabled || !membership) return membership;
  // Access not yet verified: no image uploads until the server answers (journal saves are left to the server's own rules).
  if (!access) return { ...membership, imageUploadAllowed: false };
  if (access.available !== true || access.status !== 'active') return { ...membership, cloudWritesAllowed: false, imageUploadAllowed: false };
  // Active: only an explicit "no" from the server narrows. An absent plan hint never counts as a denial.
  const next = { ...membership };
  if (access.journalCloudWriteAllowed === false) next.cloudWritesAllowed = false;
  if (access.imageUploadAllowed === false) next.imageUploadAllowed = false;
  return next;
}

// True only when the server says this feature is off for an otherwise active account. Missing or unknown answers leave it on (RLS stays the authority).
export function featureOff(access, key, enabled = memberAccessUiEnabled) {
  return !!enabled && !!access && access.available === true && access.status === 'active' && access.features?.[key] === false;
}

// Trading-account capacity. A single-account plan counts as a limit of 1; account_limit null means no limit.
// Unknown or unavailable answers never block (the server stays the authority); the count is the larger of what the server and this device see.
export function accountsFull(access, deviceCount = 0, enabled = memberAccessUiEnabled) {
  if (!enabled) return false;
  // Flag on: a pending or unverified lookup pauses new accounts. Existing accounts stay readable.
  if (!access || access.available !== true || access.status !== 'active') return true;
  const caps = [];
  if (access.multipleAccountsAllowed === false) caps.push(1);
  if (Number.isInteger(access.accountLimit)) caps.push(access.accountLimit);
  if (!caps.length) return false;
  return Math.max(Number(access.accountsUsed) || 0, Number(deviceCount) || 0) >= Math.min(...caps);
}

// How many more accounts this member may add. Infinity = no cap; 0 = none (also while access is pending or unverified).
export function accountSlots(access, deviceCount = 0, enabled = memberAccessUiEnabled) {
  if (!enabled) return Infinity;
  if (!access || access.available !== true || access.status !== 'active') return 0;
  const caps = [];
  if (access.multipleAccountsAllowed === false) caps.push(1);
  if (Number.isInteger(access.accountLimit)) caps.push(access.accountLimit);
  if (!caps.length) return Infinity;
  return Math.max(0, Math.min(...caps) - Math.max(Number(access.accountsUsed) || 0, Number(deviceCount) || 0));
}

// Cloud saves pause when the flag is on and access is pending, unverified, not active, or explicitly says no journal writes.
export function writesAreExplicitlyPaused(access, enabled = memberAccessUiEnabled) {
  if (!enabled) return false;
  if (!access || access.available !== true || access.status !== 'active') return true;
  return access.journalCloudWriteAllowed === false;
}

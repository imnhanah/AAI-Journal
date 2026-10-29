export const JOURNAL_TABLES = ['accounts', 'trades', 'rules', 'journal_entries', 'user_settings', 'premarket_markups', 'trade_reviews', 'period_reviews', 'finance_settings', 'savings_accounts', 'finance_movements', 'workspace_balances', 'trade_balance_results'];
export const rowKey = (table, row) => String(table === 'user_settings' ? row.user_id : table === 'finance_settings' ? row.account_id : row.id);

export function journalManifest(snapshot = {}) {
  return { _protocol: snapshot._protocol || 1, ...Object.fromEntries(JOURNAL_TABLES.map(table => [table, Object.fromEntries((snapshot[table] || []).map(row => [rowKey(table, row), row.updated_at]))])) };
}

// Reconcile an authoritative cloud snapshot, including remote/cascade deletions.
// Do not advance the local snapshot on a failed or incomplete response.
export function mergeJournalDelta(snapshot = {}, response) {
  if (!response?.tables) throw new Error('Invalid journal sync response.');
  const next = { _protocol: response.protocol || 1 };
  for (const table of JOURNAL_TABLES) {
    const delta = response.tables[table];
    if (!delta || !Array.isArray(delta.rows) || !Array.isArray(delta.deleted)) throw new Error(`Incomplete journal sync: ${table}`);
    if (delta.available === false) { next[table] = null; continue; }
    const rows = new Map((snapshot[table] || []).map(row => [rowKey(table, row), row]));
    delta.deleted.forEach(id => rows.delete(String(id)));
    delta.rows.forEach(row => rows.set(rowKey(table, row), row));
    next[table] = [...rows.values()];
  }
  const tie = (a,b) => String(a.id).localeCompare(String(b.id));
  next.trades?.sort((a, b) => String(a.trade_date).localeCompare(String(b.trade_date)) || tie(a,b));
  next.premarket_markups?.sort((a, b) => String(b.markup_date).localeCompare(String(a.markup_date)) || tie(a,b));
  next.finance_movements?.sort((a, b) => String(b.movement_date).localeCompare(String(a.movement_date)) || tie(a,b));
  return next;
}

export const IMAGE_PREFIX = 'tj-image:';
export function imageReference(value) {
  if (typeof value !== 'string' || !value.startsWith(IMAGE_PREFIX)) return null;
  const ref = JSON.parse(value.slice(IMAGE_PREFIX.length));
  if (!['trades', 'premarket_markups', 'trade_reviews'].includes(ref.table) || !ref.user || !ref.id || !ref.version || !Array.isArray(ref.path)) throw new Error('Invalid screenshot reference.');
  return ref;
}

export async function resolveImageReferences(value, load) {
  if (typeof value === 'string') return imageReference(value) ? load(value) : value;
  if (Array.isArray(value)) return Promise.all(value.map(item => resolveImageReferences(item, load)));
  if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await resolveImageReferences(item, load)])));
  return value;
}

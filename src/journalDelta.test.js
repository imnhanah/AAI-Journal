import test from 'node:test';
import assert from 'node:assert/strict';
import { JOURNAL_TABLES, journalManifest, mergeJournalDelta, imageReference, resolveImageReferences } from './journalDelta.js';

const response = () => ({ tables: Object.fromEntries(JOURNAL_TABLES.map(table => [table, { rows: [], deleted: [], available: true }])) });
const reference = (extra = {}) => 'tj-image:' + JSON.stringify({ user: 'owner', table: 'trades', id: 'trade', version: 'revision', path: ['entry', '0'], ...extra });

test('manifest covers every table and nonstandard primary keys', () => {
  const manifest = journalManifest({ user_settings: [{ user_id: 'u', updated_at: 'v1' }], finance_settings: [{ account_id: 'a', updated_at: 'v2' }], workspace_balances: [{ id: 'b', updated_at: 'v3' }], trade_balance_results: [{ id: 'r', updated_at: 'v4' }] });
  assert.equal(Object.keys(manifest).length, 14);
  assert.equal(manifest.user_settings.u, 'v1');
  assert.equal(manifest.finance_settings.a, 'v2');
  assert.equal(manifest.workspace_balances.b, 'v3');
  assert.equal(manifest.trade_balance_results.r, 'v4');
});
test('delta preserves unchanged records, replaces edits and removes cloud deletions', () => {
  const previous = { trades: [{ id: 'keep', trade_date: '2026-01-01' }, { id: 'edit', trade_date: '2026-01-02', pnl: 1 }, { id: 'gone' }] };
  const delta = response();
  delta.tables.trades = { rows: [{ id: 'edit', trade_date: '2026-01-02', pnl: 2 }, { id: 'new', trade_date: '2025-01-01' }], deleted: ['gone'], available: true };
  const merged = mergeJournalDelta(previous, delta);
  assert.deepEqual(merged.trades.map(row => row.id), ['new', 'keep', 'edit']);
  assert.equal(merged.trades[2].pnl, 2);
  assert.equal(previous.trades.length, 3);
  assert.equal(previous.trades[1].pnl, 1);
});
test('unchanged sync and optional tables remain safe; incomplete results are rejected', () => {
  const delta = response();
  delta.tables.workspace_balances.available = false;
  assert.equal(mergeJournalDelta({}, delta).workspace_balances, null);
  assert.deepEqual(mergeJournalDelta({ accounts: [{ id: 'a' }] }, delta).accounts, [{ id: 'a' }]);
  delete delta.tables.trades;
  assert.throws(() => mergeJournalDelta({}, delta), /Incomplete/);
});
test('screenshot hydration preserves captions, session review, paths and removals', async () => {
  const source = reference();
  const shots = { entry: [{ src: source, caption: 'My setup' }], exit: [], sessionReview: { marketOutcome: 'Trending' } };
  const calls = [];
  const hydrated = await resolveImageReferences(shots, async value => { calls.push(value); return 'data:image/png;base64,example'; });
  assert.equal(hydrated.entry[0].src, 'data:image/png;base64,example');
  assert.equal(hydrated.entry[0].caption, 'My setup');
  assert.deepEqual(hydrated.exit, []);
  assert.equal(hydrated.sessionReview.marketOutcome, 'Trending');
  assert.deepEqual(calls, [source]);
  assert.equal(shots.entry[0].src, source);
  assert.deepEqual(imageReference(source).path, ['entry', '0']);
});
test('ordinary sources are unchanged and invalid references fail rather than overwriting images', async () => {
  assert.equal(imageReference('https://example.com/chart.png'), null);
  assert.throws(() => imageReference(reference({ table: 'accounts' })), /Invalid/);
  await assert.rejects(resolveImageReferences([reference()], async () => { throw new Error('offline'); }), /offline/);
});

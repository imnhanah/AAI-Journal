import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const journal = read('./TradingJournal.jsx');
const auth = read('./auth.js');
const dialog = read('./ProfileDeleteDialog.jsx');
const handler = journal.slice(journal.indexOf('const handleDeleteProfile'), journal.indexOf('const handleToggleCheckin'));

test('scheduling the deletion countdown keeps local data and stays signed in', () => {
  assert.ok(handler.length > 40);
  assert.doesNotMatch(handler, /localStorage\.clear|sessionStorage\.clear|onLogout|signOut/);
  assert.match(handler, /requestProfileDeletion/);
});

test('only a valid scheduled result is accepted, never a deleted result', () => {
  assert.doesNotMatch(auth, /deleted:\s*true/);
  assert.match(auth, /data\?\.scheduled !== true \|\| data\?\.deleted !== false/);
  assert.match(auth, /Date\.parse\(data\.deletion_at\)/);
});

test('deletion is only ready for the 14-day countdown service', () => {
  assert.match(auth, /deletion_mode !== 'countdown' \|\| data\?\.countdown_days !== 14/);
});

test('dialog describes the cancellable countdown, not immediate erasure', () => {
  assert.match(dialog, /14 days/);
  assert.doesNotMatch(dialog, /permanently deletes|cannot be undone/);
});

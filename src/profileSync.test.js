import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('manual sync lives in Profile settings and retains the journal sync handler', () => {
  const code = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
  const profile = code.slice(code.indexOf('function ProfileSettingsModal('), code.indexOf('function ListManager('));
  assert.match(profile, /Cloud Sync/);
  assert.match(profile, /disabled=\{syncing\} onClick=\{onSync\}/);
  assert.match(profile, /Last synced/);
  assert.match(code, /onSync=\{syncJournal\} syncing=\{syncing\} lastSyncedAt=\{lastSyncedAt\}/);
  assert.doesNotMatch(code, /className="tj-nav-item tj-sync-nav"/);
});

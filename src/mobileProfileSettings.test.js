import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const screen = readFileSync(new URL('./MobileProfileSettings.jsx', import.meta.url), 'utf8');
const start = journal.indexOf('function ProfileSettingsModal');
const modal = journal.slice(start, journal.indexOf('<Modal title={<span className="tj-symbol-title"><span className="tj-profile-desktop-title">', start));

test('the phone Profile screen is its own branch and desktop keeps its modal', () => {
  assert.match(modal, /if \(phone\) \{/);
  assert.match(modal, /<MobileProfileSettings/);
  assert.match(journal, /tj-profile-studio-modal tj-profile-redesign/);
});

test('phone Profile saves through the same code and keeps every protection', () => {
  assert.match(modal, /onSave=\{save\}/);
  assert.match(modal, /<ProfileDeleteDialog ready=\{deletionReady\}/);
  assert.match(modal, /cloudSyncEntitled \? onToggleCloudSync\?\.\(\) : onOpenPricing\?\.\(\)/);
  assert.match(modal, /onSubmit:changePassword/);
});

test('phone Profile counts the week start as a change and Discard restores it', () => {
  assert.match(modal, /dirty=\{!unchanged \|\| JSON\.stringify\(displayDraft\) !== JSON\.stringify\(originalDisplayDraft\.current\)\}/);
  assert.match(modal, /setDisplayDraft\(originalDisplayDraft\.current\)/);
});

test('phone Profile offers only options the app really supports', () => {
  for (const value of ['Africa/Accra', 'America/Los_Angeles', 'Asia/Dubai']) assert.ok(screen.includes(value));
  assert.match(screen, /\[\[90, '1h 30m'\], \[0, 'Stay signed in'\]\]/);
  assert.match(screen, /\[\[5, '5 minutes'\], \[15, '15 minutes'\], \[60, '1 hour'\]\]/);
  assert.doesNotMatch(screen, /Current password/);
});

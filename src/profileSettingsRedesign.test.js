import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const dialog = readFileSync(new URL('./ProfileDeleteDialog.jsx', import.meta.url), 'utf8');
test('full profile reference puts routine below appearance and separates the bottom row',()=>{
  const layout=source.slice(source.indexOf('function ProfilePreferencesLayout'),source.indexOf('function ProfileSettingsModal'));
  assert.match(layout,/tj-profile-reference-left">\{appearance\}/);
  assert.match(layout,/tj-profile-reference-right">\{has\("tj-profile-regional-card"\)\}\{has\("tj-profile-display-card"\)\}\{routineCard\}/);
  const css=readFileSync(new URL('./profileSettingsRedesign.css',import.meta.url),'utf8');
  assert.match(css,/grid-template-columns:1\.25fr 1fr/);
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/--tj-panel:var\(--color-surface-252\)/);
});
test('profile deletion requires the saved name and keeps server deletion behind confirmation', () => {
  assert.match(source, /deleteConfirmation !== fallbackDisplayName \|\| deleting \|\| !deletionReady/);
  assert.match(source, /<ProfileDeleteDialog ready=\{deletionReady\} name=\{fallbackDisplayName\}/);
  assert.match(dialog, /disabled=\{busy \|\| !ready \|\| !name \|\| value !== name\}/);
  assert.match(dialog, /createPortal\(content, root\)/);
  assert.match(dialog, /modal.inert = true/);
});
test('display preferences are controlled and saved with the profile', () => {
  const display = source.slice(source.indexOf('<section className="tj-personal-appearance-card tj-profile-display-card">'), source.indexOf('<section className="tj-personal-appearance-card tj-personal-security-card">'));
  assert.match(display, /value=\{displayDraft.startPage\}/);
  assert.match(display, /aria-pressed=\{displayDraft.weekStart === "monday"\}/);
  assert.doesNotMatch(display, /disabled/);
  assert.match(source, /\.\.\.displayMetadata\(displayDraft\)/);
  assert.match(source, /\.\.\.displayMetadata\(nextDisplay\)/);
});
test('profile keeps explanatory copy only for privacy and cloud sync', () => {
  const profile = source.slice(source.indexOf('function ProfileSettingsModal'), source.indexOf('function PreferencesModal'));
  for (const copy of [
    'Click the selected color again to restore Default.',
    'Changes the calendar and weekly cards.',
    'Where the app opens after you sign in.',
    'Mask amounts for screen sharing.',
    'Applies after saving. Turn off Hide balances to view or edit money amounts.',
    'Update the password you sign in with.',
  ]) assert.doesNotMatch(profile, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(profile, /Blur the journal after inactivity\./);
  assert.match(profile, /Automatic backup across your devices\./);
  const picker = readFileSync(new URL('./AccentPicker.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(picker, /Click the selected color again to restore Default\./);
});
test('appearance preview supports deferred saving and preserves all colors', () => {
  assert.match(source, /previewMode === 'live' && previewEnabled/);
  const picker = readFileSync(new URL('./AccentPicker.jsx', import.meta.url), 'utf8');
  assert.match(picker, /compact \? expanded \? ordered/);
  assert.match(picker, /More colors/);
});
test('reference palette has the six ordered gradient cards and selection details', () => {
  const picker = readFileSync(new URL('./AccentPicker.jsx', import.meta.url), 'utf8');
  assert.match(picker, /\[DEFAULT_ACCENT, 'ocean-blue', 'ice', 'purple', 'bronze', 'slate'\]/);
  assert.match(picker, /tj-accent-preview-bars/);
  assert.match(picker, /tj-accent-check/);
  assert.match(picker, /<small>DEFAULT<\/small>/);
});

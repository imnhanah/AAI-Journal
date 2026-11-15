import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const auth = readFileSync(new URL('./auth.js', import.meta.url), 'utf8');
const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const desktop = readFileSync(new URL('./DesktopProfilePanel.jsx', import.meta.url), 'utf8');
const mobile = readFileSync(new URL('./MobileProfileSettings.jsx', import.meta.url), 'utf8');

test('signOut uses scope:local so only this device is signed out', () => {
  assert.match(auth, /export async function signOut\(\)/);
  assert.match(auth, /signOut\(\{ scope: 'local' \}\)/);
});

test('signOutAll uses scope:global to sign out every device', () => {
  assert.match(auth, /export async function signOutAll\(\)/);
  assert.match(auth, /signOut\(\{ scope: 'global' \}\)/);
});

test('updatePassword signs out other devices after a successful password change', () => {
  assert.match(auth, /signOut\(\{ scope: 'others' \}\)/);
  const updateFn = auth.slice(auth.indexOf('export async function updatePassword'));
  assert.match(updateFn, /signOut\(\{ scope: 'others' \}\)/);
});

test('signOutAll is imported and wired through ProfileSettingsModal', () => {
  assert.match(journal, /import \{[^}]*signOutAll[^}]*\} from "\.\/auth"/);
  assert.match(journal, /const handleSignOutAll = async \(\)/);
  assert.match(journal, /onSignOutAll=\{handleSignOutAll\}/);
});

test('desktop profile panel has sign-out-all row with inline confirm', () => {
  assert.match(desktop, /onSignOutAll/);
  assert.match(desktop, /Sign out of all devices/);
  assert.match(desktop, /signOutAllConfirm/);
  assert.match(desktop, /Sign out everywhere\?/);
});

test('desktop profile panel shows password-change note near the form', () => {
  assert.match(desktop, /Changing your password signs you out on your other devices\./);
  const pwSection = desktop.slice(desktop.indexOf('pf2-pw'));
  assert.match(pwSection, /pf2-pw-note/);
});

test('mobile profile settings has sign-out-all button with confirm dialog', () => {
  assert.match(mobile, /onSignOutAll/);
  assert.match(mobile, /Sign out of all devices/);
  assert.match(mobile, /signOutAllDevices/);
  assert.match(mobile, /Sign out all/);
});

test('mobile profile settings shows password-change note in the password popup', () => {
  const pwSection = mobile.slice(mobile.indexOf("password.open && <Popup title=\"Change password\""));
  assert.match(pwSection, /Changing your password signs you out on your other devices\./);
});

test('desktop profile CSS uses only theme tokens, no hardcoded colours', () => {
  const css = readFileSync(new URL('./desktopProfile.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
});

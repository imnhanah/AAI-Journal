import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const alert = readFileSync(new URL('./MobileAlert.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./mobileAlerts.css', import.meta.url), 'utf8');
const entry = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');
const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');

test('mobile feedback uses one provider above the bottom navigation', () => {
  assert.match(entry, /<MobileAlertProvider><TradingJournal/);
  assert.match(alert, /MobileAlertContext/);
  assert.match(css, /bottom:calc\(var\(--mobile-bottom,88px\) \+ 14px \+ env\(safe-area-inset-bottom,0px\)\)/);
});

test('mobile feedback distinguishes status and actionable problems accessibly', () => {
  assert.match(alert, /type === 'error' \|\| alert.type === 'warning' \? 'alert' : 'status'/);
  assert.match(css, /\.tj-mobile-alert\.is-warning/);
  assert.match(css, /\.tj-mobile-alert\.is-error/);
  assert.match(alert, /Dismiss notification/);
});

test('global save and sync notices use the same mobile-safe placement', () => {
  assert.match(css, /\.tj-toast \{top:auto;bottom:calc\(var\(--mobile-bottom,88px\)/);
  assert.match(journal, /@media \(max-width:767px\) \{\s*\.tj-toast \{ top:auto; right:12px; bottom:calc\(var\(--mobile-bottom,88px\)/);
  assert.match(journal, /min-height:0; height:auto/);
});

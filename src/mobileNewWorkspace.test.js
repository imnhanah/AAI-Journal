import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const screen = readFileSync(new URL('./MobileNewWorkspace.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./mobileNewWorkspace.css', import.meta.url), 'utf8');
const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');

test('phones get the new sheet on the same create code, and desktop keeps its form', () => {
  assert.match(journal, /if \(phone\) return <Modal navKey="new-workspace"/);
  assert.match(journal, /<MobileNewWorkspace /);
  assert.match(journal, /Create Account Workspace/);
});

test('a typed balance stays on the first account when switching to Multiple', () => {
  assert.match(screen, /onClick=\{chooseMultiple\}/);
  assert.match(screen, /d\.updateAccount\(primary\.id, 'startingBalance', d\.balance\)/);
  assert.match(journal, /name: "Account 2", startingBalance: Number\(balance\) \|\| 0/, 'the form shared with desktop is unchanged');
});

test('it can only be created once name, currency and accounts are valid', () => {
  assert.match(screen, /const ready = named && currency && accountsReady/);
  assert.match(screen, /d\.accounts\.length >= 2 && d\.accounts\.every/);
  assert.match(screen, /disabled=\{!ready \|\| d\.creating\}/);
});

test('leaving with something typed asks first', () => {
  assert.match(screen, /useLeaveGuard\(d\.touched && !d\.creating, 'new-workspace'\)/);
});

test('the switcher opens this sheet instead of creating from a name alone', () => {
  const menu = readFileSync(new URL('./MobileWorkspaceMenu.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(journal, /blankWorkspaceFields/);
  assert.doesNotMatch(menu, /tj-wm-new/);
  assert.match(menu, /onClick=\{onCreate\}/);
});

test('text stays readable and colours come from the theme', () => {
  for (const size of css.matchAll(/font-size:([\d.]+)px/g)) assert.ok(Number(size[1]) >= 12, size[0]);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
});

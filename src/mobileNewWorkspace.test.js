import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const screen = readFileSync(new URL('./MobileNewWorkspace.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./mobileNewWorkspace.css', import.meta.url), 'utf8');
const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');

test('phones get the new sheet on the same create code, and desktop opens in a side panel', () => {
  assert.match(journal, /if \(phone\) return[\s\S]{0,10}<Modal navKey="new-workspace"/);
  assert.match(journal, /<MobileNewWorkspace /);
  assert.match(journal, /Add a workspace/);
});

test('it can only be created once name and currency are valid', () => {
  assert.match(screen, /const ready = named && currency/);
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

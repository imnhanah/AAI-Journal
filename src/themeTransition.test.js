import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionTheme } from './themeTransition.js';
import { readFileSync } from 'node:fs';

test('cross-tab theme changes use the storage event value, not stale profile preferences', () => {
  const source=readFileSync(new URL('./siteTheme.js',import.meta.url),'utf8');
  assert.match(source,/const storage = event => \{ if \(event.key === key\) setPreference\(normaliseThemePreference\(event.newValue\)\); \}/);
});

test('theme updates immediately without browser support or with reduced motion', () => {
  let updates = 0;
  transitionTheme(() => updates++, {}, {});
  transitionTheme(() => updates++, { startViewTransition() { assert.fail('must not animate'); } }, { matchMedia: () => ({ matches: true }) });
  assert.equal(updates, 2);
});

test('theme transitions snapshot the update and skip an interrupted sweep', async () => {
  let updates = 0, skips = 0;
  const doc = { startViewTransition(update) {
    update();
    return { skipTransition() { skips++; }, ready: Promise.resolve(), finished: Promise.resolve() };
  } };
  const win = { matchMedia: () => ({ matches: false }) };
  transitionTheme(() => updates++, doc, win);
  transitionTheme(() => updates++, doc, win);
  assert.equal(updates, 2);
  assert.equal(skips, 1);
  await Promise.resolve();
});

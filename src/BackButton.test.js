import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const button = readFileSync(new URL('./BackButton.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./mobileBackButton.css', import.meta.url), 'utf8');
const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');

test('the button matches Option C', () => {
  assert.match(button, /aria-label="Back"/);
  assert.match(button, /<ArrowLeft size=\{22\} strokeWidth=\{2\}/);
  assert.match(css, /width:44px;height:44px;min-width:44px;min-height:44px/);
  assert.match(css, /border:0;border-radius:15px/);
  assert.match(css, /\.tj-back:active \{transform:scale\(\.92\);\}/);
  assert.match(css, /\.tj-back:focus-visible \{outline:2px solid var\(--focus\)/);
});

test('it only renders on phones', () => {
  assert.match(button, /if \(!phone\) return null;/);
  assert.match(button, /window\.matchMedia\(MOBILE_MEDIA\)/);
  const start = css.indexOf('@media (max-width:767px)');
  assert.ok(start >= 0 && start < css.indexOf('.tj-back'));
});

test('a page can handle its own step first', () => {
  assert.match(button, /if \(await onBack\?\.\(\) === true\) return;\s*nav\.back\(\);/);
});

test('top-level pages never get it', () => {
  assert.match(journal, /\{!isTopLevelPage\(page\) && <BackButton\/>\}/);
});

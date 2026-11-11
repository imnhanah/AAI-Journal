import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');

test('Mobile Markups V2 uses existing lifecycle, link, image and navigation primitives', () => {
  const source = read('./MobileMarkupsV2.jsx');
  assert.match(source, /import \{markupStatus\} from '\.\/markupLifecycle\.js'/);
  assert.match(source, /import \{loadJournalImage\} from '\.\/journalCloudCache\.js'/);
  assert.match(source, /premarketMarkupId/);
  for (const slot of ['preHTF', 'preH4', 'preM15', 'postH4', 'postM15']) assert.ok(source.includes(slot));
  assert.match(source, /usePageState\('markups-mobile-v2'/);
  assert.match(source, /onViewImage/);
  assert.match(source, /ConfirmDeleteButton/);
});

test('Mobile Markups V2 groups records by month and keeps search, status and date ordering local to the active account data', () => {
  const source = read('./MobileMarkupsV2.jsx');
  assert.match(source, /monthLabel\(markup\.date\)/);
  assert.match(source, /markup\.instrument, markup\.market, markup\.bias, status, markup\.date/);
  assert.match(source, /filter === 'Linked' \? linked\.length > 0 : status === filter/);
  assert.match(source, /return descending \? -comparison : comparison/);
  assert.doesNotMatch(source, /balanceId/);
});

test('TradingJournal mounts exactly one Markups surface per breakpoint and preserves the desktop redesign', () => {
  const source = read('./TradingJournal.jsx');
  assert.match(source, /page === "markups" && \(phoneCalendar \? <MobileMarkupsV2/);
  assert.match(source, /: <MarkupsRedesign markups=\{markups\.filter/);
  assert.match(source, /markups\.filter\(\(markup\)=>markup\.accountId===account\.id\)/);
  assert.match(source, /premarketMarkupId: markup\.id/);
});

test('Mobile Markups V2 styling is scoped, token-based, touch-sized and does not create a second scroll owner', () => {
  const css = read('./mobileMarkupsV2.css');
  assert.match(css, /@media \(max-width:767px\)/);
  assert.match(css, /\.tj-content:has\(\.tj-mk2\)\{padding-inline:0\}/);
  assert.match(css, /\.tj-root \.tj-mk2/);
  assert.match(css, /env\(safe-area-inset-bottom,0px\)/);
  assert.match(css, /color:var\(--on-accent\)/);
  assert.doesNotMatch(css, /--tj-on-accent/);
  assert.match(css, /min-height:46px/);
  assert.doesNotMatch(css, /overflow-y:\s*(?:auto|scroll)/);
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i);
});

test('Mobile Markups V2 places its New Markup action directly below the library tools instead of using a floating action button', () => {
  const source = read('./MobileMarkupsV2.jsx');
  const css = read('./mobileMarkupsV2.css');
  assert.ok(source.indexOf('tj-mk2-create-wrap') > source.indexOf('tj-mk2-tools'));
  assert.match(source, /className="tj-mk2-create" onClick=\{onNew\} aria-label="New Markup"><Plus/);
  assert.doesNotMatch(source, /tj-mk2-fab/);
  assert.match(css, /\.tj-root \.tj-mk2-create-wrap \{display:flex;justify-content:center/);
  assert.match(css, /\.tj-root \.tj-mk2-create \{[^}]*min-height:46px/);
});

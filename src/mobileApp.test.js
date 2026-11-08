import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const css = read('./mobileApp.css');

test('phone design layer loads last and stays out of desktop', () => {
  const entry = read('./main.jsx');
  assert.ok(entry.indexOf("./mobileApp.css") > entry.indexOf("./writingFields.css"));
  const outsideMedia = css.slice(0, css.indexOf('@media (max-width:767px)')).replace(/\/\*[\s\S]*?\*\//g, '').trim();
  assert.equal(outsideMedia, '.tj-page-date,.tj-phone-header-slot {display:none;}');
});

test('phone design layer takes every colour from tokens', () => {
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b|rgba?\([^)]*\)|:\s*(?:white|black)\b/i);
  const tokens = read('./themeTokens.css');
  for (const mode of ['dark', 'light']) for (const name of ['bg', 'surface', 'text', 'muted', 'profit', 'loss', 'pill', 'on-pill']) {
    assert.match(tokens, new RegExp(`--phone-${mode}-${name}:`));
  }
});

test('custom profile themes and chosen accents keep their own colours on phones', () => {
  assert.match(css, /:not\(\[data-profile-theme\]:not\(\[data-profile-theme="default"\]\)\)/);
  assert.match(css, /\[data-profile-accent="default"\]/);
  assert.match(css, /\[data-profile-accent\]:not\(\[data-profile-accent="default"\]\) \{--phone-chart:var\(--accent\);--phone-pill:var\(--accent\)/);
});

test('calendar cells show compact amounts and keep the full figure for screen readers', () => {
  const calendar = read('./MobileCalendarV2.jsx');
  assert.match(calendar, /<b>\{calendarCellAmount\(cell\.pnl\)\}<\/b>/);
  assert.match(calendar, /\$\{formatMoney\(cell\.pnl\)\}/);
});

test('pages move their top controls into the header, which replaces the workspace switcher only while they are there', () => {
  const slot = read('./PhoneHeaderSlot.jsx');
  assert.match(slot, /if\(!phone\) return children/);
  assert.match(css, /\.tj-topbar-actions:has\(\.tj-phone-header-slot:not\(:empty\)\) \.tj-header-account-control \{display:none!important;\}/);
  assert.doesNotMatch(read('./MobileDashboardV6.jsx'), /PhoneHeaderSlot/);
  for (const page of ['./MobileAnalyticsPulse.jsx','./MobileCalendarV2.jsx','./MobileFinance.jsx','./MobileStrategyTestingV6.jsx','./MobileNews.jsx']) assert.match(read(page), /<PhoneHeaderSlot>/);
  assert.match(read('./TradingJournal.jsx'), /id=\{PHONE_HEADER_SLOT_ID\}/);
});

test('phone entry forms are a popup that cannot block the app while closed', () => {
  const closed = css.match(/\.tj-entry-panel-outer \{([^}]+)\}/)?.[1] || '';
  assert.match(closed, /visibility:hidden/);
  assert.match(closed, /transform:translateY\(105%\)/);
  const open = css.match(/\.tj-entry-panel-outer\.tj-entry-panel-open \{([^}]+)\}/)?.[1] || '';
  assert.match(open, /visibility:visible/);
  assert.match(open, /transform:none/);
  assert.ok(css.indexOf('.tj-entry-panel-outer') > css.indexOf('@media (max-width:767px)'));
});

test('phones draw no scrollbars but never switch scrolling off', () => {
  const css = read('./mobileApp.css');
  const rule = css.slice(css.indexOf('no scrollbar is drawn anywhere'));
  assert.match(rule, /@media \(max-width:767px\)/);
  assert.match(rule, /scrollbar-width:none!important/);
  assert.match(rule, /::-webkit-scrollbar \{display:none!important/);
  assert.doesNotMatch(rule, /overflow(-[xy])?\s*:/);
});

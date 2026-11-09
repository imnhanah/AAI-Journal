import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./desktopCalendar.css', import.meta.url), 'utf8');

test('desktop Calendar shows v2; phones keep MobileCalendarV2', () => {
  assert.match(journal, /const CALENDAR_V2 = true;/);
  assert.match(journal, /import '\.\/desktopCalendar\.css';/);
  assert.match(journal, /if \(CALENDAR_V2\) return <DesktopCalendarV2 account=\{account\} monthCursor=\{monthCursor\}/);
  assert.match(journal, /\? <MobileCalendarV2 account=\{dashboardAccount\}/);
});

test('Calendar v2 uses the shared month grid, week breakdown and readout', () => {
  assert.match(journal, /const weeks = buildMonthGrid\(year, month, byDay\);\n\s*const snapshots = computeWeeklyBreakdown\(account\.trades, year, month, cap\);/);
  assert.match(journal, /<button type="button" className="cx2-link" onClick=\{\(\) => onDayClick\(focus\.iso\)\}>Open day details/);
  assert.match(journal, /<CalendarPerformanceNarrative view=\{view\} trades=\{account\.trades\} cap=\{cap\} balance=\{base\}\/>/);
});

test('Calendar v2 hides the duplicate banner, reflows by page width and respects reduced motion', () => {
  assert.match(css, /\.tj-page-transition:has\(\.cx2\)>\.tj-signal-page-calendar \{display:none;\}/);
  assert.match(css, /@container journal-workspace \(max-width:1280px\) \{\n\s*\.tj-root \.cx2 \.cx2-hero/);
  assert.match(css, /@media \(min-width:768px\) and \(prefers-reduced-motion:reduce\)/);
});

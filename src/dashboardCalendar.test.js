import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./entryComposer.css', import.meta.url), 'utf8');

test('Dashboard reuses the Calendar page component and palette with its account controls', () => {
  assert.match(journal, /className="tj-calendar-page tj-dashboard-calendar">\s*<AttachedPnlCalendar[^>]*balances=\{balances\}[^>]*onSelectBalance=\{onSelectBalance\}[^>]*className="tj-main-attached-calendar"/);
  assert.match(journal, /<AttachedPnlCalendar[^>]*onDayClick=\{onDayClick\}[^>]*className="tj-main-attached-calendar"/);
});

test('Dashboard no longer overrides Calendar cells, result badges or weekly bars', () => {
  assert.doesNotMatch(styles, /\.tj-reference-dashboard\s+[^\{\n]*\.tj-attached-(?:day|week|calendar-grid|calendar-scroll|month-result)/);
  assert.match(styles, /\.tj-dashboard-calendar \.tj-main-attached-calendar \{ margin-top:0; \}/);
  assert.match(styles, /@container \(max-width:800px\)/);
});

test('Dashboard visual refinement scopes calendar treatment and reports chart sample sizes', () => {
  assert.match(journal, /tj-reference-dashboard \.tj-dashboard-calendar \.tj-attached-day-quiet/);
  assert.match(journal, /tj-reference-dashboard \.tj-dashboard-calendar \.tj-attached-day-(?:win|loss|be|finance)/);
  assert.match(journal, /className="tj-dashboard-sample"/);
  assert.match(journal, /recorded trade(?:s)? this month/);
  assert.match(journal, /trading day(?:s)?/);
  assert.match(journal, /@media \(max-width:1460px\) \{ \.tj-reference-dashboard \.tj-reference-kpis \{ grid-template-columns:repeat\(3/);
});

test('Dashboard account-base returns preserve their denominator and formatting without extra presentation copy', () => {
  assert.match(journal, /const allTimeReturn = account\.balance \? \(thisYearStats\.netPnl \/ account\.balance\) \* 100 : 0;/);
  assert.match(journal, /formatAccountBasePercent\(allTimeReturn\)/);
  assert.match(journal, /formatAccountBasePercent\(percent\)/);
  assert.doesNotMatch(journal, /AccountBaseReturnContext|tj-account-base-return|stored base balance/);
  assert.match(journal, /minimumFractionDigits: 2, maximumFractionDigits: 2/);
});

test('Dashboard KPI statuses do not split words and weekly-rail refinement stays dashboard-only', () => {
  assert.match(journal, /\.tj-reference-dashboard \.tj-kpi-top \{ align-items:flex-start; flex-wrap:wrap; \}/);
  assert.match(journal, /\.tj-reference-dashboard \.tj-kpi-top > span \{ flex:0 0 auto; min-width:max-content; margin-left:auto;.*overflow-wrap:normal;.*white-space:nowrap;/);
  assert.match(journal, /@media \(min-width:761px\) \{ \.tj-reference-dashboard \.tj-dashboard-calendar \.tj-attached-calendar-grid/);
  assert.match(journal, /\.tj-reference-dashboard \.tj-dashboard-analytics-grid \.tj-panel-head \.tj-muted-txt \{ display:block;/);
});

test('Performance Flow metrics and recent trades stay on their parent card surface', () => {
  assert.match(styles, /tj-reference-flow-metrics>div \{[^}]*background:transparent/);
  assert.match(styles, /tj-reference-flow-trades>div \{[^}]*background:transparent/);
});

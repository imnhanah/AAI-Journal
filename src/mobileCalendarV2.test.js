import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addCalendarCashMovements, buildCalendarMonthGrid, calendarDayOfWeekPerformance, calendarMonthSummary, calendarMonthlyPerformance, calendarWeeklyBreakdown, calendarWeeklyPerformance} from './calendarAggregation.js';
import {setDisplayPreferences} from './displayPreferences.js';

const trades = [
  {id: 'win', date: '2026-11-02', pnl: 125, rr: 2},
  {id: 'loss', date: '2026-11-03', pnl: -50, rr: -1},
  {id: 'running', date: '2026-11-03', pnl: '', context: '[aaicorefx-running-trade]'},
  {id: 'balance-result', date: '2026-11-04', pnl: '', balanceResults: [{grossPnl: 40, netPnl: 35}], rr: 1},
];

test('Calendar V2 aggregates closed trades only and keeps R details on their date', () => {
  const summary = calendarMonthSummary(trades, 2026, 10, 0);
  assert.equal(summary.netPnl, 75);
  assert.equal(summary.activeDays, 3);
  assert.equal(summary.byDay['2026-11-03'].count, 1);
  assert.equal(summary.byDay['2026-11-02'].rTotal, 2);
  assert.equal(summary.byDay['2026-11-04'].count, 1);
});

test('Calendar V2 preserves the profile week-start preference in its month grid', () => {
  setDisplayPreferences({weekStart: 'monday'});
  const monday = buildCalendarMonthGrid(2026, 10, {})[0];
  assert.equal(monday.findIndex(Boolean), 6); // 1 Nov 2026 is a Sunday.
  setDisplayPreferences({weekStart: 'sunday'});
  const sunday = buildCalendarMonthGrid(2026, 10, {})[0];
  assert.equal(sunday.findIndex(Boolean), 0);
  setDisplayPreferences({weekStart: 'monday'});
});

test('cash movements annotate calendar days without changing realised trade P&L', () => {
  const summary = calendarMonthSummary(trades, 2026, 10, 0);
  const withCash = addCalendarCashMovements(summary.byDay, [{id: 'deposit', date: '2026-11-02', type: 'deposit', amount: 500}], movement => movement.amount);
  assert.equal(summary.byDay['2026-11-02'].cashCount, undefined);
  assert.equal(withCash['2026-11-02'].pnl, 125);
  assert.equal(withCash['2026-11-02'].cash, 500);
  assert.equal(withCash['2026-11-02'].cashCount, 1);
});

test('calendar weekly, monthly, and weekday insights use the same realised records', () => {
  const weekly = calendarWeeklyBreakdown(trades, 2026, 10, 0);
  assert.equal(weekly.reduce((sum, row) => sum + row.tradeCount, 0), 3);
  assert.equal(calendarWeeklyPerformance(trades, 0, 1000).reduce((sum, row) => sum + row.count, 0), 3);
  assert.equal(calendarMonthlyPerformance(trades, 0, 1000)[0].count, 3);
  assert.equal(calendarDayOfWeekPerformance(trades, 0).reduce((sum, row) => sum + row.count, 0), 3);
});

test('Calendar aggregation respects the supplied account slice and leaves desktop Calendar on its existing account path', () => {
  const selectedBalanceTrades = [trades[0]];
  const allAccountTrades = [...selectedBalanceTrades, {id: 'other-balance', date: '2026-11-02', pnl: 900, rr: 3}];
  assert.equal(calendarMonthSummary(selectedBalanceTrades, 2026, 10, 0).netPnl, 125);
  assert.equal(calendarMonthSummary(allAccountTrades, 2026, 10, 0).netPnl, 1025);

  const source = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
  assert.match(source, /phoneCalendar\s*\?\s*<MobileCalendarV2\s+account=\{dashboardAccount\}/);
  assert.match(source, /:\s*<CalendarPage\s+account=\{account\}/);
  assert.match(source, /onDayClick=\{openDayDetails\}/);
});

test('mobile Calendar V2 mounts only from the phone branch and retains existing day-detail callbacks', () => {
  const source = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
  const component = readFileSync(new URL('./MobileCalendarV2.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./mobileCalendarV2.css', import.meta.url), 'utf8');
  assert.match(source, /phoneCalendar\s*\?\s*<MobileCalendarV2/);
  assert.match(source, /:\s*<CalendarPage account=\{account\}/);
  assert.match(component, /onDayClick\(cell\.iso\)/);
  assert.match(component, /cash movements remain separate/i);
  assert.match(css, /grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
  assert.match(css, /min-height:56px/);
});

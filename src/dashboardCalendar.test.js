import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./desktopDashboard.css', import.meta.url), 'utf8');

test('active desktop Dashboard calendar keeps account controls and opens a selected day', () => {
  assert.match(journal, /function DdCalendar\(\{ account, monthCursor, setMonthCursor, onDayClick, balances = \[\], selectedBalanceId = "", onSelectBalance \}\)/);
  assert.match(journal, /balances\.length > 1 && <ThemeSelect value=\{selectedBalanceId\} onChange=\{\(event\) => onSelectBalance\?\.\(event\.target\.value\)\}/);
  assert.match(journal, /onClick=\{\(\) => \(traded \|\| cash\) && onDayClick\(cell\.iso\)\}/);
  assert.match(journal, /<DdCalendar account=\{account\} monthCursor=\{monthCursor\} setMonthCursor=\{setMonthCursor\} onDayClick=\{onDayClick\} balances=\{balances\} selectedBalanceId=\{selectedBalanceId\} onSelectBalance=\{onSelectBalance\}\/>/);
});

test('active desktop Dashboard calendar retains its responsive mockup tiles', () => {
  assert.match(styles, /\.dd-cal \{display:grid;grid-template-columns:repeat\(7,minmax\(0,1fr\)\) 104px/);
  assert.match(styles, /\.dd-day\.is-win/);
  assert.match(styles, /@container journal-workspace \(max-width:760px\)/);
});

test('active desktop Dashboard preserves calendar totals and weekly outcomes', () => {
  assert.match(journal, /const monthStats = computeStats\(account\.trades\.filter\(\(trade\) => trade\.date\?\.slice\(0, 7\) === monthKey\), account\.breakevenCap\);/);
  assert.match(journal, /const snapshots = computeWeeklyBreakdown\(account\.trades, year, month, account\.breakevenCap\);/);
  assert.match(journal, /aria-label=\{`\$\{MONTH_NAMES\[month\]\} \$\{year\} calendar`\}/);
});

test('Dashboard account-base returns preserve their denominator and formatting without extra presentation copy', () => {
  assert.match(journal, /const allTimeReturn = account\.balance \? \(stats\.netPnl \/ account\.balance\) \* 100 : 0;/);
  assert.match(journal, /formatAccountBasePercent\(allTimeReturn\)/);
  assert.match(journal, /formatAccountBasePercent\(percent\)/);
  assert.doesNotMatch(journal, /AccountBaseReturnContext|tj-account-base-return|stored base balance/);
  assert.match(journal, /minimumFractionDigits: 2, maximumFractionDigits: 2/);
});

test('active desktop Dashboard retains the performance-flow card surface', () => {
  assert.match(journal, /className="dd-card dd-pad dd-flow"/);
  assert.match(styles, /\.dd-flow \{display:flex;flex-direction:column;\}/);
  assert.match(journal, /className="dd-row"><h3>Performance Flow<\/h3>/);
  assert.match(journal, /className="dd-tiles"/);
});

test('active Dashboard chart tooltips retain their shared renderer', () => {
  assert.match(journal, /function CompactChartTooltip\(\{ active, payload, label, metric, neutral = false \}\)/);
  assert.match(journal, /content=\{<CompactChartTooltip metric=\{metric\}/);
  assert.match(journal, /content=\{<CompactChartTooltip metric="Equity" neutral\/>\}/);
});

test('active Dashboard account challenges retain their shared panel', () => {
  assert.match(journal, /function AccountChallengeDashboardPanel\(\{ balance, trades, userId, workspace \}\)/);
  assert.match(journal, /accountChallenges\.map\(\(balance\) => <AccountChallengeDashboardPanel/);
  assert.match(journal, /useBalanceChallenge\(\{ \.\.\.balance, trades, balances: workspace\.balances/);
});

test('active Dashboard guardrails retain their shared panel', () => {
  assert.match(journal, /function AccountGuardrailsPanel\(\{ account, guardrails, stats, periodDate = new Date\(\) \}\)/);
  assert.match(journal, /<AccountGuardrailsPanel account=\{account\} guardrails=\{guardrails\} stats=\{stats\}/);
  assert.match(journal, /ACCOUNT GOALS &amp; GUARDRAILS/);
});

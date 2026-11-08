import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./desktopDashboard.css', import.meta.url), 'utf8');

test('desktop shows Dashboard v2; phones keep their own dashboard', () => {
  assert.match(journal, /return phone \? <MobileDashboardV6 \{\.\.\.props\}\/> : <DesktopDashboardV2 \{\.\.\.props\}\/>;/);
  assert.equal((journal.match(/function DesktopDashboardV2\(/g) || []).length, 1);
  assert.match(journal, /import '\.\/desktopDashboard\.css';/);
});

test('Dashboard v2 uses the existing figures', () => {
  assert.match(journal, /const liveBalance = financeTotals\(account\)\.tradingBalance;/);
  assert.match(journal, /function useDashboardBalanceCountUp\(target, duration = 900\)/);
  assert.match(journal, /setShown\(finalValue \* \(1 - Math\.pow\(1 - progress, 3\)\)\);/);
  assert.match(journal, /const live = ddMoneyParts\(useDashboardBalanceCountUp\(liveBalance\), currency\);/);
  assert.match(journal, /<AccountChallengeDashboardPanel key=\{balance\.id\} balance=\{balance\} trades=\{account\.trades\} userId=\{userId\} workspace=\{account\}\/>/);
  assert.match(journal, /<DdCalendar account=\{account\} monthCursor=\{monthCursor\}/);
  assert.match(journal, /const snapshots = computeWeeklyBreakdown\(account\.trades, year, month, account\.breakevenCap\);\n\s*const monthMax/);
  assert.match(journal, /onClick=\{\(\) => \(traded \|\| cash\) && onDayClick\(cell\.iso\)\}/);
  assert.match(journal, /\{guardrails\?\.tradeEntryLocked && <AccountGuardrailsPanel/);
  assert.match(journal, /const allLosing = \[\.\.\.sides, \.\.\.sessions\]\.find\(\(group\) => group\.count >= 3 && group\.wins === 0\);/);
});

test('Dashboard v2 reflows by the page width and respects reduced motion', () => {
  assert.match(css, /@container journal-workspace \(max-width:1080px\) \{\n\s*\.tj-root \.dd-dashboard \.dd-kpis \{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);\}\n\s*\.tj-root \.dd-dashboard :is\(\.dd-g2,\.dd-g3,\.dd-g5\) \{grid-template-columns:minmax\(0,1fr\);\}/);
  assert.match(css, /@media \(min-width:768px\) and \(prefers-reduced-motion:reduce\)/);
  assert.match(css, /\.dd-card \{[^}]*border-radius:20px;/);
  assert.match(css, /\.dd-cal \{display:grid;grid-template-columns:repeat\(7,minmax\(0,1fr\)\) 104px;/);
});

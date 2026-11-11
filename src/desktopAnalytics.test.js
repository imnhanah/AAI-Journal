import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./desktopAnalytics.css', import.meta.url), 'utf8');
const entryComposerCss = readFileSync(new URL('./entryComposer.css', import.meta.url), 'utf8');

test('desktop Analytics uses the current Overview and renamed deck tabs directly', () => {
  assert.match(journal, /import '\.\/desktopAnalytics\.css';/);
  assert.doesNotMatch(journal, /ANALYTICS_V2/);
  assert.match(journal, /: overviewV2\}/);
  assert.match(journal, /\["performance", "Edge", "analytics-performance"\]/);
  assert.match(journal, /\["guardrails", "Discipline & Risk", "analytics-guardrails"\]/);
});

test('Analytics Overview uses the existing figures and opens the other tabs', () => {
  assert.match(journal, /const anDiscipline = Math\.round\(clamp\(anLinkedPct \* \.45 \+ anRulePct \* \.55, 0, 100\)\);/);
  assert.match(journal, /onClick=\{\(\) => setAnalyticsTab\("performance"\)\}/);
  assert.match(journal, /onClick=\{\(\) => setAnalyticsTab\("rhythm"\)\}/);
  assert.match(journal, /onClick=\{\(\) => setAnalyticsTab\("guardrails"\)\}/);
  assert.match(journal, /const anMoney = \(value\) => fmtMoney\(Number\(value\) \|\| 0\);/);
  assert.match(journal, /const shownCurrentEquity = useDashboardBalanceCountUp\(currentEquity\);/);
  assert.match(journal, /<div className="an2-bal"><b className="an2-num">\{fmtMoney\(shownCurrentEquity\)\}<\/b><span>live balance<\/span><\/div>/);
});

test('active Analytics retains its shared presentation helpers', () => {
  assert.match(journal, /const AnStat = \(\{ label, value, sub, tone = "", extra = "" \}\)/);
  assert.match(journal, /const AnRing = \(\{ value, main, sub, size = 104 \}\)/);
  assert.match(journal, /const anGrade = \(grade\)/);
  assert.match(journal, /const anTone = \(value\) => Number\(value\) > 0 \? "is-gain"/);
  assert.match(journal, /className="tj-compact-chart-tooltip"><header><small>\{metric\}<\/small><span>Chart point<\/span><\/header>/);
  assert.match(entryComposerCss, /border-left:3px solid var\(--accent\)/);
});

test('Analytics v2 spans the old two-column grid, keeps the banner height and reflows by page width', () => {
  assert.match(css, /display:flex;flex-direction:column;grid-column:1\/-1;/);
  assert.match(css, /\.tj-signal-page-analytics \{position:relative;display:flex;flex:none;/);
  assert.match(css, /@container journal-workspace \(max-width:1280px\) \{\n\s*\.tj-root \.an2 \.an2-a1 \{grid-template-columns:minmax\(0,1fr\);\}/);
  assert.match(css, /@media \(min-width:768px\) and \(prefers-reduced-motion:reduce\)/);
});

test('Analytics v2 does not inherit the legacy full-height scroll tracks', () => {
  assert.match(css, /\.tj-root\.tj-root \.tj-content:has\(\.an2\),[\s\S]*?\.tj-root\.tj-root \.tj-reference-analytics:has\(\.an2\) \{min-height:0;\}/);
  assert.match(css, /\.tj-root\.tj-root \.tj-content-inner:has\(\.an2\),[\s\S]*?\.tj-root\.tj-root \.tj-reference-analytics:has\(\.an2\) \{flex:none;\}/);
  assert.match(css, /\.tj-reference-analytics-overview>\.tj-view-transition \{\s*grid-template-rows:none;\s*grid-auto-rows:auto;/);
});

test('Analytics v2 Edge has entry models, instruments and markups with a section bar', () => {
  assert.match(journal, /<AnSectionNav items=\{\[\["models", "Entry models"\], \["instruments", "Instruments"\], \["markups", "Markups"\]\]\}\/>/);
  assert.match(journal, /const edgeModels = \[\.\.\.tagStats\]\.sort\(\(a, b\) => b\.netPnl - a\.netPnl\);/);
  assert.match(journal, /const topMarkup = markupRows\.length \? markupRows\[0\] : null;/);
  assert.match(journal, /const reviewMarkup = markupRows\.length \? markupRows\[markupRows\.length - 1\] : null;/);
  assert.match(journal, /<div className="an2 an2-edge" id="analytics-performance">/);
  assert.match(journal, /className="tj-markup-hover-card"/);
  assert.match(journal, /className="tj-markup-hover-metrics"/);
  assert.match(journal, /onClick=\{onViewMarkups\}>View all plans/);
  assert.match(css, /\.an2-snav \{position:sticky;top:8px;/);
  assert.match(entryComposerCss, /\.tj-root \.tj-markup-hover-card \{ overflow:hidden;/);
});

test('Analytics v2 Rhythm shows execution, sessions, timing and month with the monthly range switch', () => {
  assert.match(journal, /function AnRhythmSection\(\{ id, title, sub, rows = \[\], unit/);
  assert.match(journal, /<div className="an2 an2-rhythm" id="analytics-rhythm">/);
  assert.match(journal, /function ExecutionRhythmView\(\{ account, trades, cap, stats, monthlyYear, sessionStats \}\) \{\n\s*return <AnalyticsRhythmV2 account=\{account\} trades=\{trades\} cap=\{cap\} stats=\{stats\} monthlyYear=\{monthlyYear\} sessionStats=\{sessionStats\}\/>;/);
  assert.match(journal, /<AnSectionNav items=\{\[\["week", "Week"\], \["sessions", "Sessions"\], \["timing", "Timing"\], \["month", "Month"\]\]\}\/>/);
  assert.match(journal, /<h3>Execution rhythm<\/h3>/);
  assert.match(journal, /const weekPageCount = Math\.max\(1, Math\.ceil\(weeks\.length \/ 26\)\);/);
  assert.match(journal, /Swipe the chart for earlier weeks/);
  assert.match(journal, /Weeks \{visibleWeekStart\}–\{visibleWeekEnd\} of \{weeks\.length\}/);
  assert.match(journal, /<Tooltip cursor=\{false\} content=\{<CompactChartTooltip metric=\{chartTitle\}\/>\} \/>/);
  assert.match(journal, /title="Session performance"/);
  assert.match(journal, /title="Entry-time analysis"/);
  assert.match(journal, /sessionStats=\{sessionStats\}/);
  assert.doesNotMatch(journal, /title="Daily growth"/);
  assert.match(journal, /id === "month" && rows\.length > 0 && <section className="an2-card an2-pad"><div className="an2-sh"><div><h3>Period detail<\/h3>/);
  assert.doesNotMatch(journal, /Monthly P&L evolution/);
  assert.match(journal, /const monthly = monthlyPnlRange\(closedTrades\(account\.trades\), \{ balance: account\.balance, year: monthlyYear, range,/);
  assert.match(journal, /<ExecutionRhythmView account=\{account\} trades=\{trades\} cap=\{cap\} stats=\{stats\} monthlyYear=\{pickerYear\} sessionStats=\{sessionStats\}\/>/);
  assert.match(css, /\.an2-session-row \{display:grid;/);
  assert.match(css, /\.an2-chart-pager \{display:flex;/);
});

test('Analytics v2 Discipline & Risk reuses the guardrail audit and the six score factors', () => {
  assert.match(journal, /<div className="an2 an2-disc" id="analytics-guardrails">/);
  assert.match(journal, /const discipline = Math\.round\(clamp\(linkedPct \* \.45 \+ rulePct \* \.55, 0, 100\)\);\n\s*const avgRR = stats\.total/);
  assert.match(journal, /const preLimitDays = dayAudit\.filter\(\(day\) => day\.used >= 75 && day\.used < 100\)\.length;/);
  assert.match(journal, /<AnStat label="Risk slices" value=\{riskSlices \|\| "—"\}/);
  assert.match(css, /\.an2-ur \.an2-bar2 u \{position:absolute;top:-2px;bottom:-2px;left:75%;/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./desktopAnalytics.css', import.meta.url), 'utf8');

test('desktop Analytics shows the v2 Overview and the renamed deck tabs', () => {
  assert.match(journal, /const ANALYTICS_V2 = true;/);
  assert.match(journal, /import '\.\/desktopAnalytics\.css';/);
  assert.match(journal, /: ANALYTICS_V2 \? overviewV2 : <>/);
  assert.match(journal, /\["performance", ANALYTICS_V2 \? "Edge" : "Performance Metrics", "analytics-performance"\]/);
  assert.match(journal, /\["guardrails", ANALYTICS_V2 \? "Discipline & Risk" : "Risk Guardrails", "analytics-guardrails"\]/);
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
});

test('Analytics v2 spans the old two-column grid, keeps the banner height and reflows by page width', () => {
  assert.match(css, /display:flex;flex-direction:column;grid-column:1\/-1;/);
  assert.match(css, /\.tj-signal-page-analytics \{position:relative;display:flex;flex:none;/);
  assert.match(css, /@container journal-workspace \(max-width:1280px\) \{\n\s*\.tj-root \.an2 \.an2-a1 \{grid-template-columns:minmax\(0,1fr\);\}/);
  assert.match(css, /@media \(min-width:768px\) and \(prefers-reduced-motion:reduce\)/);
});

test('Analytics v2 does not inherit the legacy full-height scroll tracks', () => {
  assert.match(css, /\.tj-root \.tj-content:has\(\.an2\),[\s\S]*?\.tj-root \.tj-reference-analytics:has\(\.an2\) \{min-height:0;\}/);
  assert.match(css, /\.tj-root \.tj-content-inner:has\(\.an2\),[\s\S]*?\.tj-root \.tj-reference-analytics:has\(\.an2\) \{flex:none;\}/);
});

test('Analytics v2 Edge has entry models, instruments and markups with a section bar', () => {
  assert.match(journal, /<AnSectionNav items=\{\[\["models", "Entry models"\], \["instruments", "Instruments"\], \["markups", "Markups"\]\]\}\/>/);
  assert.match(journal, /if \(ANALYTICS_V2\) \{\n\s*const edgeModels = \[\.\.\.tagStats\]\.sort\(\(a, b\) => b\.netPnl - a\.netPnl\);/);
  assert.match(journal, /onClick=\{onViewMarkups\}>View all plans/);
  assert.match(css, /\.an2-snav \{position:sticky;top:8px;/);
});

test('Analytics v2 Rhythm shows day, week and month with the monthly range switch', () => {
  assert.match(journal, /if \(ANALYTICS_V2\) return <AnalyticsRhythmV2 account=\{account\} trades=\{trades\} cap=\{cap\} stats=\{stats\} monthlyYear=\{monthlyYear\}\/>;/);
  assert.match(journal, /<AnSectionNav items=\{\[\["day", "Day"\], \["week", "Week"\], \["month", "Month"\]\]\}\/>/);
  assert.match(journal, /const monthly = monthlyPnlRange\(closedTrades\(account\.trades\), \{ balance: account\.balance, year: monthlyYear, range,/);
  assert.match(journal, /<ExecutionRhythmView account=\{account\} trades=\{trades\} cap=\{cap\} stats=\{stats\} monthlyYear=\{pickerYear\}\/>/);
});

test('Analytics v2 Discipline & Risk reuses the guardrail audit and the six score factors', () => {
  assert.match(journal, /const discipline = Math\.round\(clamp\(linkedPct \* \.45 \+ rulePct \* \.55, 0, 100\)\);\n\s*const avgRR = stats\.total/);
  assert.match(journal, /const preLimitDays = dayAudit\.filter\(\(day\) => day\.used >= 75 && day\.used < 100\)\.length;/);
  assert.match(journal, /<AnStat label="Risk slices" value=\{riskSlices \|\| "—"\}/);
  assert.match(css, /\.an2-ur \.an2-bar2 u \{position:absolute;top:-2px;bottom:-2px;left:75%;/);
});

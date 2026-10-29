import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewLibrarySignals} from './reviewLibrarySummary.js';
const period=(label,netPnl,total,reviewed,returnPct=netPnl)=>({label,stats:{netPnl,total,reviewed,returnPct,winRate:total?50:0,trades:[]}});
test('Review Library signals are derived from the filtered live periods',()=>{
  const months=[period('January',100,3,3),period('February',-20,2,1),period('March',300,4,4),period('April',50,2,0),period('May',0,0,0)];
  const annual=period('Annual',430,11,8);annual.stats.trades=[{rating:4},{rating:3},{rating:0},{rating:'invalid'},{rating:9}];
  const result=reviewLibrarySignals(months,[period('Q1',380,9,8),period('Q2',50,2,0)],annual);
  assert.equal(result.best.label,'March');assert.equal(result.weakest.label,'February');
  assert.equal(result.averageRating,3.5);assert.equal(result.ratedCount,2);
  assert.equal(result.winningStreak,2);assert.equal(result.activeCount,4);
  assert.equal(result.pending.length,2);assert.equal(result.complete.length,2);
});
test('Review Library empty periods do not invent ratings, wins or review completion',()=>{
  const result=reviewLibrarySignals([period('January',0,0,0)],[],period('Annual',0,0,0));
  assert.equal(result.averageRating,null);assert.equal(result.best,undefined);assert.equal(result.winningStreak,0);assert.equal(result.completedQuarters,0);
});
test('Review Library reference is responsive, token-based and keeps text untransformed',()=>{
  const css=readFileSync(new URL('./reviewLibraryRedesign.css',import.meta.url),'utf8');
  assert.match(css,/repeat\(4,minmax/);assert.match(css,/repeat\(6,minmax/);assert.match(css,/@container/);
  assert.doesNotMatch(css,/(?:filter|backdrop-filter)\s*:|#[\da-f]{3,8}\b/);
  // The adaptive coverage ring is positioned with a single static translate at
  // desktop widths; it is not a decorative or perpetual animation.
  assert.match(css,/\.tj-review-coverage-ring \{[^}]*transform:translateY\(-50%\)/);
  assert.match(css,/\.tj-review-coverage-ring \{position:static[^}]*transform:none/);
  // Nine-pixel labels are reserved for the dense 12-month chart axis; all
  // actionable review controls remain at least 12px.
  for(const size of css.matchAll(/font-size:\s*([\d.]+)px/g))assert.ok(Number(size[1])>=9);
  assert.equal((css.match(/font-size:9px/g)||[]).length,3);
  assert.match(css,/\.tj-review-studio-bar small[^}]*font-size:10px/);
  const source=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.ok(source.indexOf('tj-review-annual-hero')<source.indexOf('tj-review-quarter-grid'));
  assert.match(source,/onClick=\{\(\) => openPeriod\(annual\)\}/);
  assert.match(source,/setTradeEditor\(\{ trade \}\)/);
});
test('desktop Review reserves the full account picker width without covering the year arrows',()=>{
  const css=readFileSync(new URL('./reviewLibraryRedesign.css',import.meta.url),'utf8');
  const desktop=css.match(/@media \(min-width:768px\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(desktop,'desktop-only correction leaves the mobile control layout independent');
  assert.match(desktop,/\.tj-review-account-period-controls \.tj-control-account-card \{[^}]*width:156px;[^}]*flex:0 0 156px/);
  assert.match(desktop,/\.tj-review-account-period-controls \.tj-picker-trigger \{[^}]*width:100%;[^}]*min-width:0/);
  assert.match(desktop,/\.tj-review-year-switch \{[^}]*flex-shrink:0/);
  const mobile=readFileSync(new URL('./mobileReview.css',import.meta.url),'utf8');
  assert.match(mobile,/\.tj-control-account-card \{width:auto;flex:1;min-width:0/);
  assert.match(mobile,/\.tj-review-year-switch \.tj-icon-btn \{width:44px;height:44px/);
});
test('Review overview uses neutral cards and numeric ratings without decorative completion bars',()=>{
  const css=readFileSync(new URL('./reviewLibraryRedesign.css',import.meta.url),'utf8');
  assert.match(css,/\.tj-review-state-done \{ border-color:var\(--tj-border\); \}/);
  assert.match(css,/\.tj-review-state-pending \{ border-color:var\(--tj-border\); background:var\(--tj-panel\); \}/);
  assert.match(css,/\.tj-review-library-card:hover \{ border-color:var\(--accent\); \}/);
  assert.match(css,/\.tj-review-state-pending \.tj-review-status \{[^}]*var\(--tj-amber\) 6%/);
  const source=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  const card=source.slice(source.indexOf('const renderPeriodCard ='),source.indexOf('return <div className="tj-review-library tj-review-v2">'));
  assert.doesNotMatch(card,/RatingDisplay|data-chart-fill/);
  assert.match(card,/stat\.reviewed\}\/\{stat\.total\} reviewed/);
  assert.match(card,/rating\.toFixed\(1\)\}\/5/);
  assert.match(card,/onClick=\{\(\) => openPeriod\(period\)\}/);
  const mobile=readFileSync(new URL('./mobileReview.css',import.meta.url),'utf8');
  assert.doesNotMatch(mobile,/border-top:3px solid var\(--accent\)|grid-template-rows:auto auto 4px/);
  assert.match(mobile,/\.tj-review-quarter-card \.tj-review-card-reviewline>span>b \{display:inline;\}/);
});
test('Review distinguishes annual, quarterly and monthly hierarchy without changing semantic return colours',()=>{
  const css=readFileSync(new URL('./reviewLibraryRedesign.css',import.meta.url),'utf8');
  assert.match(css,/\.tj-review-annual-hero \{[^}]*border-top:3px solid var\(--accent\);[^}]*background:linear-gradient/);
  assert.match(css,/\.tj-review-library-card\.tj-review-quarter-card \{[^}]*var\(--accent\) 3%[^}]*box-shadow:inset 0 2px/);
  assert.match(css,/\.tj-review-library-card \{[^}]*background:var\(--tj-panel\)/);
  assert.match(css,/\.tj-review-signal-chips \.tj-green \{ color:var\(--tj-green\); \}/);
  assert.match(css,/\.tj-review-signal-chips \.tj-red \{ color:var\(--tj-red\); \}/);
  assert.doesNotMatch(css,/color:color-mix\(in srgb,var\(--tj-(?:green|red)\)/);
});

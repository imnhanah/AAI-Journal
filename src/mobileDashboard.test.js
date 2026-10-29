import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mobileRoutineStatus} from './mobileNavigation.js';
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
test('phone dashboard restores the calendar, challenge rows and full-width charts',()=>{
  const css=read('./mobileDashboard.css');
  assert.match(css,/@media\(max-width:767px\)/);
  assert.match(css,/\.tj-kpi-challenge \{display:block;grid-column:1\/-1/);
  assert.match(css,/\.tj-dashboard-calendar \{display:block;width:100%/);
  assert.match(css,/\.tj-mobile-calendar-summary \{display:none/);
  assert.match(css,/\.tj-dashboard-analytics-grid \{display:grid;grid-template-columns:minmax\(0,1fr\)/);
  assert.ok([...css.matchAll(/font-size:\s*([\d.]+)px/g)].every(match=>Number(match[1])>=12));
});
test('dashboard routine card uses live progress and the existing start action',()=>{
  const source=read('./TradingJournal.jsx');
  assert.match(source,/const routineStatus = mobileRoutineStatus\(routine\)/);
  assert.match(source,/onStartDay=\{openNewMarkup\}/);
  assert.match(source,/routine=\{routineStore.routine\}/);
  assert.equal(mobileRoutineStatus({}).total,8);
  assert.ok(source.indexOf('className="tj-phone-dashboard-start"')<source.indexOf('className="tj-reference-kpis"'));
  assert.ok(source.indexOf('className="tj-phone-dashboard-quote"')>source.indexOf('className="tj-dashboard-analytics-grid"'));
});
test('daily dashboard uses the specified phone headline, P&L sizing and bounded chart heights',()=>{
  const css=read('./mobileDashboard.css'),source=read('./TradingJournal.jsx');
  assert.match(css,/tj-signal-page-dashboard h1 \{font-size:26px/);
  assert.match(css,/tj-kpi-equity \.tj-reference-kpi-value \{font-size:34px;overflow-wrap:anywhere/);
  assert.match(css,/tj-reference-flow-chart \{height:170px/);
  assert.match(css,/recharts-responsive-container \{height:200px!important/);
  assert.ok(source.includes("Daily routine{' · '}{routineStatus.ticked} / {routineStatus.total} ·"));
});
test('dashboard and calendar lists retain their cards and distribute short lists through the available space',()=>{
  const source=read('./TradingJournal.jsx'),css=read('./entryComposer.css');
  assert.match(source,/\.tj-calendar-workspace \{ display:grid;[^}]*align-items:stretch/);
  assert.match(source,/\.tj-calendar-insights \{ min-width:0; min-height:100%/);
  assert.match(source,/\.tj-calendar-period-panel \.tj-table-wrap \{[^}]*flex:1/);
  assert.match(source,/\.tj-calendar-period-panel \.tj-perf-table \{ min-width:100%; height:100%/);
  assert.match(css,/\.tj-reference-flow \{ min-height:510px; display:flex/);
  assert.match(css,/\.tj-reference-flow-recent \.tj-view-transition \{ order:2; flex:1/);
  assert.match(css,/\.tj-reference-flow:not\(\.tj-reference-flow-recent\) \.tj-view-transition \{ flex:1; display:flex; flex-direction:column; justify-content:space-between/);
  assert.match(css,/\.tj-reference-flow-recent \.tj-recent-table \{ min-height:100%; display:flex; flex-direction:column; justify-content:space-between/);
});

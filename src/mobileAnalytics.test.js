import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
test('phone Analytics has one selector row and four readable short tabs',()=>{
  const source=read('./TradingJournal.jsx'),css=read('./mobileAnalytics.css');
  assert.match(source,/performance:"Metrics",rhythm:"Rhythm",guardrails:"Risk"/);
  assert.match(css,/\.tj-analytics-deck \{display:grid;grid-template-columns:minmax\(0,1fr\) 82px/);
  assert.match(css,/\.tj-analytics-deck-tabs \{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:767px\)/);
});
test('phone Analytics uses stacked charts, two-column facts and six factor bars instead of radar',()=>{
  const css=read('./mobileAnalytics.css'),source=read('./TradingJournal.jsx');
  assert.match(css,/\.tj-analytics-equity-milestones \{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.tj-engine-metrics \{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.tj-core-breakdown-grid>section:first-child>\.recharts-responsive-container/);
  assert.ok(source.includes('6 contributing factors'));
  assert.ok([...css.matchAll(/font-size:\s*([\d.]+)px/g)].every(match=>Number(match[1])>=12));
  assert.doesNotMatch(css,/(?:^|[\s{;])(?:transform|filter|mask-image)\s*:/);
});
test('performance chips show gradient cues only when more views are hidden',()=>{
  const source=read('./AnalyticsViewChips.jsx');
  assert.match(source,/new ResizeObserver\(check\)/);
  assert.match(source,/scrollLeft\+element.clientWidth<element.scrollWidth-1/);
  assert.match(source,/edges.before&&/);assert.match(source,/edges.after&&/);
  assert.match(source,/observer.disconnect\(\)/);
});
test('phone analytics period includes padding within the shared selector row',()=>{
  assert.match(read('./mobileAnalytics.css'),/tj-analytics-period \{width:100%;min-width:0;box-sizing:border-box/);
});

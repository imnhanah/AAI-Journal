import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=()=>fs.readFileSync(new URL('./analyticsLayout.css',import.meta.url),'utf8');
test('Analytics carries available height through wrappers with flexible grid rows',()=>{
  const source=css();
  assert.match(source,/tj-content-inner:has\(.tj-reference-analytics\)/);
  assert.match(source,/grid-template-rows:minmax\(min-content,1.4fr\) minmax\(min-content,1fr\)/);
  assert.match(source,/grid-template-rows:minmax\(220px,1fr\) auto/);
  assert.match(source,/tj-performance-workspace,.tj-execution-workspace,.tj-risk-workspace/);
  assert.doesNotMatch(source,/font-family|color:/);
});
test('execution labels wrap inside content-sized score and uniform three-column metric tracks',()=>{
  const source=css();
  assert.match(source,/minmax\(150px,max-content\)/);
  assert.match(source,/\.tj-engine-metrics \{\s*\/\* The overview has six fixed metrics: keep the desktop scan pattern at 3 × 2\. \*\/\s*grid-template-columns:repeat\(3,minmax\(0,1fr\)\);\s*grid-auto-rows:1fr;/);
  assert.match(source,/\.tj-engine-metrics > div \{\s*height:100%;/);
  assert.match(source,/width:160px;\s*min-width:160px/);
  const journal=fs.readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(journal,/<small>EXECUTION QUALITY<\/small>/);
  assert.doesNotMatch(journal,/EXECUTION<br\/>QUALITY/);
  assert.match(source,/recharts-tooltip-wrapper \{\s*transform:none !important/);
});

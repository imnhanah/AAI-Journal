import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=()=>fs.readFileSync(new URL('./analyticsLayout.css',import.meta.url),'utf8');
test('Analytics carries available height through wrappers with flexible grid rows',()=>{
  const source=css();
  assert.match(source,/tj-content-inner:has\(.tj-reference-analytics\)/);
  assert.match(source,/grid-template-rows:minmax\(min-content,1.4fr\) minmax\(min-content,1fr\)/);
  assert.match(source,/grid-template-rows:minmax\(220px,1fr\) auto/);
  assert.doesNotMatch(source,/font-family|color:/);
});
test('execution labels wrap inside content-sized score and uniform three-column metric tracks',()=>{
  const source=css();
  assert.match(source,/minmax\(150px,max-content\)/);
  assert.match(source,/\.tj-engine-metrics \{\s*\/\* The overview has six fixed metrics: keep the desktop scan pattern at 3 × 2\. \*\/\s*grid-template-columns:repeat\(3,minmax\(0,1fr\)\);\s*grid-auto-rows:1fr;/);
  assert.match(source,/\.tj-engine-metrics > div \{\s*height:100%;/);
  assert.match(source,/width:160px;\s*min-width:160px/);
  const journal=fs.readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(journal,/<h3>Execution score<\/h3>/);
  assert.doesNotMatch(journal,/EXECUTION<br\/>QUALITY/);
  // Tooltip placement is now owned by each responsive chart, rather than a
  // global transform override which broke desktop hover positioning.
  assert.doesNotMatch(source,/recharts-tooltip-wrapper \{\s*transform:none !important/);
});

test('multiple instruments use one compact, paged card while a single instrument keeps the detailed card',()=>{
  const journal=fs.readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  const desktop=fs.readFileSync(new URL('./desktopAnalytics.css',import.meta.url),'utf8');
  assert.match(journal,/edgeInstruments\.length > 1 \? <CompactInstrumentCarousel items=\{edgeInstruments\} stats=\{stats\}\/>/);
  assert.match(journal,/function CompactInstrumentCarousel\(\{ items, stats \}\)/);
  assert.match(journal,/const maxActive = Math\.max\(0, count - 2\)/);
  assert.match(journal,/onTouchStart=.*touchStart\.current/);
  assert.match(journal,/aria-label="Next instruments"/);
  assert.match(desktop,/\.an2-inst-compact \{flex:0 0 50%/);
  assert.match(desktop,/\.an2-inst-track \{display:flex;transition:transform/);
  assert.match(desktop,/\.an2-inst-dots button\.is-active/);
});

test('entry-model cards keep their original design and page only after the second card',()=>{
  const journal=fs.readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  const desktop=fs.readFileSync(new URL('./desktopAnalytics.css',import.meta.url),'utf8');
  assert.match(journal,/<TwoUpCardCarousel items=\{edgeModels\} label="Entry models">/);
  assert.match(journal,/if \(!hasPager\) return <div className="an2-g an2-a2">\{items\.map\(children\)\}<\/div>/);
  assert.match(journal,/const hasPager = count > 2/);
  assert.match(desktop,/\.an2-two-up-slide \{flex:0 0 50%/);
});

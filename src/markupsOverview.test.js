import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
const markupCss=readFileSync(new URL('./entryComposer.css',import.meta.url),'utf8');

test('markup overview presents supporting pair and outcome data without nested cards',()=>{
  assert.match(source,/MARKUPS IN VIEW/);
  assert.match(source,/LINKED P&amp;L/);
  assert.match(source,/tj-markup-overview-card tj-markup-execution-card/);
  assert.match(source,/tj-markup-overview-card tj-markup-coverage-card/);
  assert.match(source,/\.tj-markup-overview-metrics > div \{[^}]*padding: 0;[^}]*border: 0;[^}]*background: transparent;/);
  assert.match(source,/\.tj-markup-outcome-cards > div \{ padding: 0; border: 0; border-radius: 0; background: transparent; \}/);
  assert.match(source,/\.tj-markup-overview-metrics b \{[^}]*overflow-wrap: anywhere;[^}]*white-space: normal;/);
  assert.match(markupCss,/tj-reference-markups \.tj-markup-overview-metrics>div \{[^}]*padding:0;[^}]*border:0;[^}]*background:transparent;/);
  assert.match(markupCss,/tj-reference-markups \.tj-markup-overview-grid \{[^}]*grid-auto-rows:148px;/);
  assert.match(markupCss,/tj-reference-markups \.tj-markup-overview-card \{[^}]*grid-template-rows:auto auto minmax\(0,1fr\);[^}]*height:148px;[^}]*min-height:148px;[^}]*box-sizing:border-box;[^}]*padding:14px;/);
  assert.match(markupCss,/tj-markup-view-card,\s*\.tj-root \.tj-reference-markups \.tj-markup-pnl-card \{ position:relative; \}/);
  assert.match(markupCss,/tj-markup-view-card,\.tj-markup-pnl-card\) \.tj-markup-overview-metrics \{ position:absolute; right:14px; bottom:14px; left:14px; width:auto; height:58px; margin:0; box-sizing:border-box; \}/);
  assert.match(markupCss,/tj-markup-overview-metrics>div \{[^}]*grid-template-rows:auto minmax\(0,1fr\); align-content:space-between;/);
  assert.match(markupCss,/tj-markup-overview-metrics>div:nth-child\(2\) \{ justify-items:end; text-align:right; \}/);
  assert.match(markupCss,/tj-markup-overview-metrics>div:nth-child\(2\) :is\(small,b\) \{ justify-self:end; max-width:100%; overflow-wrap:anywhere; text-align:right; white-space:normal; \}/);
  assert.match(source,/\.tj-markup-execution-card \{ grid-template-rows: auto auto minmax\(0, 1fr\) auto; \}/);
  assert.match(source,/\.tj-markup-coverage-card \.tj-markup-coverage \{ position: absolute; right: 14px; bottom: 14px; left: 14px; height: 58px;/);
});

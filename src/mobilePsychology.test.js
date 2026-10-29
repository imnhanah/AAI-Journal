import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
test('phone Psychology keeps live clean-execution and recovery calculations',()=>{
  const source=read('./TradingJournal.jsx');
  assert.match(source,/psychologyMetrics\(trades, account.breakevenCap\)/);
  assert.match(source,/data.clean\} of \{data.total/);
  assert.match(source,/data.recoveryPnl == null \? "—" : fmtMoney\(data.recoveryPnl\)/);
  assert.match(source,/onClick=\{\(\) => setReviewOpen\(true\)\}/);
});
test('phone Psychology is stacked with a two-column stat grid and unbroken state-shift amounts',()=>{
  const css=read('./mobilePsychology.css');
  assert.match(css,/@media\(max-width:767px\)/);
  assert.match(css,/\.tj-psychology-summary \{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.tj-psychology-shift-list b \{[^}]*white-space:nowrap/);
  assert.match(css,/\.tj-psychology-review-link \{width:100%;min-height:46px/);
  assert.ok([...css.matchAll(/font-size:\s*([\d.]+)px/g)].every(match=>Number(match[1])>=12));
  assert.doesNotMatch(css,/(?:^|[\s{;])(?:transform|filter|mask-image)\s*:/);
});

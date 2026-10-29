import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('phone review keeps readable annual, two-column quarters and one-column monthly rows',()=>{
  const css=readFileSync(new URL('./mobileReview.css',import.meta.url),'utf8');
  for(const size of css.matchAll(/font-size:([\d.]+)px/g))assert.ok(Number(size[1])>=12);
  assert.doesNotMatch(css,/(?:^|[;{])\s*(?:transform|filter|will-change)\s*:/m);
  assert.match(css,/tj-review-annual-result>strong[^}]*font-size:38px/);
  assert.match(css,/tj-review-quarter-grid[^}]*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/tj-review-month-grid[^}]*grid-template-columns:1fr/);
  assert.match(css,/tj-review-write-action[^}]*min-height:44px/);
});
test('phone review uses shorter pending tag without replacing desktop copy or review actions',()=>{
  const source=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(source,/tj-review-desktop-copy">NEEDS REVIEW/);
  assert.match(source,/tj-review-phone-copy">TO REVIEW/);
  assert.match(source,/onClick=\{\(\) => setTradeEditor\(\{ trade \}\)\}/);
});
test('compact month strip is a labelled status readout on phones, with desktop buttons retained',()=>{
  const source=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(source,/const \[phoneReview,setPhoneReview\]=useState/);
  assert.match(source,/tj-review-phone-copy/);
  assert.match(source,/onClick=\{\(\) => openPeriod\(period\)\}/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('phone finance uses readable stacked stats and wrapped ledger descriptions',()=>{
  const css=readFileSync(new URL('./mobileFinance.css',import.meta.url),'utf8');
  for(const size of css.matchAll(/font-size:([\d.]+)px/g))assert.ok(Number(size[1])>=12);
  assert.match(css,/tj-phone-finance-movement>p[^}]*white-space:normal/);
  assert.match(css,/tj-phone-finance-plans article>button[^}]*min-height:44px/);
  assert.doesNotMatch(css,/(?:^|[;{])\s*(?:transform|filter|will-change)\s*:/m);
});
test('phone finance sheet separates its blur and planned transfers require explicit submission',()=>{
  const source=readFileSync(new URL('./MobileFinance.jsx',import.meta.url),'utf8');
  assert.match(source,/tj-phone-finance-backdrop" onClick=\{close\}\/>/);
  assert.match(source,/role="dialog" aria-modal="true"/);
  assert.match(source,/p\.onPlanned\(s\);setError\(''\);setOpen\(true\)/);
  assert.match(source,/if\(await p\.onRecord\(\)\)setOpen\(false\)/);
  assert.match(source,/event\.key==='Escape'/);
});
test('finance permits only the marked filter rail to scroll sideways with an edge fade',()=>{
  const source=readFileSync(new URL('./MobileFinance.jsx',import.meta.url),'utf8');
  assert.match(source,/className="tj-phone-finance-filters" data-scroll-row="true"/);
  assert.match(source,/tj-phone-finance-filter-fade/);
});
test('phone simulated outcomes fit their grid and expanded P&L can wrap',()=>{
  const css=readFileSync(new URL('./mobileBacktest.css',import.meta.url),'utf8');
  assert.match(css,/bt-outcome-summary>\.bt-donut \{width:100px;height:100px;justify-self:start/);
  assert.match(css,/tj-backtest-detail[^}]*overflow-wrap:anywhere;white-space:normal/);
});

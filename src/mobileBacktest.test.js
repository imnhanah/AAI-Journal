import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compactBacktestMoney} from './mobileBacktest.js';
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
test('phone backtests preserve live journal isolation and existing protected actions',()=>{
  const source=read('./BacktestAccounts.jsx');
  assert.match(source,/never change your live journal/);
  assert.match(source,/<PhoneOverviewResults run=\{run\} s=\{stats\}/);
  assert.match(source,/<ConfirmDeleteButton/);
  assert.match(source,/saveTestTrade\(editor.run/);
});
test('phone backtest run has two-column stats and fixed-height equity, with card-based log',()=>{
  const css=read('./mobileBacktest.css'),source=read('./BacktestAccounts.jsx');
  assert.match(css,/@media\(max-width:767px\)/);
  assert.match(css,/\.bt-six-stats \{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.bt-table-head \{display:none/);
  assert.match(css,/border-left:4px solid var\(--tj-green\)/);
  assert.match(source,/<ReferenceLine y=\{stats.equity\[0\]\?\.balance\}/);
  assert.ok([...css.matchAll(/font-size:\s*([\d.]+)px/g)].every(match=>Number(match[1])>=12));
});
test('backtest filter rail has scroll-aware fades and momentum uses short amounts',()=>{
  const source=read('./BacktestFilterRail.jsx');
  assert.match(source,/new ResizeObserver\(check\)/);
  assert.match(source,/edges.after&&/);assert.match(source,/edges.before&&/);
  assert.equal(compactBacktestMoney(-100), '-$100');
  assert.equal(compactBacktestMoney(300), '$300');
  assert.equal(compactBacktestMoney(15000), '$15K');
});

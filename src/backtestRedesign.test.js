import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {backtestLedger} from './backtestLedger.js';

test('backtest ledger includes starting capital, uses closing order and ignores running P&L', () => {
  const trades=[{id:'b',date:'2026-09-02',pnl:300},{id:'a',date:'2026-09-01',pnl:-100},{id:'c',date:'2026-09-03',pnl:999,context:'[aaicorefx-running-trade]'}];
  const ledger=backtestLedger(trades,10000);
  assert.deepEqual(ledger.get('a'),{balance:9900,number:1});
  assert.deepEqual(ledger.get('b'),{balance:10200,number:2});
  assert.deepEqual(ledger.get('c'),{balance:10200,number:3});
  assert.equal(trades[0].id,'b');
});
test('ledger remains consistent for filtered rows and close-date ordering', () => {
  const ledger=backtestLedger([{id:'a',date:'2026-09-01',closeDate:'2026-09-03',pnl:50},{id:'b',date:'2026-09-02',pnl:-20}],100);
  assert.equal(ledger.get('a').balance,130);
  assert.equal(ledger.get('b').number,1);
  assert.equal(backtestLedger([],100).size,0);
});
test('backtest reference styles keep minimum typography and responsive table scrolling', () => {
  const css=readFileSync(new URL('./backtestRedesign.css',import.meta.url),'utf8');
  assert.match(css,/\.bt-table-scroll\s*\{\s*overflow-x:auto/);
  assert.match(css,/\.bt-six-stats/);
  for (const [,size] of css.matchAll(/font-size:\s*(\d+)px/g)) assert.ok(Number(size)>=12);
  assert.doesNotMatch(css,/(?:^|[;{])\s*(?:transform|filter|backdrop-filter):/m);
});
test('light Backtest canvas is transparent while test cards retain their surfaces', () => {
  const css=readFileSync(new URL('./themeTokens.css',import.meta.url),'utf8');
  const light=':root[data-theme="light"] .tj-root.tj-theme-light .bt-reference-library';
  const block=selector=>css.slice(css.indexOf(selector+' {')).split('}')[0];
  assert.ok(css.includes(light+' {'));
  assert.match(block(light),/background:\s*transparent;/);
  assert.match(block(light+' .bt-run'),/background:\s*var\(--card\);/);
  assert.match(block(light+' .bt-run'),/border:\s*1px solid var\(--border-strong\);/);
  assert.match(block(light+' .bt-add'),/background:\s*var\(--card\);/);
});

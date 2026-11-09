import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {netDayCashMovement} from './calendarDaySummary.js';
const journal=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
test('day cash total uses signed real movements independently of trade P&L',()=>{
  assert.equal(netDayCashMovement([{type:'withdrawal',amount:8917.26},{type:'withdrawal',amount:26417.24}]),-35334.5);
  assert.equal(netDayCashMovement([{type:'deposit',amount:'100'}]),100);
  assert.equal(netDayCashMovement([{type:'deposit',amount:100},{type:'transfer',amount:25},{type:'withdrawal',amount:-10}]),65);
  assert.equal(netDayCashMovement([{type:'withdrawal',amount:'bad'}]),0);
  assert.equal(netDayCashMovement([]),0);
});
test('calendar detail uses requested card and text sizes without text transforms',()=>{
  const css=readFileSync(new URL('./calendarDayPopup.css',import.meta.url),'utf8');
  for (const size of [560,26,44]) assert.match(css,new RegExp(':'+size+'px'));
  for (const [,size] of css.matchAll(/font-size:\s*(\d+)px/g)) assert.ok(Number(size)>=12);
  assert.doesNotMatch(css,/(?:^|[;{])\s*(?:transform|filter|backdrop-filter):/m);
});
test('desktop day detail carries the reference summary and active-day navigation',()=>{
  const css=readFileSync(new URL('./calendarDayPopup.css',import.meta.url),'utf8');
  assert.match(journal,/aria-label="Previous active day"/);
  assert.match(journal,/aria-label="Next active day"/);
  assert.match(journal,/className="tj-day-stat-grid"/);
  assert.match(journal,/small>Net R<\/small>/);
  assert.match(css,/\.tj-day-summary-hero/);
  assert.match(css,/\.tj-day-stat-grid/);
  assert.match(css,/@keyframes tj-day-popup-in/);
});

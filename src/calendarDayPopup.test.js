import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {netDayCashMovement} from './calendarDaySummary.js';
test('day cash total uses signed real movements independently of trade P&L',()=>{
  assert.equal(netDayCashMovement([{type:'withdrawal',amount:8917.26},{type:'withdrawal',amount:26417.24}]),-35334.5);
  assert.equal(netDayCashMovement([{type:'deposit',amount:'100'}]),100);
  assert.equal(netDayCashMovement([{type:'deposit',amount:100},{type:'transfer',amount:25},{type:'withdrawal',amount:-10}]),65);
  assert.equal(netDayCashMovement([{type:'withdrawal',amount:'bad'}]),0);
  assert.equal(netDayCashMovement([]),0);
});
test('calendar detail uses requested card and text sizes without text transforms',()=>{
  const css=readFileSync(new URL('./calendarDayPopup.css',import.meta.url),'utf8');
  for (const size of [640,26,46]) assert.match(css,new RegExp(':'+size+'px'));
  for (const [,size] of css.matchAll(/font-size:\s*(\d+)px/g)) assert.ok(Number(size)>=12);
  assert.doesNotMatch(css,/(?:^|[;{])\s*(?:transform|filter|backdrop-filter):/m);
});

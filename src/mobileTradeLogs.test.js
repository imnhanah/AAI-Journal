import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyPhoneTradeFilters,matchesPhoneTrade} from './mobileTradeFilters.js';
test('phone trade filters combine direction, results, sessions, review and inclusive dates',()=>{
  const trade={direction:'BUY',entrySession:'NYC AM',date:'2026-10-08'};
  const all=emptyPhoneTradeFilters();assert.equal(matchesPhoneTrade(trade,all,false,'win'),true);
  const filters={...all,result:'win',direction:'BUY',sessions:['London','NY AM'],review:'needs',from:'2026-10-08',to:'2026-10-08'};
  assert.equal(matchesPhoneTrade(trade,filters,false,'win'),true);
  assert.equal(matchesPhoneTrade(trade,filters,true,'win'),false);
  assert.equal(matchesPhoneTrade({...trade,date:'2026-10-09'},filters,false,'win'),false);
  assert.equal(matchesPhoneTrade(trade,{...filters,direction:'SELL'},false,'win'),false);
  assert.equal(matchesPhoneTrade({...trade,entrySession:'Tokyo'},{...all,sessions:['Asia']},false,'be'),true);
});
test('phone trade log has separate blurred backdrop, readable type and large controls',()=>{
  const css=readFileSync(new URL('./mobileTradeLogs.css',import.meta.url),'utf8');
  for(const size of css.matchAll(/font-size:([\d.]+)px/g))assert.ok(Number(size[1])>=12);
  assert.doesNotMatch(css,/(?:^|[;{])\s*(?:transform|filter|will-change)\s*:/m);
  assert.match(css,/\.tj-phone-log-backdrop[^}]*backdrop-filter/);
  assert.match(css,/min-height:44px/);
  const source=readFileSync(new URL('./MobileTradeLogs.jsx',import.meta.url),'utf8');
  assert.match(source,/aria-modal="true"/);assert.match(source,/event.key==='Escape'/);
  assert.match(source,/event.key==='Tab'/);assert.match(source,/screenshots.slice\(0,2\)/);
});

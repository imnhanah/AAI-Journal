import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compactCalendarAmount,formatCompactAmount,mobileCalendarWeeks} from './mobileCalendar.js';
test('phone calendar amounts omit currency and cents; full values remain in the sheet',()=>{
  assert.equal(compactCalendarAmount(-8917.26),'-8.9K');
  assert.equal(compactCalendarAmount(-26417.24),'-26K');
  assert.equal(compactCalendarAmount(600),'+600');
  assert.equal(compactCalendarAmount(100.22),'+100');
  assert.equal(compactCalendarAmount(1200000),'+1.2M');
});
test('phone calendar groups consecutive quiet weeks without merging active weeks',()=>{
  const rows=mobileCalendarWeeks([{count:1},{count:3},{count:0},{count:0},{count:0}]);
  assert.deepEqual(rows.map(({start,end})=>[start,end]),[[1,1],[2,2],[3,5]]);
  assert.deepEqual(mobileCalendarWeeks([{count:0},{count:1},{count:0}]).map(({start,end})=>[start,end]),[[1,1],[2,2],[3,3]]);
});
test('phone calendar styles retain readable type and separate blur behind the sheet',()=>{
  const css=readFileSync(new URL('./mobileCalendar.css',import.meta.url),'utf8');
  assert.match(css,/grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
  assert.match(css,/max-height:min\(700px,calc\(100dvh - 32px\)\)/);assert.match(css,/overflow-x:auto/);
  assert.doesNotMatch(css,/(?:^|[;{])\s*(?:transform|filter|will-change)\s*:/m);
  for(const size of css.matchAll(/font-size:\s*([\d.]+)px/g))assert.ok(Number(size[1])>=12);
  assert.match(css,/::before[^}]*backdrop-filter/);
});
test('shared compact amounts cover every band, negatives, rounding and invalid input',()=>{
  for(const [value,expected] of [[0,'+0'],[999,'+999'],[1000,'+1K'],[8917.26,'+8.9K'],[9999,'+10K'],[10000,'+10K'],[26350,'+26K'],[999999,'+1000K'],[1000000,'+1M'],[1222184.6,'+1.2M']]){
    assert.equal(formatCompactAmount(value),expected);
    if(value)assert.equal(formatCompactAmount(-value),expected.replace('+','-'));
  }
  assert.equal(formatCompactAmount(Infinity),'+0');
  assert.equal(formatCompactAmount('not a number'),'+0');
  assert.equal(compactCalendarAmount,formatCompactAmount);
});
test('day sheets bound their height and expose exact figures, while weeks share one card',()=>{
  const css=readFileSync(new URL('./mobileCalendar.css',import.meta.url),'utf8');
  assert.match(css,/height:44px; min-height:44px/);
  assert.match(css,/tj-daymodal-summary>strong[^}]*font-size:38px;overflow-wrap:anywhere/);
  assert.match(css,/tj-phone-calendar-weeks \{ display:grid; gap:0; border:1px/);
  const script=readFileSync(new URL('../scripts/check-mobile.js',import.meta.url),'utf8');
  assert.match(script,/includeSheets&&route==='calendar'/);
  assert.match(script,/2026-10-02.*2026-10-06.*2026-10-08/);
});
test('calendar keeps seven shrinkable columns while retaining a 44px-tall touch target on phone widths',()=>{
 const css=readFileSync(new URL('./mobileCalendar.css',import.meta.url),'utf8');
 // At 320px, horizontal cells may be narrower than the ideal 44px target;
 // they must shrink instead of forcing horizontal page overflow.
 assert.ok((320-32-2-4-12)/7>36);
 assert.match(css,/\.tj-attached-calendar-scroll \{[^}]*padding:2px/);
 assert.match(css,/\.tj-attached-calendar-grid \{[^}]*gap:2px/);
 assert.match(css,/\.tj-attached-day \{[^}]*height:44px; min-height:44px;[^}]*min-width:0/);
 const source=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
 assert.match(source,/className="tj-day-trade-chips" data-scroll-row="true"/);
 assert.match(source,/className="tj-day-trade-shots" data-scroll-row="true"/);
});

test('phone month controls reserve a separate quick-jump row and never restore the desktop overflow width',()=>{
 const css=readFileSync(new URL('./mobileCalendar.css',import.meta.url),'utf8');
 assert.match(css,/grid-template-rows:44px auto/);
 assert.match(css,/tj-attached-this-month \{ grid-column:1 \/ -1; grid-row:2;[^}]*min-height:36px/);
 assert.match(css,/tj-attached-month-controls>strong \{[^}]*min-width:0;[^}]*text-overflow:ellipsis/);
 assert.match(css,/tj-attached-calendar-scroll \{ min-width:0; max-width:100%; overflow:hidden/);
 assert.match(css,/tj-attached-calendar-grid \{ min-width:0; grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL(file,import.meta.url),'utf8');
test('phone markup list uses live counts and coverage, full-width actions and one column',()=>{
  const source=read('./TradingJournal.jsx'),css=read('./mobileMarkups.css');
  assert.match(source,/count=\{shown.length\} coverage=\{shownTotalCoverage\}/);
  assert.match(css,/\.tj-phone-new-markup \{height:52px!important/);
  assert.match(css,/\.tj-markup-card-grid \{display:grid;grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css,/\.tj-phone-markup-chips \{display:flex;flex-wrap:wrap/);
});
test('phone markup form has pinned summary/footer and preserves its original save handler',()=>{
  const css=read('./mobileMarkups.css'),source=read('./TradingJournal.jsx');
  assert.match(css,/height:100dvh!important/);assert.match(css,/\.tj-phone-markup-form-scroll \{flex:1;min-height:0;overflow-y:auto/);
  assert.match(source,/onSave=\{save\} editing=\{editing\}/);
  assert.match(source,/onSave\(\{\.\.\.f, market:markupSession\}\)/);
  assert.doesNotMatch(css,/(?:^|[\s{;])(?:transform|will-change|filter)\s*:/);
  assert.ok([...css.matchAll(/font-size:\s*([\d.]+)px/g)].every(match=>Number(match[1])>=12));
});
test('expanded phone cards retain protected deletion and five real screenshot slots',()=>{
  const source=read('./MobileMarkups.jsx');
  assert.match(source,/<ConfirmDeleteButton/);assert.match(source,/onClick=\{stop\(onDelete\)\}/);
  assert.match(source,/event.stopPropagation\(\);return action\(\)/);
  for(const slot of ['preHTF','preH4','preM15','postH4','postM15'])assert.ok(source.includes(slot));
  for(const key of ['marketOutcome','waitedForConditions','outsidePlanReason'])assert.ok(source.includes(key));
});

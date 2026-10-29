import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./DailyRoutine.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('./dailyRoutine.css',import.meta.url),'utf8');
test('routine popup uses settings-scale two columns and live detail cards without celebration',()=>{
  assert.match(css,/width:min\(920px,calc\(100vw - 48px\)\);max-height:92vh/);
  assert.match(css,/\.tj-routine-columns \{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(source,/tj-routine-account-detail/);
  assert.match(source,/tj-routine-news-detail/);
  assert.match(source,/ROUTINE_ICONS/);
  assert.doesNotMatch(css,/confetti|celebration/);
  assert.match(source,/phone&&done&&<div className="tj-routine-phone-confetti"/);
});
test('routine redesign keeps save, dismissal, focus trap and UTC day semantics',()=>{
  assert.match(source,/await onSave\(checked\)/);
  assert.match(source,/REQUIRE_ALL&&!done/);
  assert.match(source,/e.key==='Escape'/);
  assert.match(source,/e.key==='Tab'/);
  assert.match(source,/timeZone:'UTC'/);
  assert.match(source,/activeRoutineItems\(routine\)/);
});

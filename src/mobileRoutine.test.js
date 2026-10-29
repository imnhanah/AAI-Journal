import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('./mobileRoutine.css',import.meta.url),'utf8');
const source=readFileSync(new URL('./DailyRoutine.jsx',import.meta.url),'utf8');
test('phone routine has 38px tiles, a one-column scrolling list and pinned footer',()=>{
  assert.match(css,/@media\(max-width:767px\)/);
  assert.match(css,/width:38px;height:38px;flex:0 0 38px/);
  assert.match(css,/\.tj-routine-columns \{flex:1;grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css,/footer[^}]*flex-shrink:0/);
  assert.match(css,/\.tj-routine-account-detail[^}]*grid-template-columns:minmax\(0,1.25fr\)/);
  for(const size of css.matchAll(/font-size:([\d.]+)px/g))assert.ok(Number(size[1])>=12);
  assert.doesNotMatch(css,/(?:^|[;{])\s*(?:transform|filter|backdrop-filter|will-change)\s*:/m);
});
test('routine phone completion decor and close affordance do not change save behavior',()=>{
  assert.match(source,/phone&&done&&<div className="tj-routine-phone-confetti"/);
  assert.match(css,/height:100dvh;max-height:100dvh/);
  assert.match(css,/tj-routine-ring[^}]*width:64px;height:64px/);
  assert.match(css,/tj-routine-close[^}]*width:44px!important;height:44px!important/);
  assert.match(css,/inset:4px/);
  assert.match(source,/phone&&<small>now/);
});
test('phone routine dismissal saves nothing and fade responds to real scroll overflow',()=>{
  assert.match(source,/scrollHeight-list.clientHeight-list.scrollTop>2/);
  assert.match(source,/new ResizeObserver\(updateScrollCue\)/);
  assert.match(source,/onScroll=\{updateScrollCue\}/);
  assert.match(source,/changedTouches\[0\].clientY-dragStart.current>60\)onClose\(\)/);
  assert.match(source,/await onSave\(checked\)/);
  assert.match(source,/REQUIRE_ALL&&!done/);
  assert.match(source,/filter\(node=>node.getClientRects\(\).length\)/);
});

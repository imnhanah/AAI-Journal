import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {nextHeaderState} from './phoneHeaderScroll.js';

const base = {hidden:false, anchorY:0, headerHeight:90, atBottom:false};

test('any scroll away from the document top hides the header', () => {
  assert.equal(nextHeaderState({...base, y:1}).hidden, true);
  assert.equal(nextHeaderState({...base, y:220}).hidden, true);
});

test('a reverse gesture keeps a hidden header away until the document reaches its real top', () => {
  assert.equal(nextHeaderState({...base, hidden:true, y:190}).hidden, true);
  assert.equal(nextHeaderState({...base, hidden:true, y:1}).hidden, true);
  assert.equal(nextHeaderState({...base, hidden:true, y:0}).hidden, false);
});

test('the document top always shows it, including iOS rubber-banding', () => {
  assert.equal(nextHeaderState({...base, hidden:true, y:0}).hidden, false);
  assert.equal(nextHeaderState({...base, hidden:true, y:-20}).hidden, false);
});

test('the bounce at the end of a page does not bring it back', () => {
  assert.equal(nextHeaderState({...base, hidden:true, y:180, atBottom:true}).hidden, true);
});

test('the header overlays the content and only slides on phones', () => {
  const css = readFileSync(new URL('./mobileBottomBar.css', import.meta.url), 'utf8');
  assert.match(css, /\.tj-topbar \{position:absolute;/);
  assert.match(css, /\.tj-topbar\.tj-topbar-hidden \{transform:translateY\(calc\(-1 \* var\(--tj-header-height\)\)\);/);
  assert.match(css, /\.tj-content \{padding-top:calc\(var\(--tj-header-height\) \+ 12px\);\}/);
  const start = css.indexOf('@media (max-width:767px)');
  assert.ok(start >= 0 && start < css.indexOf('.tj-topbar {position:absolute'));
});

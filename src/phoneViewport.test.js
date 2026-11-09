import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {installedAppHeight, viewportGap} from './phoneViewport.js';

const phone = {standalone:true, innerWidth:393, innerHeight:793, screenWidth:393, screenHeight:852};

test('an installed app measures how far the page stops short of the screen', () => {
  assert.equal(viewportGap(phone), 59);
});

test('the gap follows where fixed items really land, even when the height readings disagree', () => {
  assert.equal(viewportGap({...phone, fixedBottom:852}), 0);
  assert.equal(viewportGap({...phone, innerHeight:852, fixedBottom:793}), 59);
});

test('a browser never gets a gap, because its toolbar sits there', () => {
  assert.equal(viewportGap({...phone, standalone:false}), 0);
});

test('a page that fills the screen has no gap', () => {
  assert.equal(viewportGap({...phone, innerHeight:852}), 0);
});

test('the keyboard is not mistaken for the gap', () => {
  assert.equal(viewportGap({...phone, innerHeight:500}), 0);
});

test('the bar sits inside a taller app rather than being fixed, and nothing clips it', () => {
  const css = readFileSync(new URL('./mobileBottomBar.css', import.meta.url), 'utf8');
  assert.match(css, /html\[data-tj-display-mode="standalone"\].*position:relative;height:var\(--tj-app-height,100dvh\)/);
  assert.doesNotMatch(css, /100dvh \+ var\(--tj-viewport-gap/);
  assert.match(css, /html\[data-tj-display-mode="standalone"\].*\.tj-mobile-bottom \{position:absolute;\}/);
  assert.match(css, /overscroll-behavior:none/);
  assert.doesNotMatch(css, /:has\(\.tj-root\)[^{]*\{[^}]*overflow:hidden/);
  assert.doesNotMatch(css, /:has\(\.tj-root\)[^{]*\{[^}]*position:fixed/);
});

test('headings clear the status bar blur in the installed app', () => {
  const source = readFileSync(new URL('./phoneViewport.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./mobileBottomBar.css', import.meta.url), 'utf8');
  assert.match(source, /export const TOP_CLEARANCE = 26;/);
  assert.match(source, /document\.documentElement\.dataset\.tjDisplayMode = size\.standalone \? 'standalone' : 'browser';/);
  assert.match(css, /padding-top:calc\(env\(safe-area-inset-top,0px\) \+ var\(--tj-top-clearance,0px\)\)/);
  assert.doesNotMatch(css, /:is\(\.tj-page-heading,\.tj-ma-title\)/);
});

test('the installed app height is the screen, whatever the page reports', () => {
  assert.equal(installedAppHeight(phone), 852);
  assert.equal(installedAppHeight({...phone, innerHeight:852}), 852);
  assert.equal(installedAppHeight({...phone, innerWidth:793, innerHeight:393}), 393);
  assert.equal(installedAppHeight({...phone, standalone:false}), null);
});

test('menus and full-screen items sit inside the full-height app', () => {
  const css = readFileSync(new URL('./mobileBottomBar.css', import.meta.url), 'utf8');
  assert.match(css, />:is\(\.tj-mobile-sheet-layer,\.tj-sd-overlay,\.tj-ma-layer,\.tj-modal-overlay\) \{position:absolute;\}/);
  assert.match(css, /bottom:calc\(var\(--mobile-bottom\) \+ 12px\);/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('./shellAlignment.css',import.meta.url),'utf8');
const source=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
const themeGrid=readFileSync(new URL('./ThemeGrid.jsx',import.meta.url),'utf8');
test('shell insets and gutters share one root spacing variable',()=>{
  assert.match(css,/:root \{ --shell-gap:12px; \}/);
  assert.match(css,/gap:var\(--shell-gap\);padding:var\(--shell-gap\)/);
  assert.match(css,/\.tj-main \{[^}]*gap:0/);
  assert.match(css,/\.tj-sidebar-v2 \{[^}]*margin:0 !important;height:100% !important/);
});
test('Option B keeps the header on the canvas and gives the sidebar a token-based rail surface',()=>{
  assert.match(css,/--shell-sidebar-surface:color-mix\(in srgb,var\(--surface\) 88%,var\(--bg\)\)/);
  assert.match(css,/\.tj-sidebar-v2 \{[\s\S]*?background:var\(--shell-sidebar-surface\) !important/);
  assert.match(css,/\.tj-topbar \{[\s\S]*?background:var\(--bg\) !important;[\s\S]*?border-bottom:0 !important/);
  assert.doesNotMatch(css,/\.tj-topbar \{[\s\S]*?background:var\(--color-surface-249\) !important;[\s\S]*?border-bottom:1px solid/);
  assert.match(css,/\.tj-topbar \{[^}]*height:64px;min-height:64px;max-height:64px/);
  assert.match(css,/\.tj-sidebar-header \{[^}]*height:96px;min-height:96px;flex:0 0 96px/);
  assert.ok(source.indexOf('className="tj-content"')>source.indexOf('className="tj-topbar"'));
});
test('header remains in normal flow while only page content scrolls',()=>{
  assert.match(css,/\.tj-topbar \{[^}]*position:relative;inset:auto/);
  assert.doesNotMatch(css,/position:fixed;top:var\(--shell-gap\)/);
  assert.match(css,/height:100%;min-height:0;overflow:visible;margin:0;padding:0/);
  assert.match(css,/padding:0 0 calc\(var\(--shell-gap\) \+ var\(--shell-chat-clearance\)\)/);
  assert.match(css,/overflow-y:auto;background:transparent/);
  assert.doesNotMatch(css,/transition:top|scroll-hidden|scroll-returning/);
  assert.doesNotMatch(source,/scrollHeader|handleContentScroll|revealHeaderAtTop|hideHeaderAfterHover|contentScrollRef|shellHeaderHidden/);
  assert.match(css,/width:56px;height:56px/);
  assert.match(css,/\.tj-sidebar-collapsed \.tj-sidebar-profile-avatar \{width:56px;height:56px/);
  assert.match(css,/box-shadow:[^;]*var\(--tj-accent\)/);
  assert.match(css,/object-position:50% 25%/);
  assert.match(css,/\.tj-sidebar-v2 \.tj-sidebar-list-wrap \{overflow:hidden;contain:paint;\}/);
  assert.match(css,/\.tj-sidebar-v2 \.tj-sidebar-scroll \{flex:1 1 0 !important;min-height:0 !important;overflow-y:auto !important;overflow-x:hidden !important;scrollbar-width:none !important;\}/);
  assert.match(css,/\.tj-sidebar-scroll::\-webkit-scrollbar \{display:none !important;width:0 !important;height:0 !important;\}/);
  assert.match(css,/\.tj-sidebar-v2\.tj-sidebar-collapsed \.tj-sidebar-scroll \{width:100%;margin-right:0;\}/);
});
test('shell text containers do not use compositing or text transforms',()=>{
  assert.doesNotMatch(css,/(?:transform|filter|will-change)\s*:/);
  assert.match(css,/\.tj-topbar::before \{content:none;/);
});
test('floating-button clearance preserves the shared right edge on every page',()=>{
  assert.match(css,/padding:0 0 calc\(var\(--shell-gap\) \+ var\(--shell-chat-clearance\)\)/);
  assert.doesNotMatch(css,/margin-right:\s*var\(--shell-chat-clearance\)/);
  assert.doesNotMatch(css,/\.tj-page-transition\s*>\s*:last-child/);
});
test('Option B inherits canonical shell tokens for every registered theme',()=>{
  const themeIds=[...themeGrid.matchAll(/id: '([^']+)'/g)].map(([, id])=>id);
  assert.equal(themeIds.length,18);
  assert.deepEqual(themeIds,[
    'light-default','light-calm','light-focus','light-warm','light-soft','light-bold','light-fresh','light-neutral','light-dreamy',
    'dark-default','dark-calm','dark-focus','dark-warm','dark-soft','dark-bold','dark-fresh','dark-neutral','dark-signal',
  ]);
  const desktop=css.match(/@media \(min-width:901px\) \{([\s\S]*)$/)?.[1] || '';
  assert.match(desktop,/background:var\(--shell-sidebar-surface\) !important/);
  assert.match(desktop,/background:var\(--bg\) !important/);
  assert.doesNotMatch(desktop,/color-surface-249|color-white/);
});

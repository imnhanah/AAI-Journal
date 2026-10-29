import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scrollEdges, SIDEBAR_SCROLL_OPTIONS} from './sidebarScroll.js';

test('sidebar fades are absent when every navigation item fits',()=>{
  assert.deepEqual(scrollEdges({scrollTop:0,scrollHeight:600,clientHeight:600}),{top:false,bottom:false});
});
test('sidebar fade cues follow the hidden content, including rounding tolerance',()=>{
  assert.deepEqual(scrollEdges({scrollTop:0,scrollHeight:700,clientHeight:400}),{top:false,bottom:true});
  assert.deepEqual(scrollEdges({scrollTop:150,scrollHeight:700,clientHeight:400}),{top:true,bottom:true});
  assert.deepEqual(scrollEdges({scrollTop:299.5,scrollHeight:700,clientHeight:400}),{top:true,bottom:false});
});
test('sidebar uses nearest route scrolling without collapsed hover artifacts',()=>{
  const shell=readFileSync(new URL('./SidebarShell.jsx',import.meta.url),'utf8');
  assert.match(shell,/scrollIntoView\(SIDEBAR_SCROLL_OPTIONS\)/);
  assert.deepEqual(SIDEBAR_SCROLL_OPTIONS,{block:'nearest',inline:'nearest'});
  assert.match(shell,/new ResizeObserver/);
  assert.doesNotMatch(shell,/createPortal|onFocusCapture|onMouseOver|data-sidebar-label/);
  const css=readFileSync(new URL('./sidebarV2.css',import.meta.url),'utf8');
  const shellCss=readFileSync(new URL('./shellAlignment.css',import.meta.url),'utf8');
  assert.doesNotMatch(css,/(?:transform|mask-image)\s*:/);
  assert.doesNotMatch(css,/filter:\s*(?!none\b)\S/);
  assert.match(css,/width:244px/);
  assert.match(css,/width:82px/);
  assert.match(css,/overscroll-behavior:contain/);
  assert.doesNotMatch(css,/sidebar-scroll:hover|tj-sidebar-v2-tooltip/);
  assert.match(css,/\.tj-sidebar-scroll::\-webkit-scrollbar \{display:none;width:0;height:0;\}/);
  assert.match(shellCss,/\.tj-sidebar-v2 \.tj-sidebar-scroll \{flex:1 1 0 !important;min-height:0 !important;overflow-y:auto !important;overflow-x:hidden !important;scrollbar-width:none !important;\}/);
  assert.match(shellCss,/\.tj-sidebar-scroll::\-webkit-scrollbar \{display:none !important;width:0 !important;height:0 !important;\}/);
  assert.match(shellCss,/\.tj-sidebar-v2 \.tj-sidebar-list-wrap \{overflow:hidden;contain:paint;\}/);
});
test('reference sidebar keeps inactive icons muted and collapsed utilities unboxed',()=>{
  const css=readFileSync(new URL('./sidebarV2.css',import.meta.url),'utf8');
  const journal=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(css,/:not\(\.tj-nav-active\):not\(\.tj-nav-danger\) \{color:var\(--tj-muted\)/);
  assert.match(css,/\.tj-sidebar-settings \.tj-nav-item \{background:transparent !important;border-color:transparent !important/);
  assert.match(css,/tj-sidebar-collapsed \.tj-nav-item>span \{display:none !important;\}/);
  assert.match(css,/tj-theme-light \.tj-sidebar-v2 \{background:var\(--color-white\) !important/);
  assert.doesNotMatch(journal,/data-sidebar-label|tj-sidebar-user"[^\n]*\btitle=/);
  assert.match(journal,/tj-theme-nav" onClick=\{handleQuickThemeToggle\}/);
  assert.doesNotMatch(journal,/tj-theme-nav"[^\n]*\btitle=/);
});
test('sidebar footer has only one divider and uses neutral theme surfaces',()=>{
  const css=readFileSync(new URL('./sidebarV2.css',import.meta.url),'utf8');
  assert.match(css,/\.tj-sidebar-settings \{[^}]*padding:0;border-top:0;/);
  assert.match(css,/\.tj-sidebar-footer \{[^}]*border-top:1px solid var\(--border\)/);
  assert.match(css,/\.tj-sidebar-nav-group:last-child \{border-bottom:0;/);
  assert.match(css,/\.tj-sidebar-user \{[^}]*border:1px solid var\(--border\)[^}]*background:var\(--bg\)/);
  assert.match(css,/tj-theme-dark \.tj-sidebar-v2\.tj-sidebar-shown[\s\S]*?tj-sidebar-user \{background:transparent !important;/);
  assert.match(css,/tj-sidebar-collapsed \.tj-sidebar-footer \{display:flex;flex-direction:column;align-items:center;\}/);
  assert.match(css,/tj-sidebar-collapsed \.tj-sidebar-user \{width:54px;height:54px;min-height:54px;box-sizing:border-box;align-self:center;margin:0 auto;/);
});

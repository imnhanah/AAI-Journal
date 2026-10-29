import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const main=readFileSync(new URL('./main.jsx',import.meta.url),'utf8');
const journal=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
const shell=readFileSync(new URL('./shellAlignment.css',import.meta.url),'utf8');
const sidebar=readFileSync(new URL('./sidebarV2.css',import.meta.url),'utf8');
const borderless=readFileSync(new URL('./borderlessInterface.css',import.meta.url),'utf8');

test('the floating shell is inactive and the established edge-aligned desktop shell is restored',()=>{
  assert.doesNotMatch(main,/floatingShell\.css/);
  assert.match(shell,/@media \(min-width:901px\) \{[\s\S]*?padding:0;[\s\S]*?gap:0;/);
  assert.match(shell,/\.tj-sidebar-v2 \{[\s\S]*?height:100dvh !important;[\s\S]*?border-radius:0 !important;/);
  assert.match(shell,/\.tj-topbar \{[\s\S]*?background:var\(--bg\) !important;[\s\S]*?border-bottom:0 !important/);
  assert.match(shell,/\.tj-sidebar-v2 \{[\s\S]*?background:var\(--shell-sidebar-surface\) !important/);
  assert.doesNotMatch(borderless,/App-shell refinement/);
});

test('the profile header keeps the authenticated name expanded and only the avatar collapsed',()=>{
  assert.match(journal,/<span className="tj-sidebar-profile-avatar">\{personalProfileImage[\s\S]*?<\/span>\s*<span className="tj-sidebar-profile-identity"><strong>\{displayName\}<\/strong><\/span>/);
  assert.match(shell,/\.tj-sidebar-profile \{[\s\S]*?display:flex;align-items:center;justify-content:flex-start;gap:12px/);
  assert.match(shell,/\.tj-sidebar-v2\.tj-sidebar-collapsed \.tj-sidebar-profile-identity \{display:none!important;visibility:hidden;width:0;/);
  assert.match(journal,/personalProfileImage \? <img src=\{personalProfileImage\}/);
  assert.match(journal,/: personalInitials/);
});

test('sidebar scrolling, collapse preference, mobile drawer, focus, and board containment remain intact',()=>{
  assert.match(sidebar,/overflow-y:auto;overflow-x:hidden/);
  assert.match(sidebar,/\.tj-sidebar-v2 button:focus-visible \{outline:2px solid/);
  assert.match(journal,/readSidebarExpanded\(user\.id\)/);
  assert.match(journal,/if \(window\.innerWidth <= 900\) updateSidebarOpen\(false\)/);
  assert.match(shell,/\.tj-content:has\(\.cv-board\) \{ overflow:hidden; padding:0; \}/);
  assert.match(shell,/\.cv-board \{ height:100%; min-height:0; \}/);
});

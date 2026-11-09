import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('./sidebarV2.css', import.meta.url), 'utf8');

test('expanded sidebar logout uses semantic theme tokens', () => {
  assert.match(css, /\.tj-sidebar-v2 \.tj-nav-danger \{[\s\S]*color:var\(--color-white\) !important;[\s\S]*background:var\(--tj-red\) !important;[\s\S]*border-color:var\(--tj-red\) !important;/);
  assert.match(css, /tj-theme-light \.tj-sidebar-v2\.tj-sidebar-shown \.tj-nav-danger \{color:var\(--color-white\);background:var\(--tj-red\) !important;border-color:var\(--tj-red\) !important;\}/);
  assert.match(css, /\.tj-nav-danger :is\(svg,span\) \{ color:currentColor !important; \}/);
  assert.match(css, /\.tj-nav-danger:hover:not\(:disabled\) \{[\s\S]*background:color-mix\(in srgb,var\(--tj-red\) 85%,var\(--text\)\) !important;/);
  assert.match(css, /\.tj-nav-danger:active:not\(:disabled\) \{[\s\S]*background:color-mix\(in srgb,var\(--tj-red\) 70%,var\(--text\)\) !important;/);
  assert.match(css, /\.tj-nav-danger:focus-visible \{[\s\S]*outline:2px solid var\(--tj-red\) !important;/);
  assert.match(css, /\.tj-nav-danger:disabled \{[\s\S]*opacity:\.55;/);
});

test('collapsed sidebar logout stays neutral until hover or press', () => {
  assert.match(css, /tj-sidebar-collapsed \.tj-sidebar-settings \.tj-nav-danger \{[\s\S]*color:var\(--tj-muted\) !important;[\s\S]*background:transparent !important;[\s\S]*border-color:transparent !important;/);
  assert.match(css, /tj-sidebar-collapsed \.tj-sidebar-settings \.tj-nav-danger:hover:not\(:disabled\) \{[\s\S]*color:var\(--color-white\) !important;[\s\S]*background:var\(--tj-red\) !important;/);
  assert.match(css, /tj-sidebar-collapsed \.tj-sidebar-settings \.tj-nav-danger:active:not\(:disabled\) \{[\s\S]*color:var\(--color-white\) !important;[\s\S]*background:color-mix\(in srgb,var\(--tj-red\) 85%,var\(--text\)\) !important;/);
});

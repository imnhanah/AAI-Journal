import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css = readFileSync(new URL('./interactiveAccent.css', import.meta.url), 'utf8');
const source = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
test('sidebar image icons use a current-color mask instead of palette-specific filters', () => {
  assert.match(source, /tj-nav-symbol-mask/);
  assert.match(css, /background:currentColor;filter:none/);
  assert.match(css, /mask-image:var\(--nav-symbol-image\)/);
  assert.match(css, /tj-sidebar-collapsed[^\n]+tj-sidebar-glyph \{color:var\(--accent\)/);
});
test('pointer glow and clickable rows follow accent without recoloring financial values', () => {
  assert.match(css, /radial-gradient\(240px circle[^\n]+var\(--accent\) 18%/);
  assert.match(css, /:hover \{background:color-mix\(in srgb,var\(--accent\) 8%,transparent\) !important/);
  assert.doesNotMatch(css, /--tj-green\s*:/);
  assert.doesNotMatch(css, /tj-markup-pnl|recharts/);
  assert.match(css, /tj-single-switch-ack[^\n]+accent-color:var\(--tj-red\)/);
});
test('Challenge summary pointer highlight follows the live accent, not profit green', () => {
  const challenge=readFileSync(new URL('./challenge.css',import.meta.url),'utf8');
  const header=challenge.match(/\.tj-balance-challenge-panel > header::before \{([^}]+)\}/)?.[1];
  assert.ok(header);
  assert.match(header,/color-mix\(in srgb, var\(--accent\) 18%, transparent\)/);
  assert.match(header,/var\(--pointer-x, 50%\) var\(--pointer-y, 50%\)/);
  assert.match(header,/pointer-events:none/);
  assert.doesNotMatch(header,/var\(--tj-green\)|#[\da-f]{3,8}\b/i);
  assert.match(challenge,/header\.tj-pointer-lit::before \{ opacity:1/);
});
test('interaction layer uses tokens and supports reduced motion', () => {
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b|rgba?\([^)]*\)/i);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /:focus-visible/);
});
test('profile and account switches and sidebar account badge use the accent', () => {
  assert.match(css, /tj-profile-redesign,.tj-account-settings-redesign\) \.tj-settings-switch\[aria-checked="true"\] \{background:var\(--accent\)/);
  assert.match(css, /tj-sidebar-user \.tj-account-initial \{color:var\(--accent\)/);
  assert.match(css, /tj-sidebar-profile-avatar \{border-color:var\(--tj-accent-border\)/);
});

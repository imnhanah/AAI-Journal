import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./borderlessInterface.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');
const selectedControls = readFileSync(new URL('./selectedControlBorders.css', import.meta.url), 'utf8');
const shell = readFileSync(new URL('./shellAlignment.css', import.meta.url), 'utf8');

test('borderless interface targets named ordinary surfaces rather than a global reset', () => {
  assert.match(main, /borderlessInterface\.css\?borderless-interface=1/);
  assert.match(css, /\.case-library \.case-study-card/);
  assert.match(css, /\.cse-evidence-list article/);
  assert.match(css, /\.tj-sidebar-v2/);
  assert.doesNotMatch(css, /\*\s*\{[^}]*border:\s*(?:0|none)/s);
  assert.doesNotMatch(css, /\.cv-board|\.cv-world|\.cv-board-text-editor/);
});

test('borderless interactive states use surface fills, not hover outlines', () => {
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(css, /background: var\(--borderless-hover\) !important/);
  assert.match(css, /background: var\(--borderless-selected\) !important/);
  assert.match(css, /border-color: transparent !important/);
  assert.match(css, /transition: background-color 150ms ease/);
});

test('Case Study outer and writing surfaces share the application canvas', () => {
  assert.match(css, /\.case-library,[\s\S]*?\.case-study-editor,[\s\S]*?\.case-secondary-page,[\s\S]*?\.cse-workspace[\s\S]*?background: transparent !important/);
  assert.match(css, /:is\(\.case-library-sidebar, \.cse-outline, \.cse-panel\) \{\n  background: color-mix\(in srgb, var\(--surface\) 80%, var\(--bg\)\) !important/);
  assert.doesNotMatch(css, /#(?:0{3}|000000|0e1412|161e1b)/i);
});

test('keyboard focus is visible and legacy global focus suppression is removed', () => {
  assert.match(css, /:focus-visible \{\n  outline: 2px solid var\(--accent\) !important/);
  assert.doesNotMatch(selectedControls, /button:not\(\[class\*="card"\]\)[\s\S]*?outline:0 !important/);
  assert.doesNotMatch(shell, /:is\(input,textarea,select\):is\(:focus,:focus-visible\)[\s\S]*?outline:none !important/);
});

test('the selected Case Study outline row has readable text and a stronger filled state without an outline', () => {
  assert.match(css, /\.cse-outline li button\.is-active \{\n  background: color-mix\(in srgb, var\(--accent\) 24%, var\(--raised\)\) !important;\n  color: var\(--text\) !important;/);
  assert.match(css, /\.cse-outline li button\.is-active span \{ color: var\(--text\); opacity: \.82; \}/);
});

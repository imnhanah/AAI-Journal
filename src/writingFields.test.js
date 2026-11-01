import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const controls=readFileSync(new URL('./journal-controls.css',import.meta.url),'utf8');
const accents=readFileSync(new URL('./interactiveAccent.css',import.meta.url),'utf8');
const tokens=readFileSync(new URL('./themeTokens.css',import.meta.url),'utf8');
const writing=readFileSync(new URL('./writingFields.css',import.meta.url),'utf8');
const main=readFileSync(new URL('./main.jsx',import.meta.url),'utf8');
const themes=readFileSync(new URL('./ThemeGrid.jsx',import.meta.url),'utf8');

test('ordinary writing no longer inherits the global bright focus border',()=>{
  assert.doesNotMatch(controls,/:is\(input,textarea,\[contenteditable="true"\]\):focus/);
  assert.doesNotMatch(accents,/:is\(\.tj-input,input,textarea,select\):focus/);
  assert.doesNotMatch(tokens,/\.tj-root\.tj-root \.tj-input:focus \{ border-color: var\(--accent\); \}/);
  assert.match(accents,/select,\.tj-picker-trigger,input\[type="number"\],input\[type="date"\],input\[type="time"\],input\[type="file"\]/);
});

test('the late writing layer is borderless for ordinary writing and preserves a minimal keyboard indicator',()=>{
  assert.match(main,/import '\.\/writingFields\.css\?writing-fields=1';/);
  assert.match(writing,/textarea\.tj-input/);
  assert.match(writing,/\.rv-editorial-field input/);
  assert.match(writing,/\.cse-writing textarea/);
  assert.match(writing,/\.rde-content\[contenteditable="true"\]/);
  assert.match(writing,/border:0 !important;/);
  assert.match(writing,/box-shadow:none !important;/);
  assert.match(writing,/:hover \{ border-color:transparent !important; box-shadow:none !important; \}/);
  assert.match(writing,/:focus-visible \{[\s\S]*?outline:1px solid color-mix\(in srgb,var\(--text\) 42%,transparent\) !important/);
});

test('specialized controls remain outside the minimal underline input system',()=>{
  assert.match(writing,/input\.tj-input:is\(:not\(\[type\]\),\[type="text"\],\[type="email"\],\[type="password"\],\[type="url"\],\[type="tel"\]\)/);
  assert.match(writing,/:not\(\.tj-modal textarea\):not\(\.cv textarea\)/);
  assert.match(writing,/:not\(\[aria-invalid="true"\]\)/);
  assert.match(writing,/input\[type="number"\]/);
  assert.doesNotMatch(writing,/select\.tj-input.*border:0/);
});

test('ordinary text and numeric inputs share token-based underline states',()=>{
  assert.match(writing,/Minimal underline input system/);
  assert.match(writing,/border-bottom:1px solid var\(--tj-input-underline\) !important/);
  assert.match(writing,/border-bottom:2px solid var\(--accent\) !important/);
  assert.match(writing,/\[aria-invalid="true"\].*border-bottom-color:var\(--red\)/);
  assert.match(writing,/input\[type="number"\]::-webkit-inner-spin-button/);
  assert.match(writing,/-moz-appearance:textfield/);
  assert.match(writing,/\.case-search\) input/);
});

test('every registered light and dark theme inherits the same token-based writing treatment',()=>{
  const ids=[...themes.matchAll(/id: '([^']+)'/g)].map(([, id])=>id);
  assert.equal(ids.length,18);
  assert.match(writing,/var\(--surface\)/);
  assert.match(writing,/var\(--bg\)/);
  assert.match(writing,/var\(--text\)/);
  assert.doesNotMatch(writing,/#(?:[0-9a-f]{3}){1,2}\b/i);
});

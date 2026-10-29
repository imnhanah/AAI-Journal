import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('all Trade Log stat cards retain a complete rounded border in either theme',()=>{
  const css=readFileSync(new URL('./entryComposer.css',import.meta.url),'utf8');
  // Three classes outrank the legacy two-class nth-child divider selectors,
  // including the fifth/tenth card right edge and sixth-onward bottom edges.
  const card=css.match(/\.tj-root\.tj-root \.tj-tradelog-reference-summary>div \{([^}]+)\}/)?.[1];
  assert.ok(card,'theme-independent card selector must outrank the old grid rules');
  assert.match(card,/border:1px solid var\(--tj-border\)/);
  assert.match(card,/border-radius:12px/);
  assert.doesNotMatch(card,/border-(?:right|bottom):0/);
  assert.match(card,/background:var\(--tj-panel-alt\)/);
});

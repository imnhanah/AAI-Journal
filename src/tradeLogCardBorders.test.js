import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('all Trade Log stat cards retain a complete rounded border in either theme',()=>{
  const css=readFileSync(new URL('./desktopTradeLogs.css',import.meta.url),'utf8');
  const card=css.match(/\.tl2-card \{([^}]+)\}/)?.[1];
  assert.ok(card,'active desktop Trade Logs cards must define their own surface');
  assert.match(card,/border:1px solid var\(--border\)/);
  assert.match(card,/border-radius:20px/);
  assert.match(card,/background:var\(--surface\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');

test('entry-panel and time-list scrollers hide chrome without disabling scroll', () => {
  const panel = read('./entryComposer.css');
  const picker = read('./journal-controls.css');
  assert.match(panel,/\.tj-entry-panel \.tj-entry-composer-scroll \{[^}]*overflow-y:auto/);
  assert.match(panel,/\.tj-entry-panel \.tj-entry-composer-scroll \{[^}]*scrollbar-width:none!important/);
  assert.match(panel,/\.tj-entry-panel \.tj-entry-composer-scroll::-webkit-scrollbar \{[^}]*display:none!important/);
  assert.match(picker,/\.tj-picker-time \.tj-time-columns \.tj-picker-options\{[^}]*scrollbar-width:none/);
  assert.match(picker,/\.tj-picker-time \.tj-time-columns \.tj-picker-options::-webkit-scrollbar\{[^}]*display:none!important/);
  assert.match(picker,/\.tj-time-columns \.tj-picker-options\{[^}]*overflow-y:auto/);
});

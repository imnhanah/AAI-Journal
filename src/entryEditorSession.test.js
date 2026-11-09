import test from 'node:test';
import assert from 'node:assert/strict';
import {beginEntryEditor, clearEntryEditor} from './entryEditorSession.js';

test('a create request starts a new empty editor session', () => {
  const next = beginEntryEditor({version: 4, editing:{id:'old'}, draft:{asset:'EURUSD'}});
  assert.deepEqual(next, {version:5, editing:null, draft:null});
});

test('an edit request preserves the selected stable record and replaces an old draft', () => {
  const trade = {id:'trade-42', asset:'EURUSD', screenshots:{entry:['saved-image']}};
  const next = beginEntryEditor({version: 1, draft:{asset:'GBPUSD'}}, {editing:trade});
  assert.equal(next.version, 2);
  assert.equal(next.editing, trade);
  assert.equal(next.draft, null);
  assert.equal(next.editing.screenshots.entry[0], 'saved-image');
});

test('switching to a different record produces a distinct hydration boundary', () => {
  const first = beginEntryEditor({}, {editing:{id:'first'}});
  const second = beginEntryEditor(first, {editing:{id:'second'}});
  assert.equal(second.version, first.version + 1);
  assert.equal(second.editing.id, 'second');
});

test('closing an editor clears its selection without changing its completed session version', () => {
  assert.deepEqual(clearEntryEditor({version:7, editing:{id:'trade-42'}, draft:{asset:'EURUSD'}}), {version:7, editing:null, draft:null});
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {disclosurePair} from './disclosurePairs.js';

test('either card opens the same visible row pair', () => {
  const items = Array.from({length:10}, (_,id) => ({id}));
  for (let id=0;id<10;id++) {
    const first = Math.floor(id / 2) * 2;
    assert.deepEqual(disclosurePair(items,id), {[first]:true,[first+1]:true});
  }
});
test('single-column screens and odd final rows have no unrelated partner', () => {
  assert.deepEqual(disclosurePair([{id:'a'},{id:'b'},{id:'c'}],'c'), {c:true});
  assert.deepEqual(disclosurePair([{id:'a'},{id:'b'}],'b',1), {b:true});
  assert.deepEqual(disclosurePair([{id:'a'}],'missing'), {});
});

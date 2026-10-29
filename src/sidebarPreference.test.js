import test from 'node:test';
import assert from 'node:assert/strict';
import {readSidebarExpanded, sidebarPreferenceKey, writeSidebarExpanded} from './sidebarPreference.js';

const storage = () => {
  const values = new Map();
  return {getItem:key => values.has(key) ? values.get(key) : null, setItem:(key,value) => values.set(key,value), values};
};

test('sidebar preference defaults to expanded and persists per signed-in user on this device',()=>{
  const device=storage();
  assert.equal(readSidebarExpanded('one',device),true);
  writeSidebarExpanded('one',false,device);
  assert.equal(readSidebarExpanded('one',device),false);
  assert.equal(readSidebarExpanded('two',device),true);
  assert.notEqual(sidebarPreferenceKey('one'),sidebarPreferenceKey('two'));
});

test('unavailable device storage keeps the sidebar safely expanded',()=>{
  const blocked={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
  assert.equal(readSidebarExpanded('one',blocked),true);
  assert.doesNotThrow(()=>writeSidebarExpanded('one',false,blocked));
});

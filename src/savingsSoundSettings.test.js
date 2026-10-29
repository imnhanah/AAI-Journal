import test from 'node:test';
import assert from 'node:assert/strict';
import { readSavingsSound, saveSavingsSound, SAVINGS_SOUND_KEY } from './savingsSoundSettings.js';

test('savings sound defaults on and preserves on/off through reload', () => {
  const values=new Map();
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  assert.equal(readSavingsSound(storage),true);
  assert.equal(saveSavingsSound(false,storage),true);
  assert.equal(values.get(SAVINGS_SOUND_KEY),'off');
  assert.equal(readSavingsSound(storage),false);
  assert.equal(saveSavingsSound(true,storage),true);
  assert.equal(readSavingsSound(storage),true);
});
test('blocked browser storage is handled without crashing', () => {
  const storage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.equal(readSavingsSound(storage),true);
  assert.equal(saveSavingsSound(false,storage),false);
});

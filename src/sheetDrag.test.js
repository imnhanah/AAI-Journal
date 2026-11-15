import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldCloseSheet} from './sheetDrag.js';

test('a sheet closes past 110px or with a quick flick, and springs back otherwise', () => {
  assert.equal(shouldCloseSheet({distance:120, elapsed:900}), true);
  assert.equal(shouldCloseSheet({distance:60, elapsed:80}), true);
  assert.equal(shouldCloseSheet({distance:60, elapsed:900}), false);
  assert.equal(shouldCloseSheet({distance:0, elapsed:10}), false);
});

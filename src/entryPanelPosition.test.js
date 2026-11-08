import test from 'node:test';
import assert from 'node:assert/strict';
import {normaliseEntryPanelPosition} from './entryPanelPosition.js';

test('entry panel position defaults safely to the existing right-side panel', () => {
  assert.equal(normaliseEntryPanelPosition(), 'right');
  assert.equal(normaliseEntryPanelPosition('invalid'), 'right');
  assert.equal(normaliseEntryPanelPosition('right'), 'right');
  assert.equal(normaliseEntryPanelPosition('left'), 'left');
});

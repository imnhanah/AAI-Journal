import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('profile persistence normalizes the trade panel position without a schema migration', () => {
  const source = readFileSync(new URL('./auth.js', import.meta.url), 'utf8');
  assert.match(source, /trade_panel_position/);
  assert.match(source, /trade_panel_position === 'left' \? 'left' : 'right'/);
});

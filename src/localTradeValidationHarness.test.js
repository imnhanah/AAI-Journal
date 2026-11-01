import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');
const harness = readFileSync(new URL('./LocalTradeValidationHarness.jsx', import.meta.url), 'utf8');

test('local trade validation harness is development-only and uses the real form', () => {
  assert.match(main, /import\.meta\.env\.DEV[\s\S]*LocalTradeValidationHarness/);
  assert.match(main, /pathname === '\/__local-validation'/);
  assert.match(harness, /NewTradeModal/);
  assert.match(harness, /LOCAL VALIDATION TEST — NO DATA SAVED/);
  assert.match(harness, /onSave=\{saveLocally\}/);
  assert.doesNotMatch(harness, /from ['"]\.\/db|supabase|createTrade|updateTrade|deleteTrade/);
});

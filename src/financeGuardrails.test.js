import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('loss guardrails do not lock cash movements or ledger corrections', () => {
  const source = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
  const handlers = source.slice(source.indexOf('const handleRecordFinanceMovement'), source.indexOf('const handleSaveChallengeSetup'));
  assert.ok(handlers.includes('createFinanceMovement'));
  assert.ok(handlers.includes('deleteFinanceMovement'));
  assert.doesNotMatch(handlers, /tradeEntryLocked|accountLossGuardrails/);
  assert.match(source, /accountLossGuardrails[\s\S]*tradeEntryLocked/);
});

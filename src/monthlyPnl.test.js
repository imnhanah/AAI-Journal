import test from 'node:test';
import assert from 'node:assert/strict';
import { monthlyPnlRange } from './monthlyPnl.js';
const now = new Date(2026, 9, 8);
const trades = [{ date: '2020-01-05', pnl: 100 }, { date: '2022-09-01', pnl: -90 }, { date: '2026-03-01', pnl: 50 }, { date: '2026-10-08', pnl: 20 }];
test('all range fills calendar gaps and preserves actual summaries', () => {
  const result = monthlyPnlRange(trades, { balance: 70, range: 'all', now });
  assert.equal(result.rows.length, 82);
  assert.equal(result.years.length, 7);
  assert.equal(result.worst.key, '2022-09');
  assert.equal(result.total, 80);
  assert.equal(result.average, 20);
  assert.equal(result.positive, 3);
});
test('year view includes earlier history in closing balances', () => {
  const result = monthlyPnlRange(trades, { balance: 70, year: 2026, now });
  assert.equal(result.rows.length, 10);
  assert.equal(result.rows[0].openingBalance, 80);
  assert.equal(result.rows.at(-1).closingBalance, 150);
  assert.equal(result.total, 70);
});
test('rolling ranges cover exactly 12 and 36 calendar months', () => {
  assert.equal(monthlyPnlRange(trades, { range: '12m', now }).rows[0].key, '2025-11');
  assert.equal(monthlyPnlRange(trades, { range: '3y', now }).rows.length, 36);
});
test('empty data produces no invented activity', () => {
  const result = monthlyPnlRange([], { range: 'all', now });
  assert.equal(result.rows.length, 0);
  assert.equal(result.best, null);
  assert.equal(result.average, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('backtest and challenge screens load directly with visible preparation states', () => {
  const source = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
  assert.match(source,/import ChallengePage from '.\/ChallengePage';/);
  assert.match(source,/import BacktestAccounts from '.\/BacktestAccounts';/);
  assert.doesNotMatch(source,/React\.lazy\(\(\) => import\('\.\/(?:ChallengePage|BacktestAccounts)'\)\)/);
  assert.match(source,/role="status">Preparing backtests/);
  const entry = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');
  assert.match(entry, /React\.Suspense fallback/);
  assert.match(entry, /role="status"/);
});

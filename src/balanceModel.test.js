import assert from 'node:assert/strict';
import test from 'node:test';
import { activeBalances, balanceResultTotal, normaliseBalance, targetableBalances } from './balanceModel.js';

const workspace = { id: 'strategy', workspaceType: 'multi_balance', balance: 10_000, baseCurrency: 'USD', balances: [
    { id: 'funded', name: 'Funded Pips', startingBalance: 10_000, isActive: true },
    { id: 'alpha', name: 'Alpha Capital', startingBalance: 25_000, isActive: true },
    { id: 'old', name: 'Old account', isActive: false },
  ] };

test('only exposes active balances as trade targets', () => {
  assert.deepEqual(targetableBalances(workspace).map((balance) => balance.id), ['funded', 'alpha']);
  assert.deepEqual(activeBalances(workspace).map((balance) => balance.id), ['funded', 'alpha']);
});

test('keeps standard workspaces limited to one target', () => {
  assert.deepEqual(targetableBalances({ ...workspace, workspaceType: 'standard' }).map((balance) => balance.id), ['funded']);
});

test('normalises a balance without borrowing invalid values', () => {
  assert.deepEqual(normaliseBalance({ name: '  Alpha  ', startingBalance: -20, challengeEnabled: true, challengeStartingBalance: 0 }, workspace), {
    id: undefined, workspaceId: 'strategy', name: 'Alpha', startingBalance: 0, baseCurrency: 'USD', goals: {}, riskSettings: {}, guardrails: {}, challengeEnabled: false, challengeStartingBalance: 0, challengeLevelCount: 30, challengeMode: 'risk', challengeAdaptiveRiskPct: 1, challengeAdaptiveDrawdownPct: 10, isActive: true,
  });
});

test('preserves custom adaptive challenge controls through load and edit normalization', () => {
  const saved = normaliseBalance({
    name: 'Adaptive', startingBalance: 10_000, challengeEnabled: true,
    riskSettings: { challengeLevelCount: 20, challengeReward: 3.2, challengeAdaptiveRiskPct: 1.75, challengeAdaptiveDrawdownPct: 7.5 },
  }, workspace);
  assert.deepEqual({
    levels: saved.challengeLevelCount, reward: saved.challengeReward,
    risk: saved.challengeAdaptiveRiskPct, drawdown: saved.challengeAdaptiveDrawdownPct,
  }, { levels: 20, reward: 3.2, risk: 1.75, drawdown: 7.5 });

  const edited = normaliseBalance({ ...saved, challengeReward: 3.6, challengeAdaptiveRiskPct: 2.25, challengeAdaptiveDrawdownPct: 8 }, workspace);
  assert.deepEqual({ reward: edited.challengeReward, risk: edited.challengeAdaptiveRiskPct, drawdown: edited.challengeAdaptiveDrawdownPct }, { reward: 3.6, risk: 2.25, drawdown: 8 });
});

test('sums executions for one selected balance only', () => {
  assert.equal(balanceResultTotal([{ balanceId: 'funded', netPnl: 80 }, { balanceId: 'alpha', netPnl: 120 }, { balanceId: 'funded', netPnl: -10 }], 'funded'), 70);
});

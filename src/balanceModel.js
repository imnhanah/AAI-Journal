export const WORKSPACE_TYPES = Object.freeze({
  STANDARD: 'standard',
  MULTI_BALANCE: 'multi_balance',
});

export const CHALLENGE_MODES = Object.freeze({
  RISK: 'risk',
  STREAK: 'streak',
  ADAPTIVE: 'adaptive',
});

export function workspaceType(value) {
  return value === WORKSPACE_TYPES.MULTI_BALANCE
    ? WORKSPACE_TYPES.MULTI_BALANCE
    : WORKSPACE_TYPES.STANDARD;
}

export function isMultiBalanceWorkspace(workspace) {
  return workspaceType(workspace?.workspaceType) === WORKSPACE_TYPES.MULTI_BALANCE;
}

export function activeBalances(workspace) {
  return (workspace?.balances || []).filter((balance) => balance.isActive !== false);
}

export function normaliseBalance(balance, workspace = {}) {
  const currency = balance?.baseCurrency || workspace.baseCurrency || 'USD';
  const startingBalance = Math.max(0, Number(balance?.startingBalance ?? workspace.balance ?? 0) || 0);
  const challengeStartingBalance = Math.max(0, Number(balance?.challengeStartingBalance ?? 0) || 0);
  const storedLevelCount = Number(balance?.challengeLevelCount ?? balance?.riskSettings?.challengeLevelCount);
  const challengeLevelCount = [10, 15, 20, 30].includes(storedLevelCount) ? storedLevelCount : 30;
  const mode = Object.values(CHALLENGE_MODES).includes(balance?.challengeMode) ? balance.challengeMode : CHALLENGE_MODES.RISK;
  return {
    id: balance?.id,
    workspaceId: balance?.workspaceId || workspace.id,
    name: String(balance?.name || 'Primary account').trim() || 'Primary account',
    startingBalance,
    baseCurrency: currency,
    goals: balance?.goals || {},
    riskSettings: balance?.riskSettings || {},
    guardrails: balance?.guardrails || {},
    challengeEnabled: !!balance?.challengeEnabled && startingBalance > 0,
    challengeStartingBalance,
    challengeLevelCount,
    challengeMode: mode,
    ...(Number(balance?.challengeReward ?? balance?.riskSettings?.challengeReward)>0 ? {challengeReward:Number(balance?.challengeReward ?? balance?.riskSettings?.challengeReward)} : {}),
    challengeAdaptiveRiskPct:Number(balance?.challengeAdaptiveRiskPct ?? balance?.riskSettings?.challengeAdaptiveRiskPct ?? 1),
    challengeAdaptiveDrawdownPct:Number(balance?.challengeAdaptiveDrawdownPct ?? balance?.riskSettings?.challengeAdaptiveDrawdownPct ?? 10),
    isActive: balance?.isActive !== false,
  };
}

export function balanceResultTotal(results, balanceId) {
  return (results || [])
    .filter((result) => result.balanceId === balanceId)
    .reduce((total, result) => total + (Number(result.netPnl) || 0), 0);
}

export function targetableBalances(workspace) {
  const balances = activeBalances(workspace);
  return isMultiBalanceWorkspace(workspace) ? balances : balances.slice(0, 1);
}

// Account rows contain only account settings.  Trades, balances, rules and
// other collections have their own mutations and must never be copied through
// an account update from an in-memory snapshot.
export const ACCOUNT_PATCH_FIELDS = Object.freeze([
  'name', 'icon', 'profileImage', 'balance', 'breakevenCap', 'ratingStyle',
  'theme', 'defaultCommission', 'monthlyGoalPct', 'yearlyGoalPct',
  'monthlyGoalAmount', 'yearlyGoalAmount', 'monthlyGoalSource',
  'yearlyGoalSource', 'dailyLossLimitPct', 'monthlyLossLimitPct',
  'positionSizeEnabled', 'positionSizing', 'baseCurrency', 'platform', 'defaultRiskPct',
  'defaultStopLossPips', 'defaultRiskMethod', 'workspaceType',
  'challengeEnabled', 'challengeStartingBalance', 'challengeMode',
  'challengeReward', 'challengeLevelCount', 'challengeAdaptiveRiskPct',
  'challengeAdaptiveDrawdownPct', 'financeEnabled', 'typeTags',
  'mistakeTags', 'confluenceSessions', 'rewardPresets', 'caseStudyWorkspace',
]);

const allowed = new Set(ACCOUNT_PATCH_FIELDS);

export function accountPatch(value = {}, { warn = false } = {}) {
  const ignored = Object.keys(value).filter(key => !allowed.has(key));
  if (warn && ignored.length && import.meta.env?.DEV) {
    console.warn(`Ignoring non-account fields in updateAccount: ${ignored.join(', ')}`);
  }
  return Object.fromEntries(Object.entries(value).filter(([key]) => allowed.has(key)));
}

export function createAccountPatch(source = {}) {
  return Object.fromEntries(ACCOUNT_PATCH_FIELDS
    .filter(key => source[key] !== undefined)
    .map(key => [key, source[key]]));
}

export function mergeAccountPatch(account, patch) {
  return { ...account, ...accountPatch(patch) };
}

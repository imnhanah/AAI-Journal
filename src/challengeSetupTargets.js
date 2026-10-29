export const targetAmount = (percentage, base) => Number((Number(percentage || 0) * Math.max(0, Number(base) || 0) / 100).toFixed(2));
export const targetPercentage = (amount, base) => Number(base) > 0 ? Number((Number(amount || 0) / Number(base) * 100).toFixed(4)) : 0;

export function changeSetupTarget(setup, field, value, source) {
  return source === 'amount'
    ? {...setup, [field]:targetPercentage(value, setup.startingBalance), [`${field}Amount`]:value}
    : {...setup, [field]:value, [`${field}Amount`]:undefined};
}

export function changeSetupBalance(setup, value) {
  const next = {...setup, startingBalance:value};
  for (const field of ['monthlyGoalPct','yearlyGoalPct','dailyLossLimitPct','monthlyLossLimitPct']) {
    if (setup[`${field}Amount`] !== undefined) next[field] = targetPercentage(setup[`${field}Amount`], value);
  }
  return next;
}

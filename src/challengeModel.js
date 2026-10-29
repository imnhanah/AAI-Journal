// Exact lot ladder from Compouding 2 Alpha.xlsx, sheet 20pip.
const LOTS = [0.03,0.04,0.05,0.07,0.09,0.11,0.14,0.19,0.24,0.32,0.41,0.54,0.7,0.91,1.18,1.54,2,2.6,3.37,4.39,5.7,7.41,9.64,12.53,16.28,21.17,27.52,35.78,46.51,60.46];
export const CHALLENGE_PLAN = (() => {
  let balance = 20, previousProfit = 4.5;
  return LOTS.map((lots, index) => {
    const profit = Math.round(lots * 200 * 100) / 100;
    const row = { level: index + 1, start: balance, risk: previousProfit, profit,
      end: balance + profit, lots, tp: 20, sl: previousProfit / (lots * 10),
      riskPct: previousProfit / balance * 100, profitPct: profit / balance * 100 };
    balance = row.end;
    previousProfit = profit;
    return row;
  });
})();
// Mode 2 keeps the exact risk, stop-loss and lot-size ladder above. Only its
// target is 3.1R, so each level's displayed balance compounds from the real
// 3.1R profit instead of the original 20-pip / 1.33R target.
export const STREAK_CHALLENGE_PLAN = (() => {
  let balance = 20;
  return CHALLENGE_PLAN.map((row) => {
    const profit = Math.round(row.risk * 3.1 * 100) / 100;
    const start = balance;
    const end = Math.round((start + profit) * 100) / 100;
    balance = end;
    return {
      ...row,
      start,
      profit,
      end,
      tp: Math.round(row.sl * 3.1 * 100) / 100,
      riskPct: row.risk / start * 100,
      profitPct: profit / start * 100,
    };
  });
})();
export const emptyChallenge = () => ({ activeLevel: 1, statuses: {}, notes: {} });
export const CHALLENGE_LEVEL_OPTIONS = [10, 15, 20, 30];
export const normaliseChallengeLevelCount = value => CHALLENGE_LEVEL_OPTIONS.includes(Number(value)) ? Number(value) : 30;
export const FIXED_CHALLENGE_MAX_LEVEL = 24;
// Challenge funding always comes from the account itself.  The legacy
// challengeStartingBalance field is retained only for older saved workspaces.
const challengeFundingBalance = account => Number(account?.balance ?? account?.challengeStartingBalance);
export const isChallengeEnabled = account => !!account?.challengeEnabled && Number.isFinite(challengeFundingBalance(account)) && challengeFundingBalance(account) > 0;
export const challengeReward = (value, mode = 'risk') => Number(value) > 0 && Number.isFinite(Number(value)) ? Number(value) : mode === 'streak' ? 3.1 : null;
export const canUseLossStreak = reward => Number(reward) >= 2.8 && Number(reward) <= 5;
export const isAdaptiveBalanceMode = mode => mode === 'adaptive';
export function challengeModeActivationRule({mode='risk',reward,balance}={}) {
  if (isAdaptiveBalanceMode(mode)) return null;
  const value=Number(reward);
  const range=mode==='streak' ? [2.8,5] : [1.5,2];
  const modeName=mode==='streak' ? 'Mode 2' : 'Mode 1';
  if (!Number.isFinite(value) || value<range[0] || value>range[1]) {
    return {kind:'reward',message:`${modeName} supports a reward between ${range[0]}R and ${range[1]}R. Choose Mode 3 — Adaptive Balance for a different reward.`};
  }
  const referencePlan=buildChallengePlan(20,mode,30,value);
  const ceiling=referencePlan[FIXED_CHALLENGE_MAX_LEVEL-1]?.start;
  if (Number.isFinite(Number(balance)) && Number(balance)>ceiling) {
    return {kind:'balance',ceiling,message:`This live balance is above Mode 1 and Mode 2’s Level ${FIXED_CHALLENGE_MAX_LEVEL} limit. Use Mode 3 — Adaptive Balance.`};
  }
  return null;
}
export const adaptiveChallengeSettings = settings => {
  const riskPct=Number(settings?.adaptiveRiskPct);
  const drawdownPct=Number(settings?.adaptiveDrawdownPct);
  return {
    riskPct:Number.isFinite(riskPct) && riskPct>0 ? riskPct : 1,
    drawdownPct:Number.isFinite(drawdownPct) && drawdownPct>=0 && drawdownPct<100 ? drawdownPct : 10,
  };
};
export const challengeFailureFloor = (startingBalance, mode='risk', settings={}) => {
  const start=Number(startingBalance);
  if(!Number.isFinite(start) || start<=0) return 0;
  // Modes 1 and 2 always use the worksheet's original Level 1 floor. A
  // larger deposit can fund or jump levels, but it never raises the point at
  // which the fixed $20 ladder fails.
  return isAdaptiveBalanceMode(mode) ? Math.round(start*(1-adaptiveChallengeSettings(settings).drawdownPct/100)*100)/100 : CHALLENGE_PLAN[0].start;
};
export function buildChallengePlan(startingBalance, mode = 'risk', levelCount = 30, rewardRatio = null, adaptiveSettings = {}) {
  const start = Number(startingBalance);
  if (!Number.isFinite(start) || start <= 0) return [];
  if (isAdaptiveBalanceMode(mode)) {
    const {riskPct}=adaptiveChallengeSettings(adaptiveSettings);
    const reward=challengeReward(rewardRatio, 'risk') || 3;
    const profitPct=riskPct*reward;
    let balance=Math.round(start*100)/100;
    return Array.from({length:normaliseChallengeLevelCount(levelCount)},(_,index)=>{
      const levelStart=balance;
      const risk=Math.round(levelStart*riskPct)/100;
      const profit=Math.round(levelStart*profitPct)/100;
      balance=Math.round((levelStart+profit)*100)/100;
      return {level:index+1,start:levelStart,risk,profit,end:balance,lots:0,tp:reward,sl:0,riskPct,profitPct};
    });
  }
  const plan = mode === 'streak' ? STREAK_CHALLENGE_PLAN : CHALLENGE_PLAN;
  const reward = challengeReward(rewardRatio, mode);
  if (!rewardRatio) return plan.slice(0, normaliseChallengeLevelCount(levelCount)).map(row => ({ ...row }));
  let balance = CHALLENGE_PLAN[0].start;
  return CHALLENGE_PLAN.slice(0, normaliseChallengeLevelCount(levelCount)).map(row => {
    const profit = Math.round(row.risk * reward * 100) / 100;
    const start = balance;
    balance = Math.round((start + profit) * 100) / 100;
    return { ...row, start, profit, end:balance, tp:Math.round(row.sl * reward * 100) / 100, riskPct:row.risk / start * 100, profitPct:profit / start * 100 };
  });
}
export function changeChallengeStatus(state, level, status) {
  const levelCount = normaliseChallengeLevelCount(state.automation?.levelCount);
  if (!Number.isInteger(level) || level < 1 || level > levelCount || !['', 'Pass', 'In progress', 'Step back'].includes(status)) throw new Error('Invalid challenge status');
  const statuses = { ...state.statuses, [level]: status };
  // Any move back into an unfinished state invalidates later progress. This
  // keeps the visible ladder sequential whether the user selects Step back,
  // In progress, or Not started.
  if (status === 'Step back' || status === 'In progress' || !status) for (const key of Object.keys(statuses)) if (+key > level) statuses[key] = '';
  if (status === 'Pass') for (let previous = 1; previous < level; previous++) statuses[previous] = 'Pass';
  let activeLevel = state.activeLevel;
  if (status) {
    Object.keys(statuses).forEach(key => { if (+key !== level && statuses[key] === 'In progress') statuses[key] = ''; });
    activeLevel = status === 'Pass' ? Math.min(levelCount + 1, level + 1) : status === 'Step back' ? Math.max(1, level - 1) : level;
    if (activeLevel === levelCount + 1) activeLevel = CHALLENGE_PLAN.slice(0, levelCount).find(row => statuses[row.level] !== 'Pass')?.level || levelCount + 1;
    if (activeLevel <= levelCount && activeLevel !== level) statuses[activeLevel] = 'In progress';
  }
  if (!status) {
    Object.keys(statuses).forEach(key => { if (statuses[key] === 'In progress') statuses[key] = ''; });
    activeLevel = Math.max(1, level - 1);
    statuses[activeLevel] = 'In progress';
  }
  const manualStepBack = status === 'Step back' && level > 1 && state.statuses?.[level] !== 'Step back';
  const automation = manualStepBack ? {...state.automation, manualStepBacks:(state.automation?.manualStepBacks ?? Object.entries(state.statuses || {}).filter(([key,value])=>Number(key)>1 && value==='Step back').length)+1} : state.automation;
  return { ...state, statuses, activeLevel, ...(automation ? {automation} : {}) };
}

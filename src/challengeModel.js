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
// Default rewards, so a trader sees the starting R immediately: each fixed mode
// starts at the minimum of its allowed range.
export const CHALLENGE_DEFAULT_REWARD = {risk:1.5, streak:2.8, adaptive:3};
export const defaultChallengeReward = (mode = 'risk') => CHALLENGE_DEFAULT_REWARD[mode] ?? CHALLENGE_DEFAULT_REWARD.risk;
// Mode 2 keeps the exact risk, stop-loss and lot-size ladder above. Only its
// target is 2.8R (its default), so each level's displayed balance compounds
// from the real 2.8R profit instead of the original 20-pip / 1.33R target.
export const STREAK_CHALLENGE_PLAN = (() => {
  let balance = 20;
  return CHALLENGE_PLAN.map((row) => {
    const profit = Math.round(row.risk * CHALLENGE_DEFAULT_REWARD.streak * 100) / 100;
    const start = balance;
    const end = Math.round((start + profit) * 100) / 100;
    balance = end;
    return {
      ...row,
      start,
      profit,
      end,
      tp: Math.round(row.sl * CHALLENGE_DEFAULT_REWARD.streak * 100) / 100,
      riskPct: row.risk / start * 100,
      profitPct: profit / start * 100,
    };
  });
})();
export const emptyChallenge = () => ({ activeLevel: 1, statuses: {}, notes: {} });
export const CHALLENGE_LEVEL_OPTIONS = [10, 15, 20, 30];
export const normaliseChallengeLevelCount = value => CHALLENGE_LEVEL_OPTIONS.includes(Number(value)) ? Number(value) : 30;
// Funding is deliberately capped at the halfway point of the chosen plan.
// This is separate from trade progression: a trader can earn every later
// level through normal trading.
export const maxFundedChallengeLevel = levelCount => Math.floor(normaliseChallengeLevelCount(levelCount) / 2);
// Challenge funding always comes from the account itself.  The legacy
// challengeStartingBalance field is retained only for older saved workspaces.
const challengeFundingBalance = account => Number(account?.balance ?? account?.challengeStartingBalance);
export const isChallengeEnabled = account => !!account?.challengeEnabled && Number.isFinite(challengeFundingBalance(account)) && challengeFundingBalance(account) > 0;
export const challengeReward = (value, mode = 'risk') => Number(value) > 0 && Number.isFinite(Number(value)) ? Number(value) : mode === 'adaptive' ? null : defaultChallengeReward(mode);
export const canUseLossStreak = reward => Number(reward) >= 2.8 && Number(reward) <= 5;
export const isAdaptiveBalanceMode = mode => mode === 'adaptive';
export function challengeFundingLimit({mode='risk', reward, balance, levelCount=30, linked=false, startingBalance=20}={}) {
  // Adaptive Balance always starts at its own Level 1. It only adopts the
  // funding cap after it is linked to trading activity.
  if (isAdaptiveBalanceMode(mode) && !linked) return null;
  const totalLevels=normaliseChallengeLevelCount(levelCount);
  const plan=buildChallengePlan(isAdaptiveBalanceMode(mode) ? startingBalance : 20,mode,totalLevels,reward);
  const maxLevel=maxFundedChallengeLevel(totalLevels);
  const fundedLevel=plan.reduce((highest,row)=>Math.round(Number(balance)*100) >= Math.round(row.start*100) ? row.level : highest,1);
  const firstProhibited=plan[maxLevel];
  return {
    totalLevels,
    maxLevel,
    fundedLevel,
    firstProhibitedLevel:maxLevel+1,
    firstProhibitedStart:firstProhibited?.start ?? Infinity,
    allowed:fundedLevel<=maxLevel,
    plan,
  };
}
export function challengeDepositFundingRule({mode='risk',reward,balance,levelCount=30,activeLevel=1,failed=false,linked=false,startingBalance=20}={}) {
  const capApplies=!isAdaptiveBalanceMode(mode) || linked;
  if (!capApplies) return {allowed:true,capApplies:false};
  const funding=challengeFundingLimit({mode,reward,balance,levelCount,linked:true,startingBalance});
  if (failed) return {...funding,allowed:funding.allowed,reason:funding.allowed ? null : 'recovery-cap'};
  if (Number(activeLevel)>=funding.maxLevel) return {...funding,allowed:false,reason:'active-cap'};
  return {...funding,allowed:funding.allowed,reason:funding.allowed ? null : 'funding-cap'};
}
const rewardRangeForMode = mode => mode==='streak' ? [2.8,5] : [1.5,2];
// Allowed reward range for a mode. Mode 3 accepts any reward from 1R upward.
export const challengeRewardRange = mode => isAdaptiveBalanceMode(mode) ? [1,null] : rewardRangeForMode(mode);
// An R outside the allowed range snaps back to the nearest allowed value, so
// the trader never saves a setup the mode cannot run.
export function snapChallengeReward(mode, value) {
  const [low,high]=challengeRewardRange(mode);
  const number=Number(value);
  if (!Number.isFinite(number) || number<=0) return defaultChallengeReward(mode);
  const bounded=Math.max(low,high===null ? number : Math.min(high,number));
  return Math.round(bounded*100)/100;
}
const supportsStartingBalance = ({mode,reward,balance,levelCount}) => {
  const funding=challengeFundingLimit({mode,reward,balance,levelCount});
  return funding.allowed;
};
// The rewards (continuous, to the cent) at which a fixed mode can start from
// this balance with this plan length, or null when none of its range fits.
// A higher reward lifts every level's starting balance, so the balance funds a
// lower level: once a reward fits, every higher reward in the range fits too.
export function challengeFitRange({mode, balance, levelCount=30}={}) {
  if (isAdaptiveBalanceMode(mode)) return {rewardMin:1,rewardMax:null};
  const [low,high]=rewardRangeForMode(mode);
  const fits=reward=>supportsStartingBalance({mode,reward,balance,levelCount});
  if (!Number.isFinite(Number(balance)) || !fits(high)) return null;
  let first=Math.round(low*100),last=Math.round(high*100);
  while (first<last) {
    const middle=Math.floor((first+last)/2);
    if (fits(middle/100)) last=middle; else first=middle+1;
  }
  return {rewardMin:first/100,rewardMax:high};
}
// Every setup that fits this balance, grouped by mode in the order Mode 1,
// Mode 2, Mode 3. Mode 3 always fits. The UI shows all of them and lets the
// trader choose. Nothing is applied until it is selected and saved.
export function challengeSetupFits({balance}={}) {
  const fits=[];
  for (const mode of ['risk','streak']) {
    for (const levelCount of CHALLENGE_LEVEL_OPTIONS) {
      const range=challengeFitRange({mode,balance,levelCount});
      if (range) fits.push({mode,levelCount,...range});
    }
  }
  for (const levelCount of CHALLENGE_LEVEL_OPTIONS) fits.push({mode:'adaptive',levelCount,rewardMin:1,rewardMax:null});
  return fits;
}
const modeLabel = mode => mode==='streak' ? 'Mode 2' : mode==='adaptive' ? 'Mode 3' : 'Mode 1';
export const challengeFitLabel = fit => fit.mode==='adaptive'
  ? `Mode 3 · Adaptive Balance · ${fit.levelCount} levels`
  : `${modeLabel(fit.mode)} · ${fit.rewardMin}R–${fit.rewardMax}R · ${fit.levelCount} levels`;
export function challengeFundingRecommendations({balance}={}) {
  return challengeSetupFits({balance}).map(fit=>({kind:'fit',...fit,reward:fit.mode==='adaptive' ? null : fit.rewardMin,label:challengeFitLabel(fit)}));
}
export function challengeModeActivationRule({mode='risk',reward,balance,levelCount=30}={}) {
  if (isAdaptiveBalanceMode(mode)) return null;
  const value=Number(reward);
  const range=rewardRangeForMode(mode);
  const modeName=mode==='streak' ? 'Mode 2' : 'Mode 1';
  if (!Number.isFinite(value) || value<range[0] || value>range[1]) {
    return {kind:'reward',snappedReward:snapChallengeReward(mode,value),message:`${modeName} supports a reward between ${range[0]}R and ${range[1]}R. Choose Mode 3 — Adaptive Balance for a different reward.`};
  }
  const funding=challengeFundingLimit({mode,reward:value,balance,levelCount});
  if (Number.isFinite(Number(balance)) && !funding.allowed) {
    const recommendations=challengeFundingRecommendations({balance});
    return {kind:'balance',ceiling:funding.firstProhibitedStart-0.01,fundedLevel:funding.fundedLevel,maxFundedLevel:funding.maxLevel,recommendations,message:`Starting balance exceeds the funding limit. Your starting balance would fund Level ${funding.fundedLevel}, but your selected ${funding.totalLevels}-level challenge allows starting funding only up to Level ${funding.maxLevel}.`};
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
    const reward=Number(rewardRatio)>0 && Number.isFinite(Number(rewardRatio)) ? Number(rewardRatio) : CHALLENGE_DEFAULT_REWARD.adaptive;
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
  const reward = challengeReward(rewardRatio, mode === 'streak' ? 'streak' : 'risk');
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

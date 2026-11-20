import {buildChallengePlan, isChallengeEnabled, normaliseChallengeLevelCount, canUseLossStreak, isAdaptiveBalanceMode, challengeFailureFloor, maxFundedChallengeLevel, defaultChallengeReward} from './challengeModel.js';
import {normaliseAdaptiveStepBack} from './challengeRules.js';
import {linkedChallengeTrades, closedChallengeTrade, cashImpact, fundedChallengeLevel, liveChallengeBalance} from './challengeLifecycle.js';
const RUNNING_TRADE_MARKER = '[aaicorefx-running-trade]';
const isClosedTrade = closedChallengeTrade;
export const validMode = mode => mode === 'risk' || mode === 'streak' || mode === 'adaptive' ? mode : null;
// A pass belongs to one closed trade. No accumulated profit or remembered
// earlier attempt can satisfy either half of this shared three-mode gate.
export function challengeTradePasses({netPnl, profitTarget, netBalance, balanceTarget}) {
  const values=[netPnl,profitTarget,netBalance,balanceTarget];
  if(values.some(value=>value==null || value==='' || !Number.isFinite(Number(value)))) return false;
  const [profit,requiredProfit,balance,requiredBalance]=values.map(value=>Math.round(Number(value)*100));
  return requiredProfit>0 && requiredBalance>0 && profit>=requiredProfit && balance>=requiredBalance;
}
// A single recorded net loss must be strictly greater than 40% of planned risk.
// Compare integer cents without rounding the percentage threshold up or down.
export function modeOneTradeStepsBack(netPnl, plannedRisk) {
  if ([netPnl, plannedRisk].some(value => value == null || value === '' || !Number.isFinite(Number(value)))) return false;
  const netCents = Math.round(Number(netPnl) * 100);
  const riskCents = Math.round(Number(plannedRisk) * 100);
  return riskCents > 0 && netCents < 0 && (-netCents * 100) > (riskCents * 40);
}

export function challengeProfitTarget(row,mode,balanceBeforeTrade) {
  return isAdaptiveBalanceMode(mode)
    ? Math.round(Number(balanceBeforeTrade)*Number(row.profitPct || 0))/100
    : row.profit;
}

export function localCheckpoint(now = new Date()) {
  const pad = n => String(n).padStart(2,'0');
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
// A checkpoint freezes prior progress. Closing information is purely metadata.
export function resetAutomation(state, trades, mode, level = state.activeLevel, now = new Date(), levelCount = state.automation?.levelCount, startingBalance = state.automation?.startingBalance) {
  const totalLevels = normaliseChallengeLevelCount(levelCount);
  if (!Number.isInteger(level) || level < 1 || level > totalLevels + 1) throw new Error('Choose a valid challenge level.');
  const statuses = {...state.statuses};
  for (const key of Object.keys(statuses)) if (statuses[key] === 'In progress') statuses[key] = '';
  if (level <= totalLevels) statuses[level] = 'In progress';
  return {activeLevel:level, statuses, notes:{...state.notes}, automation:{
    mode:validMode(mode), levelCount:totalLevels, rewardRatio:state.automation?.rewardRatio ?? null, adaptiveRiskPct:state.automation?.adaptiveRiskPct, adaptiveDrawdownPct:state.automation?.adaptiveDrawdownPct, adaptiveStepBack:mode==='adaptive' ? normaliseAdaptiveStepBack(state.automation?.adaptiveStepBack) : undefined, manualStepBacks:state.automation?.manualStepBacks ?? 0, startedAt:now.toISOString(), version:6,
    ...(Number.isFinite(Number(startingBalance)) && Number(startingBalance) > 0 ? {startingBalance:Math.round(Number(startingBalance)*100)/100} : {}),
    excludedIds:trades.map(t=>t.id),
    // Trades imported after this checkpoint are added explicitly by the
    // importer. This avoids a broker/server timestamp putting a new import
    // outside the active challenge window.
    includedIds:[]
  }};
}
export function replayChallenge(baseline, account) {
  const state = {...baseline, statuses:{...baseline.statuses}, notes:{...baseline.notes}, levelPnl:0, lossStreak:0, counted:0,
    fundingJumps:{}, stepBacks:baseline.automation?.manualStepBacks ?? Object.entries(baseline.statuses || {}).filter(([level,status])=>Number(level)>1 && status==='Step back').length};
  const config=baseline.automation;
  if (!isChallengeEnabled(account) || !validMode(config?.mode) || !config.startedAt) return state;
  const excluded=new Set(config.excludedIds || []);
  const included=new Set(config.includedIds || []);
  const totalLevels=normaliseChallengeLevelCount(config.levelCount);
  const maxFundingLevel=maxFundedChallengeLevel(totalLevels);
  const rewardRatio = config.rewardRatio ?? account.challengeReward;
  const startingBalance=Number(config.startingBalance);
  const hasCapturedBalance=Number.isFinite(startingBalance) && startingBalance>0;
  const challengeStart=hasCapturedBalance ? startingBalance : account.balance ?? account.challengeStartingBalance;
  const plan=buildChallengePlan(challengeStart, config.mode, totalLevels, rewardRatio, config);
  const failureFloor=challengeFailureFloor(challengeStart,config.mode,config);
  // Adaptive Balance has an inclusive drawdown floor: a $100 account with a
  // 50% floor fails at $50 as well as below it. The other modes retain their
  // existing historical threshold behaviour.
  const hasFailedAtBalance = balanceInCents => isAdaptiveBalanceMode(config.mode)
    ? balanceInCents <= Math.round(failureFloor * 100)
    : balanceInCents < Math.round(failureFloor * 100);
  const loggedAt=t=>Date.parse(t.createdAt || `${t.date}T${t.time || '00:00'}`);
  const rows=(account.trades || []).filter(t=>{
    if (excluded.has(t.id) || (t.accountId && t.accountId !== account.id)) return false;
    return isClosedTrade(t) && (included.has(t.id) || loggedAt(t) >= Date.parse(config.startedAt)) && t.pnl != null && t.pnl !== '' && Number.isFinite(Number(t.pnl));
  }).sort((a,b)=>loggedAt(a)-loggedAt(b) || String(a.id).localeCompare(String(b.id)));
  state.settingsLocked = linkedChallengeTrades(baseline,account).length > 0;
  const startTime = Date.parse(config.startedAt);
  const cashRows = (account.financeMovements || []).map(item=>({...item,eventAt:Date.parse(item.createdAt || `${item.date}T23:59:59`)}));
  let live = Math.round((hasCapturedBalance ? startingBalance : Number(account.balance ?? account.challengeStartingBalance) + (account.trades || []).filter(t=>isClosedTrade(t)&&!rows.some(row=>row.id===t.id)).reduce((sum,t)=>sum+Number(t.pnl||0),0) + cashRows.filter(item=>item.eventAt<startTime).reduce((sum,item)=>sum+cashImpact(item),0))*100);
  state.failed = hasFailedAtBalance(live);
  let cents=0;
  const markFundingJump = (from, to, reason) => {
    for (let level=from; level<to; level++) {
      if (state.statuses[level] === 'Pass') continue;
      state.statuses[level]='Jumped';
      state.fundingJumps[level]=reason;
    }
  };
  // The planned starting balance is a hard level minimum in every mode.
  // This only caps progress downward; spare capital never earns a trade pass.
  const enforceBalanceMinimum = balanceInCents => {
    const previous=state.activeLevel;
    const required=previous>totalLevels ? plan[totalLevels-1].end : plan[previous-1]?.start;
    if(!Number.isFinite(required) || balanceInCents>=Math.round(required*100)) return false;
    const fundedLevel=fundedChallengeLevel(plan,balanceInCents/100);
    for(const key of Object.keys(state.statuses)) if(Number(key)>=fundedLevel) delete state.statuses[key];
    for(const key of Object.keys(state.fundingJumps)) if(Number(key)>=fundedLevel) delete state.fundingJumps[key];
    if(previous<=totalLevels && previous!==fundedLevel) {
      state.statuses[previous]='Step back';
      const reason='Stepped back because available capital is below this level’s planned starting balance.';
      if(!String(state.notes[previous] || '').includes(reason)) state.notes[previous]=[state.notes[previous],reason].filter(Boolean).join('\n');
    }
    state.activeLevel=fundedLevel;
    state.statuses[fundedLevel]='In progress';
    cents=0;
    state.lossStreak=0;
    // Report movement to the event owner. Levels crossed are not separate
    // step-back events; opening/final reconciliation must not invent one.
    return Math.min(previous,totalLevels)>fundedLevel;
  };
  const openingFunding = live / 100;
  const openingLevel = fundedChallengeLevel(plan,openingFunding);
  if (openingLevel >= state.activeLevel && state.activeLevel<=totalLevels) {
    markFundingJump(1,openingLevel,'Jumped due to starting balance');
    state.activeLevel=openingLevel;
    state.statuses[openingLevel]='In progress';
  }
  enforceBalanceMinimum(live);
  const events = [...rows.map(trade=>({kind:'trade',eventAt:loggedAt(trade),trade})),...cashRows.filter(item=>item.eventAt>=startTime).map(item=>({kind:'cash',eventAt:item.eventAt,item}))].sort((a,b)=>a.eventAt-b.eventAt || (a.kind==='trade'?-1:1));
  for (const event of events) {
    if (event.kind === 'cash') {
      const impact = cashImpact(event.item);
      const wasFailed=state.failed;
      live += Math.round(impact*100);
      if (impact < 0) {
        // Cash leaving trading capital can make several levels unaffordable.
        // Replay the movement chronologically without changing trading P&L.
        const fundedLevel = fundedChallengeLevel(plan, live/100);
        const required = state.activeLevel > totalLevels ? plan[totalLevels-1].end : plan[state.activeLevel-1].start;
        if (live < Math.round(required*100)) {
          const previous = state.activeLevel;
          for (const key of Object.keys(state.statuses)) {
            if (Number(key) >= fundedLevel) delete state.statuses[key];
          }
          for (const key of Object.keys(state.fundingJumps)) {
            if (Number(key) >= fundedLevel) delete state.fundingJumps[key];
          }
          state.statuses[previous]='Step back';
          const reason=`Stepped back due to ${event.item.type === 'withdrawal' ? 'withdrawal' : 'transfer out'}.`;
          if (!String(state.notes[previous] || '').includes(reason)) state.notes[previous]=[state.notes[previous],reason].filter(Boolean).join('\n');
          state.activeLevel = fundedLevel;
          state.statuses[fundedLevel] = 'In progress';
          if (Math.min(previous, totalLevels) > fundedLevel) state.stepBacks++;
          cents = 0;
          state.lossStreak = 0;
        }
      }
      // Mode 1 and 2 always have a halfway funding cap. Adaptive Balance only
      // does once the challenge has linked trading activity.
      const capApplies=!isAdaptiveBalanceMode(config.mode) || rows.some(trade=>loggedAt(trade)<=event.eventAt);
      if (event.item.type==='deposit' && cashImpact(event.item)>0 && live>=Math.round(failureFloor*100) && state.activeLevel<=totalLevels) {
        const fundedLevel = fundedChallengeLevel(plan,live/100);
        const eligibleRecovery=wasFailed && fundedLevel<=maxFundingLevel;
        const eligibleFunding=!wasFailed && capApplies && state.activeLevel<maxFundingLevel && fundedLevel<=maxFundingLevel;
        if (eligibleRecovery || eligibleFunding || (!capApplies && !wasFailed)) {
          Object.keys(state.statuses).forEach(key=>{if(state.statuses[key]==='In progress')state.statuses[key]='';});
          if (eligibleRecovery) {
            // Recovery restarts at what the restored balance can actually
            // support. Later levels must be earned again.
            for (const key of Object.keys(state.statuses)) if (Number(key)>=fundedLevel) delete state.statuses[key];
            for (const key of Object.keys(state.fundingJumps)) if (Number(key)>=fundedLevel) delete state.fundingJumps[key];
          }
          markFundingJump(eligibleRecovery ? 1 : state.activeLevel,fundedLevel,'Jumped due to deposit-funded balance');
          state.activeLevel=fundedLevel; state.statuses[fundedLevel]='In progress'; delete state.fundingJumps[fundedLevel]; cents=0; state.lossStreak=0;
          state.failed=false;
        }
      } else if (hasFailedAtBalance(live)) state.failed=true;
      enforceBalanceMinimum(live);
      continue;
    }
    const trade=event.trade;
    // Preserve each mode’s profit/risk sizing. All modes additionally require
    // this same close’s real net balance to fund the planned ending balance.
    const balanceBeforeTrade = live;
    const stepBacksBeforeTrade = state.stepBacks;
    live += Math.round(Number(trade.pnl || 0)*100);
    if (state.activeLevel > totalLevels) { enforceBalanceMinimum(live); continue; }
    state.counted++;
    if (state.failed || hasFailedAtBalance(live)) {
      // Count the first failing close without moving its level early. Failed
      // challenges retain their existing replay/final-reconciliation behavior.
      if (!state.failed && Math.min(state.activeLevel,totalLevels) > fundedChallengeLevel(plan,live/100)) state.stepBacks++;
      state.failed=true;
      continue;
    }
    const row=plan[state.activeLevel-1];
    const amount=Number(trade.pnl);
    const net=Math.round(amount*100);
    cents+=net;
    const profitTarget=challengeProfitTarget(row,config.mode,balanceBeforeTrade/100);
    const pass=challengeTradePasses({netPnl:amount,profitTarget,netBalance:live/100,balanceTarget:row.end});
    // Every mode uses recorded net P&L, including commission and swap.
    // Mode 2 counts losses within the current level. A breakeven is neutral:
    // it neither adds a loss nor clears a previous one. Only passing the
    // level (or a resulting step-back below) starts a fresh count. Adaptive
    // Balance uses the same count when "Two losses" is its step-back rule.
    const streakReward = rewardRatio ?? defaultChallengeReward('streak');
    const adaptiveRule = isAdaptiveBalanceMode(config.mode) ? normaliseAdaptiveStepBack(config.adaptiveStepBack) : null;
    const countsLosses = (config.mode === 'streak' && canUseLossStreak(streakReward)) || adaptiveRule === 'two';
    if (countsLosses && amount < 0) state.lossStreak++;
    else if (pass) state.lossStreak=0;
    // Adaptive step-back rules. One loss: any loss above Level 1 steps back.
    // Two losses: the second loss on the level steps back. Net loss: wins and
    // losses on the level add up and the net loss reaching the level's risk
    // (the same share of the balance before the trade) steps back. Level 1 has
    // no lower level, so Two losses and Net loss simply restart the count there.
    const adaptiveRiskCents = Math.round(balanceBeforeTrade * (row.riskPct || 0) / 100);
    const adaptiveBack = adaptiveRule === 'two' ? state.lossStreak >= 2 : adaptiveRule === 'net' ? cents <= -adaptiveRiskCents : amount < 0;
    const back=isAdaptiveBalanceMode(config.mode) ? adaptiveBack && state.activeLevel > 1
      : config.mode === 'streak' && canUseLossStreak(streakReward) ? state.lossStreak >= 2
      : config.mode === 'risk' ? modeOneTradeStepsBack(trade.pnl, row.risk)
      : net <= -Math.round(row.risk*100);
    if (isAdaptiveBalanceMode(config.mode) && !pass && adaptiveBack && state.activeLevel === 1 && adaptiveRule !== 'one') { cents=0; state.lossStreak=0; }
    if (pass || back) {
      const previous=state.activeLevel;
      state.statuses[previous]=pass ? 'Pass' : 'Step back';
      delete state.fundingJumps[previous];
      state.activeLevel=pass ? Math.min(totalLevels + 1,previous+1) : Math.max(1,previous-1);
      if (back && !pass && state.activeLevel < previous) state.stepBacks++;
      if (state.activeLevel <= totalLevels) {state.statuses[state.activeLevel]='In progress';delete state.fundingJumps[state.activeLevel];}
      cents=0; state.lossStreak=0;
    }
    // A single close can trip the loss rule and also cross several balance
    // minimums. Keep its final level, but count the close only once.
    if (enforceBalanceMinimum(live) && state.stepBacks === stepBacksBeforeTrade) state.stepBacks++;
  }
  state.levelPnl=cents/100;
  state.liveBalance=liveChallengeBalance(account);
  // Reconcile saved checkpoints and edited/deleted history against current
  // capital too. This updates the derived level/status shown by every hook,
  // without rewriting trades or persisting a replacement progress record.
  enforceBalanceMinimum(Math.round(state.liveBalance*100));
  state.levelPnl=cents/100;
  const current=plan[Math.min(Math.max(state.activeLevel,1),totalLevels)-1];
  state.currentProfitTarget=state.activeLevel<=totalLevels
    ? challengeProfitTarget(current,config.mode,state.liveBalance)
    : null;
  state.currentBalanceTarget=current.end;
  if (hasFailedAtBalance(Math.round(state.liveBalance * 100))) state.failed=true;
  return state;
}

import {buildChallengePlan, isChallengeEnabled, normaliseChallengeLevelCount, canUseLossStreak, isAdaptiveBalanceMode, challengeFailureFloor} from './challengeModel.js';
import {linkedChallengeTrades, closedChallengeTrade, cashImpact, fundedChallengeLevel, liveChallengeBalance} from './challengeLifecycle.js';
const RUNNING_TRADE_MARKER = '[aaicorefx-running-trade]';
const isClosedTrade = closedChallengeTrade;
export const validMode = mode => mode === 'risk' || mode === 'streak' || mode === 'adaptive' ? mode : null;
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
    mode:validMode(mode), levelCount:totalLevels, rewardRatio:state.automation?.rewardRatio ?? null, adaptiveRiskPct:state.automation?.adaptiveRiskPct, adaptiveDrawdownPct:state.automation?.adaptiveDrawdownPct, manualStepBacks:state.automation?.manualStepBacks ?? 0, startedAt:now.toISOString(), version:5,
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
  const rewardRatio = config.rewardRatio ?? account.challengeReward;
  const startingBalance=Number(config.startingBalance);
  const hasCapturedBalance=Number.isFinite(startingBalance) && startingBalance>0;
  const challengeStart=hasCapturedBalance ? startingBalance : account.balance ?? account.challengeStartingBalance;
  const plan=buildChallengePlan(challengeStart, config.mode, totalLevels, rewardRatio, config);
  const failureFloor=challengeFailureFloor(challengeStart,config.mode,config);
  const loggedAt=t=>Date.parse(t.createdAt || `${t.date}T${t.time || '00:00'}`);
  const rows=(account.trades || []).filter(t=>{
    if (excluded.has(t.id) || (t.accountId && t.accountId !== account.id)) return false;
    return isClosedTrade(t) && (included.has(t.id) || loggedAt(t) >= Date.parse(config.startedAt)) && t.grossPnl != null && Number.isFinite(Number(t.grossPnl));
  }).sort((a,b)=>loggedAt(a)-loggedAt(b) || String(a.id).localeCompare(String(b.id)));
  state.settingsLocked = linkedChallengeTrades(baseline,account).length > 0;
  const startTime = Date.parse(config.startedAt);
  const cashRows = (account.financeMovements || []).map(item=>({...item,eventAt:Date.parse(item.createdAt || `${item.date}T23:59:59`)}));
  let live = Math.round((hasCapturedBalance ? startingBalance : Number(account.balance ?? account.challengeStartingBalance) + (account.trades || []).filter(t=>isClosedTrade(t)&&!rows.some(row=>row.id===t.id)).reduce((sum,t)=>sum+Number(t.pnl||0),0) + cashRows.filter(item=>item.eventAt<startTime).reduce((sum,item)=>sum+cashImpact(item),0))*100);
  state.failed = live < Math.round(failureFloor*100);
  const markFundingJump = (from, to, reason) => {
    for (let level=from; level<to; level++) {
      if (state.statuses[level] === 'Pass') continue;
      state.statuses[level]='Jumped';
      state.fundingJumps[level]=reason;
    }
  };
  const openingFunding = live / 100;
  const openingLevel = fundedChallengeLevel(plan,openingFunding);
  if (openingLevel >= state.activeLevel && state.activeLevel<=totalLevels) {
    markFundingJump(1,openingLevel,'Jumped due to starting balance');
    state.activeLevel=openingLevel;
    state.statuses[openingLevel]='In progress';
  }
  const events = [...rows.map(trade=>({kind:'trade',eventAt:loggedAt(trade),trade})),...cashRows.filter(item=>item.eventAt>=startTime).map(item=>({kind:'cash',eventAt:item.eventAt,item}))].sort((a,b)=>a.eventAt-b.eventAt || (a.kind==='trade'?-1:1));
  let cents=0;
  for (const event of events) {
    if (event.kind === 'cash') {
      const impact = cashImpact(event.item);
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
          state.stepBacks += Math.max(0, Math.min(previous, totalLevels) - fundedLevel);
          cents = 0;
          state.lossStreak = 0;
        }
      }
      if (event.item.type==='deposit' && cashImpact(event.item)>0 && live>=Math.round(failureFloor*100) && state.activeLevel<=totalLevels) {
        const fundedLevel = fundedChallengeLevel(plan,live/100);
        if (state.failed || fundedLevel!==state.activeLevel) {
          Object.keys(state.statuses).forEach(key=>{if(state.statuses[key]==='In progress')state.statuses[key]='';});
          markFundingJump(state.activeLevel,fundedLevel,'Jumped due to deposit-funded balance');
          state.activeLevel=fundedLevel; state.statuses[fundedLevel]='In progress'; delete state.fundingJumps[fundedLevel]; cents=0; state.lossStreak=0;
        }
        state.failed=false;
      } else if (live<Math.round(failureFloor*100)) state.failed=true;
      continue;
    }
    const trade=event.trade;
    live += Math.round(Number(trade.pnl || 0)*100);
    if (state.activeLevel > totalLevels) continue;
    state.counted++;
    if (state.failed || live<Math.round(failureFloor*100)) { state.failed=true; continue; }
    const row=plan[state.activeLevel-1];
    const amount=Number(trade.grossPnl);
    const gross=Math.round(amount*100);
    cents+=gross;
    if (amount < 0) state.lossStreak++; else if (amount > 0) state.lossStreak=0;
    const pass=cents >= Math.round(row.profit*100);
    const back=isAdaptiveBalanceMode(config.mode) ? amount < 0 && state.activeLevel > 1 : config.mode === 'streak' && canUseLossStreak(rewardRatio ?? 3.1) ? state.lossStreak >= 2 : cents <= -Math.round(row.risk*100);
    if (pass || back) {
      const previous=state.activeLevel;
      state.statuses[previous]=pass ? 'Pass' : 'Step back';
      delete state.fundingJumps[previous];
      state.activeLevel=pass ? Math.min(totalLevels + 1,previous+1) : Math.max(1,previous-1);
      if (back && !pass && state.activeLevel < previous) state.stepBacks++;
      if (state.activeLevel <= totalLevels) {state.statuses[state.activeLevel]='In progress';delete state.fundingJumps[state.activeLevel];}
      cents=0; state.lossStreak=0;
    }
  }
  state.levelPnl=cents/100;
  state.liveBalance=liveChallengeBalance(account);
  // The checkpoint decides which activity belongs to this challenge. Funding
  // events above already handle upward jumps in chronological order. At this
  // point a reduced live balance may only move the trader down the ladder.
  // A loss must never be able to undo a just-recorded step-back by promoting
  // the active level again merely because its remaining balance still funds a
  // higher rung.
  const balanceReduced = events.some(event => event.kind === 'cash'
    ? cashImpact(event.item) < 0
    : Number(event.trade.pnl || 0) < 0);
  const fundedLevel = fundedChallengeLevel(plan,state.liveBalance);
  const previous = state.activeLevel;
  // A funding jump must remain affordable. This also catches a balance that
  // was edited outside the event ledger: the displayed rung cannot stay above
  // the available capital simply because an earlier deposit jumped levels.
  const hasFundingJump = Object.entries(state.statuses || {}).some(([level,status]) => status === 'Jumped' && Number(level) < previous);
  if ((balanceReduced || hasFundingJump) && fundedLevel < previous) {
    for (const key of Object.keys(state.statuses)) {
      if (Number(key) >= fundedLevel) delete state.statuses[key];
    }
    for (const key of Object.keys(state.fundingJumps)) {
      if (Number(key) >= fundedLevel) delete state.fundingJumps[key];
    }
    if (previous <= totalLevels) {
      state.statuses[previous]='Step back';
      const reason='Stepped back because live balance fell below this level.';
      if (!String(state.notes[previous] || '').includes(reason)) state.notes[previous]=[state.notes[previous],reason].filter(Boolean).join('\n');
    }
    state.activeLevel=fundedLevel;
    state.statuses[fundedLevel]='In progress';
    state.stepBacks += Math.max(0,Math.min(previous,totalLevels)-fundedLevel);
    cents=0;
    state.levelPnl=0;
    state.lossStreak=0;
  }
  if (state.liveBalance<failureFloor) state.failed=true;
  return state;
}

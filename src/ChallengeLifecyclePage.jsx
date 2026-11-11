import React, {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {usePageState} from './NavigationSession.jsx';
import {initializeChallengeExpansion,normalizeChallengeExpansion,setChallengeExpanded} from './challengeExpansionState.js';
import {MOBILE_MEDIA} from './mobileNavigation.js';
import {MobileChallengePlan} from './MobileChallengePlan.jsx';
import MobileChallengesV6 from './MobileChallengesV6.jsx';
import DesktopChallengeCard, {ChallengeHero} from './DesktopChallenge.jsx';

const CHALLENGE_V2 = true;
import {Trophy,Trash2,ArrowDown,Target,Settings,X,Save,ChevronDown} from 'lucide-react';
import {ThemeSelect} from './JournalControls';
import {targetAmount,changeSetupTarget} from './challengeSetupTargets';
import {activeBalances,isMultiBalanceWorkspace} from './balanceModel';
import {buildChallengePlan, challengeFailureFloor, isAdaptiveBalanceMode} from './challengeModel';
import {scopeChallengeAccount,challengeLifecycle,linkedChallengeTrades,challengeStartingBalance,closedChallengeTrade,challengeTradingDays} from './challengeLifecycle';
import {accountLossGuardrails} from './accountRisk';
import useBalanceChallenge from './useBalanceChallenge';
import JournalSignalHeader from './JournalSignalHeader';
import ChallengeCelebration, {useCompletionCelebration, TraderNameContext} from './ChallengeCelebration';
import ChallengeCompletePopup from './ChallengeCompletePopup.jsx';

const symbols={USD:'$',EUR:'€',GBP:'£',GHS:'₵'};
const money=(value,currency='USD')=>`${symbols[currency] || currency+' '}${Number(value || 0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const statusClass=status=>status==='Pass'?'pass':status==='Step back'?'back':status==='In progress'?'progress':status==='Jumped'?'jumped':'';
const challengeRules={
  risk:{
    title:'Mode 1 · Risk Limit rules',
    items:[
      ['Progress','Closed challenge trades add toward this level’s profit target.'],
      ['Step-back','When the level’s combined trade result reaches its planned risk amount, the challenge steps back one level.'],
      ['Balance floor','The challenge is paused if live trading capital falls below the original Level 1 balance.'],
      ['Funding','Deposits can fund forward progress. Withdrawals and transfers can move the challenge back.'],
      ['Planned and live balance','The final planned balance is the clean-path target. Re-passing levels after a step-back adds to realised equity again, so live balance can finish above the plan.'],
      ['Lock process','Once a trade is linked to this challenge, its mode, plan length, reward and setup rules are locked.'],
    ],
  },
  streak:{
    title:'Mode 2 · Two-Loss Streak rules',
    items:[
      ['Progress','Closed challenge trades add toward this level’s profit target.'],
      ['Two-loss rule','Two consecutive losing trades trigger a step-back. A winning trade resets the loss streak; breakeven does not change it.'],
      ['Balance floor','The challenge is paused if live trading capital falls below the original Level 1 balance.'],
      ['Funding','Deposits can fund forward progress. Withdrawals and transfers can move the challenge back.'],
      ['Planned and live balance','The final planned balance is the clean-path target. Re-passing levels after a step-back adds to realised equity again, so live balance can finish above the plan.'],
      ['Lock process','Once a trade is linked to this challenge, its mode, plan length, reward and setup rules are locked.'],
    ],
  },
  adaptive:{
    title:'Mode 3 · Adaptive Balance rules',
    items:[
      ['Progress','Each level risks the selected percentage of its starting balance and targets the selected reward multiple.'],
      ['Step-back','A losing trade from Level 2 onward steps the challenge back one level. A Level 1 loss stays at Level 1.'],
      ['Balance floor','The challenge is paused when live trading capital falls below its starting balance by the selected maximum drawdown.'],
      ['Funding','Deposits can fund forward progress. Withdrawals and transfers can move the challenge back.'],
      ['Planned and live balance','The final planned balance is the clean-path target. Re-passing levels after a step-back adds to realised equity again, so live balance can finish above the plan.'],
      ['Lock process','The challenge always starts at Level 1. Once a trade is linked, its adaptive settings and plan rules are locked.'],
    ],
  },
};
function ChallengeRules({id,mode}) {
  const rules=challengeRules[mode] || challengeRules.risk;
  return <section id={id} className="tj-challenge-rules" aria-label={rules.title}>
    <div className="tj-challenge-rules-heading"><small>HOW THIS CHALLENGE WORKS</small><h4>{rules.title}</h4></div>
    <ol>{rules.items.map(([label,description],index)=><li key={label}><span>{index+1}</span><p><strong>{label}</strong>{description}</p></li>)}</ol>
  </section>;
}
function ChallengeRulesPopover({mode,onClose}) {
  const rules=challengeRules[mode] || challengeRules.risk;
  return <section className="tj-cs-rules-popover" role="dialog" aria-label={rules.title}>
    <header><strong>{rules.title}</strong><button type="button" aria-label="Close challenge rules" onClick={onClose}><X size={14}/></button></header>
    <ol>{rules.items.map(([label,description])=><li key={label}><strong>{label}</strong><span>{description}</span></li>)}</ol>
  </section>;
}
// Phone layout: every challenge card shares one swipe row, and the plan below follows the selected card.
const PhoneChallengeRail=createContext(null);
export default function ChallengeLifecyclePage({account,challenge,userId,loginQuote,onDelete,onSaveSetup,onComplete,challengeProgress,progressReady=false}) {
  const multi=isMultiBalanceWorkspace(account);
  const challengeBalances=multi?activeBalances(account).filter(balance=>balance.challengeEnabled):[];
  const firstBalance=challengeBalances[0] || null;
  const firstChallenge=useBalanceChallenge(firstBalance?{...firstBalance,trades:account.trades,balances:account.balances,financeMovements:account.financeMovements}:null,userId,firstBalance ? challengeProgress?.balance?.[firstBalance.id] : null,progressReady);
  const cardIds=multi?challengeBalances.map(balance=>balance.id):[account.id];
  const cardKey=cardIds.join('|');
  const [expansion,setExpansion]=usePageState('challenge','tj-challenge-expandedCards',()=>({initialized:false,ids:[]}));
  const [activity,setActivity]=useState({});
  const reportActivity=useCallback((id,next)=>setActivity(current=>current[id]?.ready===next.ready&&current[id]?.active===next.active&&current[id]?.planned===next.planned&&current[id]?.level===next.level&&current[id]?.total===next.total&&current[id]?.name===next.name?current:{...current,[id]:next}),[]);
  useEffect(()=>{setExpansion(current=>{
    const next=normalizeChallengeExpansion(current,cardIds);
    return next.initialized===current?.initialized&&next.ids.length===(current?.ids||[]).length&&next.ids.every((id,index)=>id===current.ids[index])?current:next;
  });},[cardKey,setExpansion]);
  const challengeCards=cardIds.map(id=>({id,ready:activity[id]?.ready===true,active:activity[id]?.active===true}));
  useEffect(()=>{
    const next=initializeChallengeExpansion(expansion,challengeCards);
    if(next.initialized!==expansion?.initialized||next.ids.length!==(expansion?.ids||[]).length||next.ids.some((id,index)=>id!==expansion.ids[index]))setExpansion(next);
  },[challengeCards,expansion,cardKey,setExpansion]);
  const expanded=id=>normalizeChallengeExpansion(expansion,cardIds).ids.includes(id);
  const setExpanded=(id,next)=>setExpansion(current=>setChallengeExpanded(current,cardIds,id,next));
  const [phonePage,setPhonePage]=useState(()=>window.matchMedia(MOBILE_MEDIA).matches);
  useEffect(()=>{const media=window.matchMedia(MOBILE_MEDIA),change=()=>setPhonePage(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
  const [railEl,setRailEl]=useState(null);
  const [lowerEl,setLowerEl]=useState(null);
  const [swipedId,setSwipedId]=useState(null);
  const userMoved=useRef(false),swipeTimer=useRef(0);
  const railIds=cardIds.filter(id=>activity[id]?.planned!==false);
  const selectedId=railIds.includes(swipedId)?swipedId:normalizeChallengeExpansion(expansion,cardIds).ids.find(id=>railIds.includes(id))||railIds[0];
  const onRailScroll=()=>{clearTimeout(swipeTimer.current);swipeTimer.current=setTimeout(()=>{
    if(!railEl)return;
    const middle=railEl.getBoundingClientRect().left+railEl.clientWidth/2;
    let closest=null,distance=Infinity;
    [...railEl.children].forEach(card=>{const box=card.getBoundingClientRect(),gap=Math.abs(box.left+box.width/2-middle);if(gap<distance){distance=gap;closest=card.dataset.cardId;}});
    if(closest&&closest!==selectedId){userMoved.current=true;setSwipedId(closest);}
  },90);};
  useEffect(()=>()=>clearTimeout(swipeTimer.current),[]);
  const [deskSel,setDeskSel]=useState(null);
  const deskV2=CHALLENGE_V2&&!phonePage;
  const deskId=railIds.includes(deskSel)?deskSel:railIds[0];
  const deskCards=railIds.map(id=>({id,name:activity[id]?.name || '',level:activity[id]?.level || 0,total:activity[id]?.total || 0}));
  const railValue=useMemo(()=>phonePage?{railEl,lowerEl,selectedId,userMoved,orderOf:id=>Math.max(0,cardIds.indexOf(id))}:null,[phonePage,railEl,lowerEl,selectedId,cardKey]);
  if(deskV2) return <section className="tj-challenge tj-challenge-split-page"><JournalSignalHeader page="challenge" challenge={multi?{...firstChallenge.state,loading:firstChallenge.loading,error:firstChallenge.error}: {...challenge.state,loading:challenge.loading,error:challenge.error}} loginQuote={loginQuote}/><div className="ch2-page"><ChallengeHero cards={deskCards} selectedId={deskId} onSelect={setDeskSel}/>{multi?challengeBalances.map(balance=><div key={balance.id} hidden={balance.id!==deskId}><BalanceCard workspace={account} balance={balance} userId={userId} startupProgress={challengeProgress?.balance?.[balance.id]} progressReady={progressReady} expanded={true} setExpanded={()=>{}} onActivityChange={reportActivity} onDelete={onDelete} onSaveSetup={onSaveSetup} onComplete={onComplete}/></div>):<ChallengeCard account={account} challenge={challenge} expanded={true} setExpanded={()=>{}} onActivityChange={reportActivity} onDelete={()=>onDelete(null,challenge.state)} onSaveSetup={patch=>onSaveSetup(null,challenge.state,patch)} onComplete={facts=>onComplete?.(null,challenge,facts,account)}/>}</div></section>;
  return <section className="tj-challenge tj-challenge-split-page"><JournalSignalHeader page="challenge" challenge={multi?{...firstChallenge.state,loading:firstChallenge.loading,error:firstChallenge.error}: {...challenge.state,loading:challenge.loading,error:challenge.error}} loginQuote={loginQuote}/><PhoneChallengeRail.Provider value={railValue}><div className="tj-balance-challenge-stack">{phonePage&&<><div className="tj-mc6-rail" ref={setRailEl} data-scroll-row="true" onScroll={onRailScroll}/>{railIds.length>1&&<div className="tj-mc6-rail-dots" aria-hidden="true">{railIds.map(id=><i key={id} className={id===selectedId?'is-on':''}/>)}</div>}<div ref={setLowerEl}/></>}{multi?challengeBalances.map(balance=><BalanceCard key={balance.id} workspace={account} balance={balance} userId={userId} startupProgress={challengeProgress?.balance?.[balance.id]} progressReady={progressReady} expanded={expanded(balance.id)} setExpanded={next=>setExpanded(balance.id,next)} onActivityChange={reportActivity} onDelete={onDelete} onSaveSetup={onSaveSetup} onComplete={onComplete}/>):<ChallengeCard account={account} challenge={challenge} expanded={expanded(account.id)} setExpanded={next=>setExpanded(account.id,next)} onActivityChange={reportActivity} onDelete={()=>onDelete(null,challenge.state)} onSaveSetup={patch=>onSaveSetup(null,challenge.state,patch)} onComplete={facts=>onComplete?.(null,challenge,facts,account)}/>}</div></PhoneChallengeRail.Provider></section>;
}
function BalanceCard({workspace,balance,userId,startupProgress,progressReady,expanded,setExpanded,onActivityChange,onDelete,onSaveSetup,onComplete}) {
  const challenge=useBalanceChallenge({...balance,trades:workspace.trades,balances:workspace.balances,financeMovements:workspace.financeMovements},userId,startupProgress,progressReady);
  return <ChallengeCard account={scopeChallengeAccount(workspace,balance)} challenge={challenge} expanded={expanded} setExpanded={setExpanded} onActivityChange={onActivityChange} onDelete={()=>onDelete(balance.id,challenge.state)} onSaveSetup={patch=>onSaveSetup(balance.id,challenge.state,patch)} onComplete={facts=>onComplete?.(balance.id,challenge,facts,balance)}/>;
}
function ChallengeCard({account,challenge,expanded,setExpanded,onActivityChange,onDelete,onSaveSetup,onComplete}) {
  const rail=useContext(PhoneChallengeRail);
  const traderName=useContext(TraderNameContext);
  const [phone,setPhone]=useState(()=>window.matchMedia(MOBILE_MEDIA).matches);
  useEffect(()=>{const media=window.matchMedia(MOBILE_MEDIA),change=()=>setPhone(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
  const {state,loading,saving,error}=challenge;
  const life=challengeLifecycle(state,account);
  const failed=state.failed || life.failed;
  const guardrails=accountLossGuardrails(account);
  const locked=failed || guardrails.tradeEntryLocked;
  const mode=state.automation?.mode || account.challengeMode || 'risk';
  const reward=state.automation?.rewardRatio ?? account.challengeReward;
  const challengeBalance=challengeStartingBalance(state,account);
  const plan=buildChallengePlan(challengeBalance,mode,state.automation?.levelCount || account.challengeLevelCount,reward,state.automation);
  const adaptive=isAdaptiveBalanceMode(mode);
  const failureFloor=challengeFailureFloor(challengeBalance,mode,state.automation);
  const [details,setDetails]=usePageState('challenge',`tj-challenge-${account.id}:details`,false);
  const [planRange,setPlanRange]=usePageState('challenge',`tj-challenge-${account.id}:planRange`,()=>window.matchMedia(MOBILE_MEDIA).matches?0:null);
  const [setup,setSetup]=useState(null);
  const [savingSetup,setSavingSetup]=useState(false);
  const [deleting,setDeleting]=useState(false);
  const complete=!failed && (state.activeLevel===plan.length+1 || Object.values(state.statuses || {}).filter(status=>status==='Pass'||status==='Jumped').length===plan.length);
  // The certificate archive is the durable record of a completed challenge.
  // The acknowledgement timestamp is only a convenience marker: it may be
  // absent if the archive write succeeded but its follow-up state write did
  // not.  Never replay a celebration for an already archived run.
  const certificateId=`AF-${String(account.id || account.name || '').replace(/[^a-z0-9]/gi,'').slice(0,6).toUpperCase()}-${plan.length}`;
  const runStartedAt=Date.parse(state.automation?.startedAt || '');
  const completionArchived=(account.challengeCertificates || []).some(certificate=>{
    if (certificate?.certificateId !== certificateId) return false;
    const completedAt=Date.parse(certificate.completedAt || certificate.archivedAt || '');
    return !Number.isFinite(runStartedAt) || !Number.isFinite(completedAt) || completedAt >= runStartedAt;
  });
  const [celebrating,setCelebrating]=useCompletionCelebration(!loading && complete && plan.length>0 && !completionArchived && !state.automation?.completionAcknowledgedAt);
  const activeRow=useRef(null);
  useEffect(()=>{onActivityChange?.(account.id,{ready:!loading,active:!loading&&plan.length>0&&!failed&&!complete,planned:plan.length>0,level:loading||!plan.length?0:Math.min(Math.max(state.activeLevel || 1,1),plan.length),total:plan.length,name:account.name});},[account.id,account.name,complete,failed,loading,onActivityChange,plan.length,state.activeLevel]);
  if(!plan.length)return null;
  // Do not render a made-up Level 1 while the saved challenge state is still
  // arriving. A stable loading card is preferable to a visible level jump.
  if(loading)return <article className="tj-panel tj-balance-challenge-panel tj-challenge-reference"><header><div><h3>{account.name}</h3><p>{mode==='streak'?'Mode 2 — Two-Loss Streak':'Mode 1 — Risk Limit'} · {plan.length} levels</p></div></header><p role="status" className="tj-challenge-loading-state">Loading saved challenge progress…</p></article>;
  const passed=Object.values(state.statuses || {}).filter(status=>status==='Pass'||status==='Jumped').length;
  const funded=Object.values(state.statuses || {}).filter(status=>status==='Jumped').length;
  const current=plan[Math.min(Math.max(state.activeLevel || 1,1),plan.length)-1];
  const fmt=value=>money(value,account.baseCurrency);
  const nextLevel=plan[current.level] || null;
  const amountToNext=nextLevel ? Math.max(0,nextLevel.start-life.liveBalance) : 0;
  const linked=linkedChallengeTrades(state,account).length;
  const rangeStart=planRange ?? Math.floor((current.level-1)/10)*10;
  const visiblePlan=rangeStart==='all'?plan:plan.slice(rangeStart,rangeStart+10);
  const modeName=adaptive?'Mode 3 — Adaptive Balance':mode==='streak'?'Mode 2 — Two-Loss Streak':'Mode 1 — Risk Limit';
  const rewardLabel=adaptive?`${state.automation?.adaptiveRiskPct ?? 1}% risk · ${reward}R`:reward?`1:${reward}`:'';
  // Challenge growth is earned trading performance, not a change in funded
  // capital. Deposits and withdrawals can advance the plan, but never inflate
  // the achievement percentage shown in the completion card or certificate.
  const challengeTradingPnl=linkedChallengeTrades(state,account)
    .filter(closedChallengeTrade)
    .reduce((sum,trade)=>sum+Number(trade.pnl || 0),0);
  // Facts for the desktop celebration and certificate, all from this challenge's own record.
  const celebrationFacts=()=>{
    const trades=linkedChallengeTrades(state,account);
    const lastClose=trades.map(trade=>Date.parse(trade.closeDate||trade.date)).filter(Number.isFinite).sort((a,b)=>b-a)[0];
    const completedAt=lastClose || Date.now();
    return {traderName, accountName:account.name, totalLevels:plan.length, modeName, rewardLabel,
      // Preserve the actual equity that completed this run. The plan target is
      // still retained for reference, but an over-target final trade must be
      // recognised as the achievement on both the trophy and certificate.
      completionBalance:life.liveBalance, finalTarget:plan.at(-1)?.end ?? life.liveBalance, trades:trades.length,
      daysTaken:challengeTradingDays(trades),
      stepBacks:state.stepBacks ?? Object.values(state.statuses || {}).filter(status=>status==='Step back').length,
      growth:challengeBalance>0?challengeTradingPnl/challengeBalance*100:null, completedAt,
      certificateId};
  };
  const continueWithAdaptive=async()=>{
    const started=await onSaveSetup({
      name:account.name || '', startingBalance:challengeBalance, mode:'adaptive',
      levelCount:plan.length, reward:state.automation?.rewardRatio ?? 2,
      adaptiveRiskPct:state.automation?.adaptiveRiskPct ?? 1,
      adaptiveDrawdownPct:state.automation?.adaptiveDrawdownPct ?? 10,
      restartCompleted:true,
    });
    if (started) setCelebrating(false);
  };
  const jumpToActive=()=>{setExpanded(true);setPlanRange(Math.floor((current.level-1)/10)*10);setTimeout(()=>activeRow.current?.scrollIntoView({behavior:'smooth',block:'center'}),0);};
  const openSetup=()=>setSetup({name:account.name || '',startingBalance:challengeBalance || account.balance || '',mode,levelCount:plan.length,reward:reward ?? (mode==='streak'?3.1:3),adaptiveRiskPct:state.automation?.adaptiveRiskPct ?? 1,adaptiveDrawdownPct:state.automation?.adaptiveDrawdownPct ?? 10,monthlyGoalPct:account.monthlyGoalPct || 0,yearlyGoalPct:account.yearlyGoalPct || 0,dailyLossLimitPct:account.dailyLossLimitPct || 0,monthlyLossLimitPct:account.monthlyLossLimitPct || 0,...(!isMultiBalanceWorkspace(account)&&account.monthlyGoalSource==='amount'?{monthlyGoalPctAmount:account.monthlyGoalAmount || 0}:{}),...(!isMultiBalanceWorkspace(account)&&account.yearlyGoalSource==='amount'?{yearlyGoalPctAmount:account.yearlyGoalAmount || 0}:{})});
  const saveSetup=async()=>{setSavingSetup(true);try{if(await onSaveSetup({...setup,startingBalance:Number(setup.startingBalance),levelCount:Number(setup.levelCount)}))setSetup(null);}finally{setSavingSetup(false);}};
  // The split component deliberately owns the visual composition only.  The
  // plan, lifecycle, status and persistence handlers above remain the single
  // source of truth for challenge calculations.
  const viewProps = {
    account, plan, current, state, life, failed, complete, mode, modeName,
    rewardLabel, reward, adaptive, failureFloor, linked, fmt, expanded,
    setExpanded, challenge, openSetup, setup, setSetup, saveSetup,
    savingSetup, deleting, setDeleting, onDelete, onSaveSetup, locked,
    settingsLocked:state.settingsLocked, completionArchived, onContinueAdaptive:continueWithAdaptive,
  };
  return phone ? <><MobileChallengesV6 {...viewProps} rules={challengeRules[mode] || challengeRules.risk} rail={rail} order={rail?.orderOf(account.id) ?? 0} onOpenSettings={openSetup} saving={saving} error={error} onRetry={challenge.retry}/>{setup&&<ChallengeSplitSettingsModal setup={setup} setSetup={setSetup} account={account} locked={state.settingsLocked} saving={savingSetup} deleting={deleting} onCancel={()=>setSetup(null)} onSave={saveSetup} onDelete={async()=>{setDeleting(true);try{if(await onDelete())setSetup(null);}finally{setDeleting(false);}}}/>}</> : CHALLENGE_V2 ? <><DesktopChallengeCard {...viewProps} rules={challengeRules[mode] || challengeRules.risk} saving={saving} error={error}/>{celebrating&&<ChallengeCompletePopup facts={celebrationFacts()} money={fmt} onViewJourney={()=>{setCelebrating(false);jumpToActive();}} onComplete={onComplete} onClose={()=>setCelebrating(false)}/>}</> : <ChallengeSplitVisual {...viewProps}/>;
  /* Legacy layout retained below as a reference during the migration. */
  return <article className={`tj-panel tj-balance-challenge-panel tj-challenge-reference ${expanded?'':'tj-balance-challenge-collapsed'}`}>
    <header role="button" tabIndex={0} aria-expanded={expanded} aria-label={`${expanded?'Collapse':'Expand'} ${account.name} challenge`} onClick={()=>setExpanded(value=>!value)} onKeyDown={event=>{if(event.target===event.currentTarget && (event.key==='Enter'||event.key===' ')){event.preventDefault();setExpanded(value=>!value);}}}><div className="tj-challenge-card-title"><h3>{account.name}</h3><span>{modeName}</span>{rewardLabel&&<span>{rewardLabel}</span>}<span>{plan.length} levels</span></div><div className="tj-challenge-header-actions"><span className={`tj-challenge-state-badge ${failed?'failed':complete?'passed':'active'}`} aria-label={`${account.name} challenge ${failed?'Failed':complete?'Passed':'Active'}`}>{failed?'Failed':complete?'Passed':'Active'}</span><button type="button" className="tj-icon-btn" aria-label={`Settings for ${account.name}`} title="Challenge settings" onClick={event=>{event.stopPropagation();openSetup();}} disabled={loading}><Settings size={12}/> Settings</button></div></header>
    {error&&<div role="alert">{error} <button onClick={challenge.retry}>Retry</button></div>}
    {(failed||guardrails.tradeEntryLocked)&&<div className="tj-challenge-lock-message" role={failed?'alert':'status'}>{failed?<><strong>Challenge failed.</strong> Your live balance of {fmt(life.liveBalance)} is below the {fmt(failureFloor)} minimum required to continue. Deposit at least {fmt(Math.max(0,failureFloor-life.liveBalance))} in Finance to reactivate this challenge, or delete the failed run and start a new one.</>:'This account is paused until its loss-limit reset. Deposits do not clear this guardrail.'}</div>}
    <div className="tj-challenge-summary-layout"><section className="tj-challenge-progress-summary"><div className="tj-challenge-progress-heading"><div><small>CHALLENGE PROGRESS</small><h2>{complete?'Complete':`Level ${current.level}`} <span>of {plan.length}</span></h2></div><div><small>THIS LEVEL</small><strong>{fmt(current.start)} → {fmt(current.end)}</strong></div></div><LevelRail plan={plan} statuses={state.statuses} currentLevel={current.level} onSelect={level=>{setExpanded(true);setPlanRange(Math.floor((level-1)/10)*10);}}/><button type="button" className="tj-phone-jump-active" onClick={jumpToActive}><ArrowDown size={14}/>Jump to active level</button><p>{passed} of {plan.length} levels reached{funded?` · ${funded} deposit-funded`:''}</p></section><section className="tj-challenge-balance-summary"><div className="tj-challenge-balance-pair"><div className="tj-challenge-balance-value"><small>AVAILABLE TRADING CAPITAL</small><strong className={life.liveBalance < failureFloor ? 'tj-challenge-negative' : 'tj-challenge-live-balance'}>{fmt(life.liveBalance)}</strong></div><div className="tj-challenge-balance-value"><small>FULL CHALLENGE TARGET</small><strong className="tj-challenge-positive">{fmt(plan.at(-1).end)}</strong></div></div><div><span>Challenge position</span><b>{complete?'Complete':`Level ${current.level} of ${plan.length}`}</b></div><div><span>{nextLevel?'Next level':'Challenge target'}</span><b>{nextLevel?`${fmt(nextLevel.start)} · ${fmt(amountToNext)} away`:fmt(plan.at(-1).end)}</b></div></section></div>
    <div className="tj-challenge-summary-metrics">{[['RISK AT LEVEL START',fmt(current.risk),'tj-challenge-negative'],['PROFIT TARGET',complete?'—':fmt(current.profit),'tj-challenge-positive'],[adaptive?'MAX DRAWDOWN':'LOSS STREAK',adaptive?`${state.automation?.adaptiveDrawdownPct ?? 10}%`:state.lossStreak||0,''],['TRADES TAKEN',linked,''],['STEP-BACKS',state.stepBacks||0,'']].map(([label,value,tone])=><div key={label}><small>{label}</small><b className={tone}>{value}</b></div>)}</div>
    {!expanded&&<button type="button" className="tj-challenge-open-plan" onClick={()=>setExpanded(true)}><span>Compounding plan</span><small>{plan.length} levels · Milestone at level {Math.min(10,plan.length)} · {fmt(plan[Math.min(9,plan.length-1)].end)}</small><ArrowDown size={16}/></button>}
    {(guardrails.dailyLossLimitPct>0 || guardrails.monthlyLossLimitPct>0)&&<section className="tj-panel tj-challenge-account-guardrails"><strong>{account.name} guardrails</strong><div>{guardrails.dailyLossLimitPct>0&&<span><small>DAILY LOSS LIMIT · {guardrails.dailyLossLimitPct}%</small><b>{fmt(Math.max(0,-guardrails.dailyPnl))} / {fmt(guardrails.dailyLossCap)}</b><em>{guardrails.dailyLossHit?'Locked until next day':'Open'}</em></span>}{guardrails.monthlyLossLimitPct>0&&<span><small>MONTHLY LOSS LIMIT · {guardrails.monthlyLossLimitPct}%</small><b>{fmt(Math.max(0,-guardrails.monthlyPnl))} / {fmt(guardrails.monthlyLossCap)}</b><em>{guardrails.monthlyLossHit?'Locked until next month':'Open'}</em></span>}</div></section>}
    <section className="tj-challenge-plan-reference">
      <div className="tj-challenge-table-head"><div><h3>Compounding plan</h3><p>One step at a time, build the life you once only imagined.</p></div></div>
      <div className="tj-challenge-plan-tools"><label><input type="checkbox" checked={details} onChange={event=>setDetails(event.target.checked)}/> Sizing details</label><button type="button" onClick={jumpToActive}>Go to current level <ArrowDown size={10}/></button></div>
      <LevelRail plan={plan} statuses={state.statuses} currentLevel={current.level} onSelect={level=>setPlanRange(Math.floor((level-1)/10)*10)}/>
      <div className="tj-challenge-plan-stats">{[['LEVELS',plan.length],['PASSED',passed],['CURRENTLY ACTIVE',`Level ${current.level}`],['PLANNED FINAL BALANCE',fmt(plan.at(-1).end)]].map(([label,value])=><div key={label}><small>{label}</small><b className={label==='PLANNED FINAL BALANCE'?'tj-challenge-positive':label==='CURRENTLY ACTIVE'?'tj-amber':''}>{value}</b></div>)}</div>
      <div className="tj-challenge-range-tools"><nav aria-label={account.name+' plan levels'}>{Array.from({length:Math.ceil(plan.length/10)},(_,index)=>index*10).map(first=><button type="button" key={first} aria-pressed={rangeStart===first} onClick={()=>setPlanRange(first)}><span className="tj-challenge-desktop-range">Levels </span>{first+1}–{Math.min(first+10,plan.length)}</button>)}<button type="button" aria-pressed={rangeStart==='all'} onClick={()=>setPlanRange('all')}>All {plan.length}</button></nav>{rangeStart!=='all'&&<span>Milestone at level {visiblePlan.at(-1).level} · {fmt(visiblePlan.at(-1).end)}</span>}</div>
      {loading?<p role="status">Loading challenge…</p>:phone?<MobileChallengePlan rows={visiblePlan} current={current} state={state} challenge={challenge} fmt={fmt} details={details} locked={locked} activeRow={activeRow} loading={loading} saving={saving} accountName={account.name}/>:<div className="tj-challenge-scroll" role="region" aria-label={account.name+' compounding plan'} tabIndex={0}><table><thead><tr><th>Level</th><th>Balance · Growth</th><th>Risk</th><th>Profit</th>{details&&<th>Sizing</th>}<th>Status</th><th>Notes</th></tr></thead><tbody>{visiblePlan.map(row=><tr data-milestone={[10,20,30].includes(row.level)?row.level:undefined} key={row.level} ref={row.level===current.level?activeRow:null} className={row.level===current.level?'tj-challenge-active':''}><th scope="row"><div className="tj-challenge-level-label">{row.level}{row.level===current.level?<span className="tj-challenge-current-badge">CURRENT</span>:[10,20,30].includes(row.level)?<span className="tj-challenge-milestone-badge">MILESTONE</span>:null}</div></th><td><div className="tj-challenge-growth">{fmt(row.start)} → <b>{fmt(row.end)}</b><span>×{(row.start?row.end/row.start:0).toFixed(2)}</span></div></td><td className="tj-challenge-negative">{fmt(row.risk)}</td><td className="tj-challenge-positive">{fmt(row.profit)}</td>{details&&<td><div className="tj-challenge-sizing-chips"><span>{row.riskPct.toFixed(2)}% risk</span><span>{row.profitPct.toFixed(2)}% profit</span><span>SL {row.sl.toFixed(2)}</span><span>TP {row.tp}</span><span>{row.lots.toFixed(2)} lots</span></div></td>}<td><div className={'tj-challenge-status-picker '+statusClass(state.statuses?.[row.level])}><ThemeSelect disabled={loading||saving||locked||state.settingsLocked} label={account.name+' level '+row.level+' status'} value={state.statuses?.[row.level] || ''} onChange={event=>challenge.setStatus(row.level,event.target.value)}><option value="">Not started</option><option>Pass</option><option>In progress</option><option>Step back</option><option value="Jumped" disabled>Jumped</option></ThemeSelect></div></td><td><input className="tj-input" aria-label={account.name+' level '+row.level+' notes'} disabled={saving} placeholder="Add a note…" maxLength={2000} key={row.level+':'+(state.statuses?.[row.level] || '')+':'+(state.fundingJumps?.[row.level] || '')} defaultValue={state.notes?.[row.level] || (state.statuses?.[row.level]==='Jumped' ? state.fundingJumps?.[row.level] || 'Jumped due to balance' : '')} onBlur={event=>{if(event.target.value!==(state.notes?.[row.level] || (state.statuses?.[row.level]==='Jumped' ? state.fundingJumps?.[row.level] || 'Jumped due to balance' : '')))challenge.setNote(row.level,event.target.value);}}/></td></tr>)}</tbody></table></div>}
    </section>
    {setup&&<div className="tj-modal-overlay tj-modal-overlay-centered" onMouseDown={event=>{if(event.target===event.currentTarget&&!savingSetup&&!deleting)setSetup(null);}} role="dialog" aria-modal="true" aria-label={`Challenge settings for ${account.name}`}><section className="tj-panel tj-challenge-setup"><header><div><small>EDIT CHALLENGE SETUP</small><h3>{account.name}</h3></div><span>These settings affect only this challenge account.</span></header><div className="tj-challenge-setup-body"><section className="tj-challenge-setup-section tj-challenge-setup-plan"><h4>Account & plan</h4><p>The starting point and rules for this challenge.</p><div className="tj-challenge-setup-grid">
      <label>Account name<input className="tj-input" value={setup.name} onChange={event=>setSetup({...setup,name:event.target.value})}/></label>
      <label>Challenge starting balance<input className="tj-input" type="number" value={setup.startingBalance} readOnly aria-describedby="challenge-live-balance-hint"/></label>
      <div className="tj-challenge-setup-field"><span>Mode</span><ThemeSelect label="Challenge mode" disabled={state.settingsLocked} value={setup.mode} onChange={event=>setSetup({...setup,mode:event.target.value})}><option value="risk">Mode 1 — Risk Limit</option><option value="streak" disabled={Number(setup.reward)<=2.8}>Mode 2 — Two-Loss Streak</option><option value="adaptive">Mode 3 — Adaptive Balance</option></ThemeSelect></div>
      <div className="tj-challenge-setup-field"><span>Plan length</span><ThemeSelect label="Plan length" disabled={state.settingsLocked} value={setup.levelCount} onChange={event=>setSetup({...setup,levelCount:event.target.value})}>{[10,15,20,30].map(count=><option key={count} value={count}>{count} levels</option>)}</ThemeSelect></div>
      <label>{setup.mode==='adaptive'?'Target (R)':'Risk to reward'}<input className="tj-input" type="number" min="0.01" step="0.01" disabled={state.settingsLocked} value={setup.reward} onChange={event=>setSetup({...setup,reward:event.target.value,mode:setup.mode==='streak'&&Number(event.target.value)<=2.8?'risk':setup.mode})}/></label>
      {setup.mode==='adaptive'&&<><label>Risk per trade (%)<input className="tj-input" type="number" min="0.01" max="100" step="0.01" disabled={state.settingsLocked} value={setup.adaptiveRiskPct} onChange={event=>setSetup({...setup,adaptiveRiskPct:event.target.value})}/></label><label>Maximum drawdown (%)<input className="tj-input" type="number" min="0" max="99.99" step="0.01" disabled={state.settingsLocked} value={setup.adaptiveDrawdownPct} onChange={event=>setSetup({...setup,adaptiveDrawdownPct:event.target.value})}/></label></>}
    </div><p id="challenge-live-balance-hint" className="tj-settings-hint">Captured from this account’s live trading balance when this challenge starts. Change the account balance in Account Settings, not here.</p>{setup.mode==='adaptive'&&<p className="tj-settings-hint">Each level targets {Number(setup.adaptiveRiskPct || 0)*Number(setup.reward || 0)}%. A losing trade steps back one level; at Level 1 you remain there. The challenge fails below {fmt(Number(setup.startingBalance || 0)*(1-Number(setup.adaptiveDrawdownPct || 0)/100))}.</p>}{state.settingsLocked&&<p className="tj-challenge-setup-lock">Starting balance, mode, plan length and reward are locked because this challenge has linked trades. Account name, goals and guardrails remain editable.</p>}</section>
    <section className="tj-challenge-setup-section"><h4>Goals</h4><p>Optional targets for this account. Set 0 to turn off.</p><div className="tj-challenge-setup-grid">
      <LinkedChallengeTarget label="Monthly goal" field="monthlyGoalPct" setup={setup} setSetup={setSetup} currency={account.baseCurrency}/>
      <LinkedChallengeTarget label="Yearly goal" field="yearlyGoalPct" setup={setup} setSetup={setSetup} currency={account.baseCurrency}/>
    </div></section>
    <section className="tj-challenge-setup-section"><h4>Risk Guardrails</h4><p>Loss caps pause trading for this account only. Set 0 to turn off.</p><div className="tj-challenge-setup-grid">
      <LinkedChallengeTarget label="Daily loss limit" field="dailyLossLimitPct" setup={setup} setSetup={setSetup} currency={account.baseCurrency} limit/>
      <LinkedChallengeTarget label="Monthly loss limit" field="monthlyLossLimitPct" setup={setup} setSetup={setSetup} currency={account.baseCurrency} limit/>
    </div></section></div><footer>
      <button type="button" className="tj-icon-btn tj-challenge-setup-delete" aria-label={deleting?'Deleting challenge':'Delete challenge'} title="Delete challenge" disabled={deleting || savingSetup} onClick={async()=>{setDeleting(true);try{if(await onDelete())setSetup(null);}finally{setDeleting(false);}}}><Trash2 size={18}/></button><span/>
      <button type="button" className="tj-btn-outline" aria-label="Cancel" title="Cancel" disabled={deleting || savingSetup} onClick={()=>setSetup(null)}>Cancel</button>
      <button type="button" className="tj-btn-primary" aria-label={savingSetup?'Saving challenge':'Save challenge'} title="Save challenge" disabled={deleting || savingSetup || !setup.name.trim() || !(Number(setup.startingBalance)>0)} onClick={saveSetup}><Save size={16}/>{savingSetup?'Saving…':'Save changes'}</button>
    </footer></section></div>}
    {celebrating&&<ChallengeCelebration accountName={account.name} totalLevels={plan.length} startingBalance={challengeBalance} finalBalance={life.liveBalance} tradingPnl={challengeTradingPnl} currency={account.baseCurrency || 'USD'} onViewJourney={()=>{setCelebrating(false);jumpToActive();}} onClose={()=>setCelebrating(false)}/>}
  </article>;
}
// A deposit can place an account at a higher level, but it is never an earned
// trading pass. Keep that state visible without overriding a later pass or
// step-back for the same level.
function challengeLevelVisualState(state,level) {
  const status=state.statuses?.[level] || '';
  if(status==='Pass') return 'passed';
  if(status==='Step back') return 'back';
  if(status==='Jumped' || state.fundingJumps?.[level]) return 'funded';
  if(status==='In progress') return 'progress';
  return 'not-started';
}
function challengeLevelVisualLabel(state,level) {
  return challengeLevelVisualState(state,level)==='funded'
    ? 'Deposit-funded'
    : state.statuses?.[level] || 'Not started';
}

function ChallengeSplitVisual({account,plan,current,state,life,failed,complete,mode,modeName,rewardLabel,reward,adaptive,failureFloor,linked,fmt,expanded,setExpanded,challenge,openSetup,setup,setSetup,saveSetup,savingSetup,deleting,setDeleting,onDelete,locked,settingsLocked}) {
  const [tab,setTab]=useState('plan');
  const [range,setRange]=useState('1-10');
  const [selected,setSelected]=useState(current.level);
  const [rulesOpen,setRulesOpen]=useState(false);
  const rulesMenuRef=useRef(null);
  const [showSizing,setShowSizing]=useState(true);
  useEffect(()=>{if(expanded)setSelected(current.level);},[expanded,current.level]);
  const passed=Object.values(state.statuses || {}).filter(status=>status==='Pass'||status==='Jumped').length;
  const funded=Object.values(state.statuses || {}).filter(status=>status==='Jumped').length;
  const milestone=plan[Math.min(Math.ceil(plan.length / 2)-1,plan.length-1)];
  const levelRanges=Array.from({length:Math.ceil(plan.length/10)},(_,index)=>{
    const start=index*10+1;
    const end=Math.min(plan.length,start+9);
    return {key:`${start}-${end}`,label:`Levels ${start}–${end}`,start,end};
  });
  const shown=range==='all'?plan:plan.filter(row=>{
    const [start,end]=range.split('-').map(Number);
    return row.level>=start&&row.level<=end;
  });
  const selectedRow=plan.find(row=>row.level===selected) || current;
  const visualState=level=>challengeLevelVisualState(state,level);
  const visualLabel=level=>challengeLevelVisualLabel(state,level);
  const selectStatus=(level,status)=>challenge.setStatus(level,status==='passed'?'Pass':status==='progress'?'In progress':status==='back'?'Step back':'');
  const levelRiskRate=row=>row.start?row.risk/row.start:0;
  const close=()=>setExpanded(false);
  const open=()=>setExpanded(true);
  useEffect(()=>{
    if(!rulesOpen)return undefined;
    const dismiss=event=>{if(!rulesMenuRef.current?.contains(event.target))setRulesOpen(false);};
    const escape=event=>{if(event.key==='Escape')setRulesOpen(false);};
    document.addEventListener('pointerdown',dismiss);
    document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',escape);};
  },[rulesOpen]);
  return <article className={`tj-challenge-split ${expanded?'is-open':''}`}>
    <header
      className="tj-cs-header tj-cs-card"
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-label={`${expanded?'Collapse':'Expand'} ${account.name} compounding plan`}
      onClick={()=>setExpanded(value=>!value)}
      onKeyDown={event=>{
        if(event.key==='Enter'||event.key===' '){
          event.preventDefault();
          setExpanded(value=>!value);
        }
      }}
    >
      <div className="tj-cs-header-main"><h2>{account.name}</h2><span>{modeName}</span>{rewardLabel&&<span>{rewardLabel}</span>}<span>{plan.length} levels</span></div>
      <div className="tj-cs-header-actions"><div className="tj-cs-rules-menu" ref={rulesMenuRef} onClick={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()}><button type="button" className="tj-cs-rule-link" aria-expanded={rulesOpen} aria-haspopup="dialog" onClick={()=>setRulesOpen(value=>!value)}>Rules <ChevronDown size={14} aria-hidden="true"/></button>{rulesOpen&&<ChallengeRulesPopover mode={mode} onClose={()=>setRulesOpen(false)}/>}</div><b className={failed?'is-failed':complete?'is-complete':'is-active'}>{failed?'Failed':complete?'Complete':'Active'}</b><button type="button" className="tj-cs-settings" onClick={event=>{event.stopPropagation();openSetup();}}><Settings size={15}/>Settings</button></div>
    </header>
    {failed&&<p className="tj-cs-alert">Challenge is paused. Live capital is below {fmt(failureFloor)}.</p>}
    <div className="tj-cs-layout">
      <aside className="tj-cs-summary" onClick={event=>{if(!expanded&&!event.target.closest('button'))open();}}>
        <section className="tj-cs-card tj-cs-progress">
          <div className="tj-cs-row"><div><small>CHALLENGE PROGRESS</small><h3>{complete?'Complete':`Level ${current.level}`} <em>of {plan.length}</em></h3></div><div className="tj-cs-current-level"><small>THIS LEVEL</small><strong>{fmt(current.start)} → {fmt(current.end)}</strong></div></div>
                <div className="tj-cs-segments" aria-label={`Level ${current.level} of ${plan.length}`}>{plan.map(row=><i key={row.level} className={`${visualState(row.level)==='passed'?'is-passed':''} ${visualState(row.level)==='funded'?'is-funded':''} ${(visualState(row.level)==='progress'||(row.level===current.level&&visualState(row.level)==='not-started'))?'is-progress':''} ${row.level===current.level?'is-current':''} ${expanded&&row.level===selected?'is-selected':''}`}/>)}</div>
          <div className="tj-cs-ticks"><span>1</span><span>{milestone.level}</span><span>{plan.length}</span></div>
          <p>{passed} of {plan.length} levels reached{funded?` · ${funded} deposit-funded`:''}</p>
        </section>
        <div className="tj-cs-money"><section className="tj-cs-card"><small>AVAILABLE TRADING CAPITAL</small><strong>{fmt(life.liveBalance)}</strong></section><section className="tj-cs-card"><small>FULL CHALLENGE TARGET</small><strong>{fmt(plan.at(-1).end)}</strong></section></div>
        <div className="tj-cs-stats">
          <CsStat label="RISK AT LEVEL START" value={fmt(current.risk)} tone="danger"/><CsStat label="PROFIT TARGET" value={complete?'—':fmt(current.profit)} tone="success"/><CsStat label={adaptive?'MAX DRAWDOWN':'LOSS STREAK'} value={adaptive?`${state.automation?.adaptiveDrawdownPct ?? 10}%`:state.lossStreak||0}/><CsStat label="TRADES TAKEN" value={linked}/><CsStat label="STEP-BACKS" value={state.stepBacks||0}/>
        </div>
        {!expanded&&<button type="button" className="tj-cs-open" onClick={open}><span>Compounding plan <em>{plan.length} levels · Milestone at level {milestone.level} · {fmt(milestone.end)}</em></span>›</button>}
      </aside>
      {expanded&&<section className="tj-cs-plan tj-cs-card" aria-label="Compounding plan">
        <div className="tj-cs-plan-head"><div className="tj-cs-tabs"><button type="button" className={tab==='plan'?'is-selected':''} onClick={()=>setTab('plan')}>Compounding plan</button><button type="button" className={tab==='list'?'is-selected':''} onClick={()=>setTab('list')}>Level list view</button></div><span>Milestone at level {milestone.level} · {fmt(milestone.end)}</span></div>
        {tab==='list'?<LevelListView plan={plan} shown={shown} selected={selected} setSelected={setSelected} current={current} state={state} levelRiskRate={levelRiskRate} reward={reward} fmt={fmt} locked={locked} settingsLocked={settingsLocked} selectStatus={selectStatus} showSizing={showSizing} setShowSizing={setShowSizing} levelRanges={levelRanges} range={range} setRange={setRange}/>:<>
          <p className="tj-cs-lede">One step at a time, build the life you once only imagined.</p>
          <div className="tj-cs-plan-stats"><CsStat label="LEVELS" value={plan.length}/><CsStat label="PASSED" value={passed}/><CsStat label="CURRENTLY ACTIVE" value={`Level ${current.level}`} tone="amber"/><CsStat label="PLANNED FINAL BALANCE" value={fmt(plan.at(-1).end)} tone="success"/></div>
          <div className="tj-cs-plan-controls"><div>{levelRanges.map(({key,label})=><button type="button" key={key} className={range===key?'is-selected':''} onClick={()=>setRange(key)}>{label}</button>)}{levelRanges.length>1&&<button type="button" className={range==='all'?'is-selected':''} onClick={()=>setRange('all')}>All {plan.length}</button>}</div><button type="button" onClick={()=>{setSelected(current.level);const activeRange=levelRanges.find(({start,end})=>current.level>=start&&current.level<=end);setRange(activeRange?.key||'all');}}>Go to current level ↓</button></div>
          <div className="tj-cs-nodes">{shown.map(row=><button key={row.level} type="button" className={`${row.level===current.level?'is-current':''} ${row.level===selected?'is-selected':''} ${visualState(row.level)}`} onClick={()=>setSelected(row.level)}>{row.level}</button>)}</div>
          <div className="tj-cs-detail"><div><div className="tj-cs-row"><h3>Level {selectedRow.level}</h3><b className={`tj-cs-status ${visualState(selectedRow.level)}`}>{visualLabel(selectedRow.level)}</b></div>{visualState(selectedRow.level)==='funded'&&<p className="tj-cs-funded-note">Deposit-funded jump — this level was not passed by trading.</p>}<div className="tj-cs-balance-pair"><div><small>Balance at start</small><strong>{fmt(selectedRow.start)}</strong></div><i>×{(selectedRow.start?selectedRow.end/selectedRow.start:0).toFixed(2)}</i><div><small>Balance at target</small><strong>{fmt(selectedRow.end)}</strong></div></div><div className="tj-cs-detail-tiles"><CsStat label="RISK" value={fmt(selectedRow.risk)} tone="danger" sub={`${(levelRiskRate(selectedRow)*100).toFixed(2)}% of balance`}/><CsStat label="PROFIT TARGET" value={fmt(selectedRow.profit)} tone="success" sub={`${reward}R reward`}/><CsStat label="GROWTH THIS LEVEL" value={`+${(selectedRow.start?((selectedRow.end-selectedRow.start)/selectedRow.start)*100:0).toFixed(0)}%`} sub={`×${(selectedRow.start?selectedRow.end/selectedRow.start:0).toFixed(2)}`}/></div><b className="tj-cs-section-title">Status</b><div className="tj-cs-statuses">{[['','Not started'],['In progress','In progress'],['Pass','Passed'],['Step back','Step back']].map(([value,label])=><button type="button" key={label} className={state.statuses?.[selectedRow.level]===value?'is-selected':''} onClick={()=>selectStatus(selectedRow.level,value==='Pass'?'passed':value==='In progress'?'progress':value==='Step back'?'back':'not-started')} disabled={locked||settingsLocked}>{label}</button>)}</div></div><div><b className="tj-cs-section-title">Notes</b><textarea key={selectedRow.level} defaultValue={state.notes?.[selectedRow.level]||''} onBlur={event=>challenge.setNote(selectedRow.level,event.target.value)} placeholder="Add a note about this level"/><b className="tj-cs-section-title">Sizing details</b><dl><div><dt>Risk percentage</dt><dd>{selectedRow.riskPct.toFixed(2)}%</dd></div><div><dt>Reward ratio</dt><dd>{reward}R</dd></div><div><dt>Profit percentage</dt><dd>{selectedRow.profitPct.toFixed(2)}%</dd></div><div><dt>Stop loss</dt><dd>{selectedRow.sl.toFixed(2)}</dd></div><div><dt>Take profit</dt><dd>{selectedRow.tp}</dd></div><div><dt>Lot size</dt><dd>{selectedRow.lots.toFixed(2)} lots</dd></div></dl></div></div>
        </>}
      </section>}
    </div>
    {setup&&<ChallengeSplitSettingsModal setup={setup} setSetup={setSetup} account={account} locked={settingsLocked} saving={savingSetup} deleting={deleting} onCancel={()=>setSetup(null)} onSave={saveSetup} onDelete={async()=>{setDeleting(true);try{if(await onDelete())setSetup(null);}finally{setDeleting(false);}}}/>} 
  </article>;
}
function CsStat({label,value,tone='',sub}) { return <div className={`tj-cs-stat ${tone}`}><small>{label}</small><strong>{value}</strong>{sub&&<em>{sub}</em>}</div>; }
function LevelListView({plan,shown,selected,setSelected,current,state,levelRiskRate,reward,fmt,locked,settingsLocked,selectStatus,showSizing,setShowSizing,levelRanges,range,setRange}) {
  const selectedRow=plan.find(row=>row.level===selected) || current;
  const status=state.statuses?.[selectedRow.level] || '';
  const visualState=level=>challengeLevelVisualState(state,level);
  const visualLabel=level=>challengeLevelVisualLabel(state,level);
  const classFor=row=>['tj-cs-level-node',row.level===current.level&&'is-current',row.level===selected&&'is-selected',visualState(row.level)].filter(Boolean).join(' ');
  return <div className="tj-cs-level-list">
    <p className="tj-cs-lede">Review each level’s sizing and progress without adding level notes.</p>
    <div className="tj-cs-plan-controls tj-cs-list-controls"><div>{levelRanges.map(({key,label})=><button type="button" key={key} className={range===key?'is-selected':''} onClick={()=>setRange(key)}>{label}</button>)}{levelRanges.length>1&&<button type="button" className={range==='all'?'is-selected':''} onClick={()=>setRange('all')}>All {plan.length}</button>}</div><button type="button" className={showSizing?'is-selected':''} aria-pressed={showSizing} onClick={()=>setShowSizing(value=>!value)}>{showSizing?'✓ ':''}Sizing check</button></div>
    <div className="tj-cs-nodes tj-cs-level-nodes">{shown.map(row=><button key={row.level} type="button" className={classFor(row)} onClick={()=>setSelected(row.level)}><span>{row.level}</span><small>{row.level===current.level?'Current':visualLabel(row.level)}</small></button>)}</div>
    <section className="tj-cs-list-detail">
      <div className="tj-cs-list-overview"><div className="tj-cs-row"><h3>Level {selectedRow.level}</h3><b className={['tj-cs-status',visualState(selectedRow.level)].join(' ')}>{visualLabel(selectedRow.level)}</b></div>{visualState(selectedRow.level)==='funded'&&<p className="tj-cs-funded-note">Deposit-funded jump — this level was not passed by trading.</p>}<div className="tj-cs-balance-pair"><div><small>Balance at start</small><strong>{fmt(selectedRow.start)}</strong></div><i>×{(selectedRow.start?selectedRow.end/selectedRow.start:0).toFixed(2)}</i><div><small>Balance at target</small><strong>{fmt(selectedRow.end)}</strong></div></div><b className="tj-cs-section-title">Status</b><div className="tj-cs-statuses">{[['','Not started'],['In progress','In progress'],['Pass','Passed'],['Step back','Step back']].map(([value,label])=><button type="button" key={label} className={status===value?'is-selected':''} onClick={()=>selectStatus(selectedRow.level,value==='Pass'?'passed':value==='In progress'?'progress':value==='Step back'?'back':'not-started')} disabled={locked||settingsLocked}>{label}</button>)}</div></div>
      <div className="tj-cs-list-sizing"><div className="tj-cs-row"><h3>Sizing check</h3><button type="button" className={showSizing?'is-selected':''} aria-pressed={showSizing} onClick={()=>setShowSizing(value=>!value)}>{showSizing?'On':'Off'}</button></div>{showSizing?<dl><div><dt>Risk percentage</dt><dd>{selectedRow.riskPct.toFixed(2)}%</dd></div><div><dt>Reward ratio</dt><dd>{reward}R</dd></div><div><dt>Profit percentage</dt><dd>{selectedRow.profitPct.toFixed(2)}%</dd></div><div><dt>Stop loss</dt><dd>{selectedRow.sl.toFixed(2)}</dd></div><div><dt>Take profit</dt><dd>{selectedRow.tp}</dd></div><div><dt>Lot size</dt><dd>{selectedRow.lots.toFixed(2)} lots</dd></div></dl>:<p>Sizing details are hidden. Turn the check on to review this level’s values.</p>}</div>
    </section>
  </div>;
}
function ChallengeSplitSettingsModal({setup,setSetup,account,locked,saving:savingSetup,deleting,onCancel,onSave,onDelete}) {
  const modeLocked = locked;
  return <div className="tj-modal-overlay tj-modal-overlay-centered" onMouseDown={event=>{if(event.target===event.currentTarget&&!savingSetup&&!deleting)setSetup(null);}} role="dialog" aria-modal="true" aria-label="Challenge settings">
    <section className="tj-panel tj-challenge-setup">
      <header><div><small>EDIT CHALLENGE SETUP</small><h3>{account.name}</h3></div></header>
      <div className="tj-challenge-setup-body">
        <section className="tj-challenge-setup-section"><h4>Account & plan</h4><div className="tj-challenge-setup-grid">
          <label>Account name<input className="tj-input" value={setup.name} onChange={event=>setSetup({...setup,name:event.target.value})}/></label>
          <label>Challenge starting balance<input className="tj-input" value={setup.startingBalance} readOnly/></label>
          <label>Mode<ThemeSelect label="Challenge mode" disabled={modeLocked} value={setup.mode} onChange={event=>setSetup({...setup,mode:event.target.value})}><option value="risk">Mode 1 — Risk Limit</option><option value="streak" disabled={Number(setup.reward)<=2.8}>Mode 2 — Two-Loss Streak</option><option value="adaptive">Mode 3 — Adaptive Balance</option></ThemeSelect></label>
          <label>Plan length<ThemeSelect label="Plan length" disabled={modeLocked} value={setup.levelCount} onChange={event=>setSetup({...setup,levelCount:event.target.value})}>{[10,15,20,30].map(value=><option key={value} value={value}>{value} levels</option>)}</ThemeSelect></label>
          <label>{setup.mode==='adaptive'?'Target (R)':'Risk to reward'}<input className="tj-input" type="number" min="0.01" step="0.01" disabled={modeLocked} value={setup.reward} onChange={event=>setSetup({...setup,reward:event.target.value,mode:setup.mode==='streak'&&Number(event.target.value)<=2.8?'risk':setup.mode})}/></label>
          {setup.mode==='adaptive'&&<><label>Risk per trade (%)<input className="tj-input" type="number" min="0.01" max="100" step="0.01" disabled={modeLocked} value={setup.adaptiveRiskPct} onChange={event=>setSetup({...setup,adaptiveRiskPct:event.target.value})}/></label><label>Maximum drawdown (%)<input className="tj-input" type="number" min="0" max="99.99" step="0.01" disabled={modeLocked} value={setup.adaptiveDrawdownPct} onChange={event=>setSetup({...setup,adaptiveDrawdownPct:event.target.value})}/></label></>}
        </div></section>
        <section className="tj-challenge-setup-section"><h4>Goals</h4><div className="tj-challenge-setup-grid"><LinkedChallengeTarget label="Monthly goal" field="monthlyGoalPct" setup={setup} setSetup={setSetup} currency={account.baseCurrency}/><LinkedChallengeTarget label="Yearly goal" field="yearlyGoalPct" setup={setup} setSetup={setSetup} currency={account.baseCurrency}/></div></section>
        <section className="tj-challenge-setup-section"><h4>Risk Guardrails</h4><div className="tj-challenge-setup-grid"><LinkedChallengeTarget label="Daily loss limit" field="dailyLossLimitPct" setup={setup} setSetup={setSetup} currency={account.baseCurrency} limit/><LinkedChallengeTarget label="Monthly loss limit" field="monthlyLossLimitPct" setup={setup} setSetup={setSetup} currency={account.baseCurrency} limit/></div></section>
      </div>
      <footer><button type="button" className="tj-icon-btn tj-challenge-setup-delete" onClick={onDelete} disabled={savingSetup||deleting}><Trash2 size={18}/></button><span/><button type="button" className="tj-btn-outline" onClick={onCancel} disabled={savingSetup||deleting}>Cancel</button><button type="button" className="tj-btn-primary" onClick={onSave} disabled={savingSetup||deleting||!setup.name.trim()}><Save size={16}/>{savingSetup?'Saving…':'Save changes'}</button></footer>
    </section>
  </div>;
}

function LevelRail({plan,statuses,currentLevel,onSelect}) {
  return <div className="tj-challenge-level-rail" style={{'--level-count':plan.length}} aria-label="Challenge level progress">{plan.map(row=><div key={row.level}><button type="button" aria-label={'View level '+row.level} aria-current={row.level===currentLevel?'step':undefined} className={[statuses?.[row.level]==='Pass'?'is-passed':'',[10,20,30].includes(row.level)?'is-milestone':'',row.level===currentLevel?'is-current':''].join(' ')} onClick={()=>onSelect(row.level)}/><span aria-hidden="true" className={["tj-phone-level-segment",statuses?.[row.level]==="Pass"?"is-passed":"",[10,20,30].includes(row.level)?"is-milestone":"",row.level===currentLevel?"is-current":""].join(" " )}/><small>{row.level===1||[10,20,30].includes(row.level)?row.level:''}</small></div>)}</div>;
}
function LinkedChallengeTarget({label,field,setup,setSetup,currency='USD',limit=false}) {
  const base=Number(setup.startingBalance) || 0;
  const amount=setup[`${field}Amount`] ?? targetAmount(setup[field],base);
  return <div className="tj-challenge-linked-target">
    <label>{label} (%)<input className="tj-input" type="number" min="0" max={limit?100:undefined} step="0.01" value={setup[field]} onChange={event=>setSetup(current=>changeSetupTarget(current,field,event.target.value,'percentage'))}/></label>
    <label>{label} ({currency})<input className="tj-input" type="number" min="0" max={limit?base:undefined} step="0.01" value={amount} onChange={event=>setSetup(current=>changeSetupTarget(current,field,event.target.value,'amount'))}/></label>
  </div>;
}

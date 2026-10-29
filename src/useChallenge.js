import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {challengeDb} from './challengeDb';
import {isLocalJournal} from './localJournalDb';
import {emptyChallenge, isChallengeEnabled, changeChallengeStatus} from './challengeModel';
import {normaliseChallengeLevelCount} from './challengeModel';
import {resetAutomation, replayChallenge, validMode} from './challengeAutomation';
import {queueChallengeWrite, waitForChallengeWrites} from './challengeAutosave';
import {challengeLifecycle, liveChallengeBalance} from './challengeLifecycle';
import {canUseLossStreak} from './challengeModel';

const normaliseProgress = (progress) => progress ? {
  activeLevel: progress.activeLevel ?? progress.active_level,
  statuses: progress.statuses || {},
  notes: progress.notes || {},
  automation: progress.automation || null,
} : null;

export default function useChallenge(account, userId, startupProgress = null, startupComplete = false) {
  const key=account?.id ? `${isLocalJournal()?'local':'cloud'}:${userId}:${account.id}` : '';
  const currentKey=useRef(key); currentKey.current=key;
  const seed=useMemo(()=>normaliseProgress(startupProgress) || (startupComplete ? emptyChallenge() : null),[startupProgress,startupComplete]);
  const [record,setRecord]=useState(()=>seed && key ? {key,state:seed,modesReady:true} : null);
  const [loading,setLoading]=useState(()=>Boolean(key && !seed)), [saving,setSaving]=useState(false), [error,setError]=useState('');
  const ready=record?.key === key;
  const baseline=ready ? record.state : emptyChallenge();
  const state=useMemo(()=>{const replay=replayChallenge(baseline,account);const life=challengeLifecycle(baseline,account);return {...replay,...life,failed:replay.failed || life.failed};},[baseline,account]);
  const latest=useRef(null);
  const flight=useRef(null);
  useEffect(()=>{
    const warn=event=>{if(flight.current || latest.current){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',warn);
    return()=>window.removeEventListener('beforeunload',warn);
  },[]);
  const reload=useCallback(async()=>{
    if (!key) return;
    setLoading(true);setError('');
    try {
      await waitForChallengeWrites(key);
      const {data,error:failure}=await challengeDb.read('account',account.id,userId);
      if(failure)throw failure;
      // A zero-row column query distinguishes an old schema from a fresh account.
      const probe=await challengeDb.probe('account',account.id);
      if(currentKey.current!==key)return;
      const next=data ? {activeLevel:data.active_level,statuses:data.statuses || {},notes:data.notes || {},automation:data.automation || null} : emptyChallenge();
      setRecord({key,state:next,modesReady:!probe.error});latest.current=null;
    } catch(failure) {if(currentKey.current===key)setError(`Could not load challenge: ${failure.message}. Check that the Challenge SQL migrations are applied.`);}
    finally {if(currentKey.current===key)setLoading(false);}
  },[key,account?.id,userId]);
  useEffect(()=>{
    const next=normaliseProgress(startupProgress);
    setRecord(seed && key ? {key,state:seed,modesReady:true} : null);
    latest.current=null;flight.current=null;setSaving(false);
    setLoading(Boolean(key && !seed));
  },[key,reload,seed]);
  // Account Settings can open before the app bootstrap delivers challenge
  // progress. In that case it still needs to load its own record instead of
  // leaving the mode controls permanently in a loading state.
  useEffect(()=>{
    if(key && !seed) void reload();
  },[key,seed,reload]);
  useEffect(()=>{
    const restored=()=>{void reload();};
    window.addEventListener('aaicorefx:backup-restored',restored);
    return()=>window.removeEventListener('aaicorefx:backup-restored',restored);
  },[reload]);
  async function persist(next) {
    if(!ready || loading || flight.current===key) return false;
    flight.current=key;
    setSaving(true);setError('');latest.current={key,next};
    try {
      await queueChallengeWrite(key,async()=>{
        const payload={account_id:account.id,user_id:userId,active_level:next.activeLevel,statuses:next.statuses,notes:next.notes,updated_at:new Date().toISOString()};
        if(record.modesReady)payload.automation=next.automation || null;
        const {error:failure}=await challengeDb.save('account',payload);
        if(failure)throw failure;
      });
      if(currentKey.current===key){setRecord({...record,state:next});latest.current=null;}
      return true;
    } catch(failure) {if(currentKey.current===key)setError(`Could not save challenge: ${failure.message}`);return false;}
    finally {if(currentKey.current===key){flight.current=null;setSaving(false);}}
  }
  const reset=(mode,level,levelCount,rewardRatio=state.automation?.rewardRatio,adaptiveRiskPct=state.automation?.adaptiveRiskPct,adaptiveDrawdownPct=state.automation?.adaptiveDrawdownPct)=>{
    if(state.settingsLocked) {setError('Challenge settings are locked because this challenge has linked trades.');return false;}
    if(mode==='streak' && rewardRatio && !canUseLossStreak(rewardRatio)) {setError('Two-Loss Streak requires a reward above 1:2.8.');return false;}
    return persist(resetAutomation({...state,automation:{...state.automation,rewardRatio,adaptiveRiskPct:mode==='adaptive'?Number(adaptiveRiskPct)||1:undefined,adaptiveDrawdownPct:mode==='adaptive'?Number(adaptiveDrawdownPct)||10:undefined}},account.trades || [],mode,level,new Date(),levelCount,liveChallengeBalance(account)));
  };
  return {state, loading:loading || !ready, saving, error, modesReady:ready && record.modesReady,
    reload, retry:()=>latest.current?.key===key ? persist(latest.current.next) : reload(),
    setMode:mode=>reset(mode,state.activeLevel),
    configure:(mode,level,levelCount,rewardRatio,adaptiveRiskPct,adaptiveDrawdownPct)=>reset(mode,level,levelCount,rewardRatio,adaptiveRiskPct,adaptiveDrawdownPct),
    setReward:reward=>reset(state.automation?.mode || 'risk',state.activeLevel,state.automation?.levelCount,reward),
    setAdaptiveRisk:risk=>reset('adaptive',state.activeLevel,state.automation?.levelCount,state.automation?.rewardRatio,risk,state.automation?.adaptiveDrawdownPct),
    setAdaptiveDrawdown:drawdown=>reset('adaptive',state.activeLevel,state.automation?.levelCount,state.automation?.rewardRatio,state.automation?.adaptiveRiskPct,drawdown),
    setLevel:level=>reset(baseline.automation?.mode,level),
    setLevelCount:levelCount=>{
      if(state.settingsLocked) return false;
      const totalLevels=normaliseChallengeLevelCount(levelCount);
      const statuses=Object.fromEntries(Object.entries(state.statuses || {}).filter(([level]) => Number(level) <= totalLevels));
      const activeLevel=Math.min(Number(state.activeLevel) || 1, totalLevels);
      return persist({...state, activeLevel, statuses, automation:{...(state.automation || {}), levelCount:totalLevels}});
    },
    includeImportedTrades:tradeIds=>{
      const ids=[...new Set((tradeIds || []).filter(Boolean))];
      if(!ids.length || !validMode(baseline.automation?.mode)) return true;
      const included=new Set(baseline.automation.includedIds || []);
      ids.forEach(id=>included.add(id));
      return persist({...baseline,automation:{...baseline.automation,includedIds:[...included]}});
    },
    setStatus:(level,status)=>{
      if(state.failed || state.settingsLocked) return false;
      const next=changeChallengeStatus(state,level,status);
      return persist(resetAutomation(next,account.trades || [],baseline.automation?.mode,next.activeLevel,new Date(),undefined,liveChallengeBalance(account)));
    },
    setNote:(level,note)=>persist({...baseline,notes:{...baseline.notes,[level]:note}})
  };
}

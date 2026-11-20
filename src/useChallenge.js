import {getJournalSafety} from './journalDataSafety.js';
import {normaliseAdaptiveStepBack} from './challengeRules.js';
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
  baseRevision: progress.updatedAt ?? progress.updated_at ?? null,
} : null;

export default function useChallenge(account, userId, startupProgress = null, startupComplete = false) {
  const key=account?.id ? `${isLocalJournal()?'local':'cloud'}:${userId}:${account.id}` : '';
  const currentKey=useRef(key); currentKey.current=key;
  const seed=useMemo(()=>normaliseProgress(startupProgress) || (startupComplete ? {...emptyChallenge(),baseRevision:null} : null),[startupProgress,startupComplete]);
  const [record,setRecord]=useState(()=>seed && key ? {key,state:seed,modesReady:true} : null);
  const [loading,setLoading]=useState(()=>Boolean(key && !seed)), [saving,setSaving]=useState(false), [error,setError]=useState('');
  const ready=record?.key === key;
  const baseline=ready ? record.state : emptyChallenge();
  const state=useMemo(()=>{const replay=replayChallenge(baseline,account);const life=challengeLifecycle(baseline,account);return {...replay,...life,failed:replay.failed || life.failed};},[baseline,account]);
  const [readVerified,setReadVerified]=useState(startupComplete===true);
  const draft=useMemo(()=>userId&&account?.id?getJournalSafety(userId).forWorkspace(account.id).draft('challenge-progress','account',{next:null}):null,[userId,key]);
  const latest=useRef(null);
  useEffect(()=>{let active=true;void draft?.ready().then(snapshot=>{
    if(active&&snapshot.dirty&&snapshot.value.next){latest.current={key,next:snapshot.value.next};setRecord({key,state:snapshot.value.next,modesReady:false});setError('Recovered local progress. Review and retry before syncing.');}
  }).catch(error=>{if(active)setError(error.message);});return()=>{active=false;};},[draft,key]);
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
      const next=data ? {activeLevel:data.active_level,statuses:data.statuses || {},notes:data.notes || {},automation:data.automation || null,baseRevision:data.updated_at??null} : {...emptyChallenge(),baseRevision:null};
      setReadVerified(true);setRecord({key,state:latest.current?.key===key?latest.current.next:next,modesReady:!probe.error});
    } catch(failure) {if(currentKey.current===key){setReadVerified(false);setError(`Could not load challenge: ${failure.message}. Check that the Challenge SQL migrations are applied.`);}}
    finally {if(currentKey.current===key)setLoading(false);}
  },[key,account?.id,userId]);
  useEffect(()=>{
    const next=normaliseProgress(startupProgress);
    if(latest.current?.key!==key){setRecord(seed && key ? {key,state:seed,modesReady:startupComplete} : null);latest.current=null;}
    setReadVerified(startupComplete===true);
    setLoading(Boolean(key && !seed));
  },[key,reload,seed]);
  // Account Settings can open before the app bootstrap delivers challenge
  // progress. In that case it still needs to load its own record instead of
  // leaving the mode controls permanently in a loading state.
  useEffect(()=>{
    if(key && (!seed||!startupComplete)) void reload();
  },[key,seed,startupComplete,reload]);
  useEffect(()=>{
    const restored=()=>{void reload();};
    window.addEventListener('aaicorefx:backup-restored',restored);
    return()=>window.removeEventListener('aaicorefx:backup-restored',restored);
  },[reload]);
  // Settings can change an unlocked challenge's plan without changing its
  // account id. Apply that confirmed save in memory so the open Challenge
  // page immediately uses the new mode, targets and level count.
  useEffect(()=>{
    const sync=(event)=>{
      if(event.detail?.accountId===account?.id && event.detail?.state){
        setRecord(current=>current?.key===key ? {...current,state:latest.current?.key===key?latest.current.next:event.detail.state} : current);
        setReadVerified(true);
        setError('');
        setLoading(false);
      }
    };
    window.addEventListener('aaicorefx:account-challenge-updated',sync);
    return()=>window.removeEventListener('aaicorefx:account-challenge-updated',sync);
  },[account?.id,key]);
  async function persist(next) {
    if(!draft)return false;
    if(!Object.hasOwn(next,'baseRevision'))next={...next,baseRevision:baseline.baseRevision};
    latest.current={key,next};setRecord(current=>current?.key===key?{...current,state:next}:current);draft.edit({next});
    let attempt;try{attempt=await draft.capture();}catch(error){setError(error.message);return false;}
    if(!ready || loading || !readVerified || flight.current===key){setError('Progress is retained on this device. Load the saved challenge before retrying.');return false;}
    flight.current=key;
    setSaving(true);setError('');
    try {
      await queueChallengeWrite(key,async()=>{
        const payload={account_id:account.id,user_id:userId,active_level:next.activeLevel,statuses:next.statuses,notes:next.notes,updated_at:new Date().toISOString()};
        if(record.modesReady)payload.automation=next.automation || null;
        const {data:saved,error:failure}=await challengeDb.save('account',payload,next.baseRevision);
        if(saved?.updated_at)next={...next,baseRevision:saved.updated_at};
        if(failure)throw failure;
      });
      await draft.acknowledge(attempt);
      if(currentKey.current===key){if(!draft.getSnapshot().dirty)latest.current=null;setRecord({...record,state:latest.current?.next||next});}
      return true;
    } catch(failure) {if(currentKey.current===key)setError(`Could not save challenge: ${failure.message}`);return false;}
    finally {if(currentKey.current===key){flight.current=null;setSaving(false);}}
  }
  const reset=(mode,level,levelCount,rewardRatio=state.automation?.rewardRatio,adaptiveRiskPct=state.automation?.adaptiveRiskPct,adaptiveDrawdownPct=state.automation?.adaptiveDrawdownPct,adaptiveStepBack=state.automation?.adaptiveStepBack)=>{
    if(state.settingsLocked) {setError('Challenge settings are locked because this challenge has linked trades.');return false;}
    if(mode==='streak' && rewardRatio && !canUseLossStreak(rewardRatio)) {setError('Two losses on a level needs a reward of 2.8R or more.');return false;}
    return persist(resetAutomation({...state,automation:{...state.automation,rewardRatio,adaptiveRiskPct:mode==='adaptive'?Number(adaptiveRiskPct)||1:undefined,adaptiveDrawdownPct:mode==='adaptive'?Number(adaptiveDrawdownPct)||10:undefined,adaptiveStepBack:mode==='adaptive'?normaliseAdaptiveStepBack(adaptiveStepBack):undefined}},account.trades || [],mode,level,new Date(),levelCount,liveChallengeBalance(account)));
  };
  return {state, loading:loading || (!ready && !error), saving, error, modesReady:ready && record.modesReady,
    reload, retry:()=>latest.current?.key===key ? persist(latest.current.next) : reload(),
    setMode:mode=>reset(mode,state.activeLevel),
    configure:(mode,level,levelCount,rewardRatio,adaptiveRiskPct,adaptiveDrawdownPct,adaptiveStepBack)=>reset(mode,level,levelCount,rewardRatio,adaptiveRiskPct,adaptiveDrawdownPct,adaptiveStepBack),
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
    setNote:(level,note)=>persist({...baseline,notes:{...baseline.notes,[level]:note}}),
    acknowledgeCompletion:certificate=>persist({...baseline,automation:{...(baseline.automation || {}),completionAcknowledgedAt:new Date().toISOString(),completionCertificate:certificate || null}})
  };
}

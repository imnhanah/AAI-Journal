import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {useNavigationCache} from './NavigationSession.jsx';
import { challengeDb } from './challengeDb';
import { isLocalJournal } from './localJournalDb';
import { changeChallengeStatus, emptyChallenge, normaliseChallengeLevelCount } from './challengeModel';
import { replayChallenge, resetAutomation } from './challengeAutomation';
import {scopeChallengeAccount, challengeLifecycle, liveChallengeBalance} from './challengeLifecycle';
import {canUseLossStreak} from './challengeModel';

// Multi-balance challenge records deliberately live beside their balance, not
// the shared workspace. This keeps level selection and notes independent.
const normaliseProgress = (progress) => progress ? {
  activeLevel: progress.activeLevel ?? progress.active_level,
  statuses: progress.statuses || {},
  notes: progress.notes || {},
  automation: progress.automation || null,
} : null;

export default function useBalanceChallenge(balance, userId, startupProgress = null, startupComplete = false) {
  const cache = useNavigationCache('challenge-progress');
  const balanceId = balance?.id;
  const localMode = isLocalJournal();
  const cacheKey = `${localMode?'local':'cloud'}:${userId}:${balanceId}`;
  const seed = useMemo(() => normaliseProgress(startupProgress) || (startupComplete ? emptyChallenge() : null), [startupProgress, startupComplete]);
  const [record, setRecord] = useState(() => ({key:cacheKey,state:cache.read(cacheKey) || seed || emptyChallenge()}));
  const state = record.key === cacheKey ? record.state : cache.read(cacheKey) || emptyChallenge();
  const setState = useCallback(next => setRecord({key:cacheKey,state:next}), [cacheKey]);
  const request = useRef(0);
  const currentKey = useRef(cacheKey); currentKey.current = cacheKey;
  const mounted = useRef(true);
  useEffect(() => {mounted.current=true;return () => {mounted.current=false;request.current++;};}, []);
  const [loading, setLoading] = useState(() => Boolean(balanceId && userId && !cache.read(cacheKey) && !seed));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const hasSavedBalanceId = Boolean(balanceId && !String(balanceId).startsWith('draft-'));

  const reload = useCallback(async () => {
    const ticket = ++request.current;
    if (!hasSavedBalanceId || !userId) { setState(emptyChallenge()); setError(''); return; }
    setLoading(true); setError('');
    try {
      const { data, error: failure } = await challengeDb.read('balance', balanceId, userId);
      if (failure) throw failure;
      if(!mounted.current || ticket!==request.current || currentKey.current!==cacheKey)return;
      const next=data ? { activeLevel:data.active_level, statuses:data.statuses || {}, notes:data.notes || {}, automation:data.automation ? { ...data.automation, startedAt:data.automation.startedAt || data.updated_at } : null } : emptyChallenge();
      cache.write(cacheKey,next);
      setState(next);
    } catch (failure) {
      if(mounted.current && ticket===request.current && currentKey.current===cacheKey)setError(`Could not load ${balance?.name || 'balance'} challenge: ${failure.message}. Apply supabase/multi_balance_workspaces_migration.sql and retry.`);
    } finally { if(mounted.current && ticket===request.current && currentKey.current===cacheKey)setLoading(false); }
  }, [balance?.name, balanceId, hasSavedBalanceId, userId, localMode, cache, cacheKey, setState]);

  useEffect(() => {
    const next = cache.read(cacheKey) || normaliseProgress(startupProgress) || (startupComplete ? emptyChallenge() : null);
    setState(next || emptyChallenge());
    if (next) { setLoading(false); return; }
    // Bootstrap normally supplies this record. Account Settings can open
    // before that completes, however, so fall back to one direct read rather
    // than leaving its mode controls stuck on “Loading saved mode…”.
    if (hasSavedBalanceId && userId) void reload();
    else setLoading(false);
  }, [hasSavedBalanceId, userId, reload, cache, cacheKey, setState, startupProgress, startupComplete]);
  useEffect(() => {
    const restored = () => { void reload(); };
    window.addEventListener('aaicorefx:backup-restored', restored);
    return () => window.removeEventListener('aaicorefx:backup-restored', restored);
  }, [reload]);

  // Account Settings and the Challenge page each mount this hook for a
  // balance. Share an in-memory update so the visible plan changes instantly
  // instead of waiting for a remount or a browser reload.
  useEffect(() => {
    const sync = (event) => {
      if (event.detail?.balanceId === balanceId && event.detail?.state) {
        request.current++;
        cache.write(cacheKey,event.detail.state);
        setState(event.detail.state);setLoading(false);
      }
    };
    window.addEventListener('aaicorefx:balance-challenge-updated', sync);
    return () => window.removeEventListener('aaicorefx:balance-challenge-updated', sync);
  }, [balanceId, cache, cacheKey, setState]);

  const persist = useCallback(async (next) => {
    if (!userId) return false;
    if (!hasSavedBalanceId) { setState(next); setError(''); return true; }
    setSaving(true); setError('');
    try {
      const { error: failure } = await challengeDb.save('balance', { balance_id:balanceId, user_id:userId, active_level:next.activeLevel, statuses:next.statuses, notes:next.notes, automation:next.automation || { mode:balance.challengeMode || 'risk' }, updated_at:new Date().toISOString() });
      if (failure) throw failure;
      request.current++;
      cache.write(cacheKey,next);
      if(mounted.current && currentKey.current===cacheKey){setState(next);setLoading(false);}
      window.dispatchEvent(new CustomEvent('aaicorefx:balance-challenge-updated', { detail:{ balanceId, state:next } }));
      return true;
    } catch (failure) {
      setError(`Could not save ${balance?.name || 'balance'} challenge: ${failure.message}`);
      return false;
    } finally { setSaving(false); }
  }, [balance?.challengeMode, balance?.name, balanceId, hasSavedBalanceId, userId, cache, cacheKey, setState]);

  const challengeAccount = useMemo(() => scopeChallengeAccount({
    trades:balance?.trades || [],
    financeMovements:balance?.financeMovements || [],
    balances:Array.isArray(balance?.balances) ? balance.balances : balance ? [balance] : [],
  },balance || {}), [balance]);
  const replayedState = useMemo(() => {
    const baseline={...state,automation:state.automation ? {...state.automation,rewardRatio:state.automation.rewardRatio ?? balance?.challengeReward}:null};
    const replay=replayChallenge(baseline,challengeAccount);const life=challengeLifecycle(baseline,challengeAccount);
    return {...replay,...life,failed:replay.failed || life.failed};
  }, [state, challengeAccount, balance?.challengeReward]);
  const setMode = (mode) => mode
    ? replayedState.settingsLocked || (mode==='streak' && !canUseLossStreak(balance?.challengeReward ?? 3.1)) ? false : persist(resetAutomation(replayedState, challengeAccount.trades, mode, replayedState.activeLevel,new Date(),undefined,liveChallengeBalance(challengeAccount)))
    : replayedState.settingsLocked ? false : persist({ ...state, automation:null });
  const setLevel = (level) => {
    if(replayedState.settingsLocked) return false;
    const totalLevels = normaliseChallengeLevelCount(replayedState.automation?.levelCount);
    const activeLevel = Math.min(Math.max(Number(level) || 1, 1), totalLevels);
    const statuses = { ...(replayedState.statuses || {}) };
    Object.keys(statuses).forEach((key) => { if (statuses[key] === 'In progress') statuses[key] = ''; });
    statuses[activeLevel] = 'In progress';
    return persist(resetAutomation({ ...replayedState, activeLevel, statuses }, challengeAccount.trades, replayedState.automation?.mode || balance?.challengeMode || 'risk', activeLevel,new Date(),undefined,liveChallengeBalance(challengeAccount)));
  };
  const setLevelCount = (levelCount) => {
    if(replayedState.settingsLocked) return false;
    const totalLevels = normaliseChallengeLevelCount(levelCount);
    const statuses = Object.fromEntries(Object.entries(replayedState.statuses || {}).filter(([level]) => Number(level) <= totalLevels));
    const activeLevel = Math.min(Number(replayedState.activeLevel) || 1, totalLevels);
    return persist({ ...replayedState, activeLevel, statuses, automation:{ ...(replayedState.automation || {}), levelCount:totalLevels } });
  };
  return { state:replayedState, loading, saving, error, modesReady:true, retry:reload, setMode, setLevel, setLevelCount, setReward:reward=>replayedState.settingsLocked ? false : persist({...state,automation:{...state.automation,rewardRatio:reward}}), setStatus:(level, status) => replayedState.failed || replayedState.settingsLocked ? false : persist(changeChallengeStatus(replayedState, level, status)), setNote:(level, note) => persist({ ...state, notes:{ ...state.notes, [level]:note } }) };
}

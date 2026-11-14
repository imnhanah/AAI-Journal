import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import { normalizeRoutine, loadRoutineProfile, saveRoutineProfile } from './dailyRoutine';

export function useDailyRoutine(user, { isLocal = () => false, localMode = false } = {}) {
  const key=`tj:daily-routine:${user.id}`;
  const [routine,setRoutine]=useState(()=>normalizeRoutine(user.user_metadata?.dailyRoutine));
  const latest=useRef(routine), queue=useRef(Promise.resolve());
  const deviceKey = `${key}:device`;
  const readLocal = () => {
    try { return JSON.parse(localStorage.getItem(deviceKey)) || normalizeRoutine(null); }
    catch { return normalizeRoutine(null); }
  };
  const persistLocal = value => {
    const next = normalizeRoutine(value);
    localStorage.setItem(deviceKey, JSON.stringify(next));
    return publish(next);
  };
  const publish=value=>{ const next=normalizeRoutine(value); latest.current=next; setRoutine(next); try {localStorage.setItem(key,JSON.stringify(next));}catch{} return next; };
  useEffect(()=>{publish(localMode ? readLocal() : user.user_metadata?.dailyRoutine);},[user.id,user.user_metadata?.dailyRoutine,localMode]);
  useEffect(()=>{
    const receive=event=>{if(event.key===(localMode ? deviceKey : key)&&event.newValue){try{const next=normalizeRoutine(JSON.parse(event.newValue));latest.current=next;setRoutine(next);}catch{}}};
    window.addEventListener('storage',receive);return()=>window.removeEventListener('storage',receive);
  },[key,deviceKey,localMode]);
  const refresh=async()=>{
    if (isLocal()) return publish(readLocal());
    // Read browser-shared state at every click, then validate current profile remotely.
    try {const saved=JSON.parse(localStorage.getItem(key));if(saved) latest.current=normalizeRoutine(saved);}catch{}
    return publish(await loadRoutineProfile(supabase.auth,user.id));
  };
  const update=mutate=>{
    const persist=async()=>{
      if (isLocal()) return persistLocal(mutate(readLocal()));
      return publish(await saveRoutineProfile(supabase.auth,user.id,mutate));
    };
    const work=queue.current.catch(()=>{}).then(()=>globalThis.navigator?.locks ? navigator.locks.request(`tj-daily-routine:${user.id}`,persist) : persist());
    queue.current=work;return work;
  };
  const restore=nextRoutine=>{
    const next=normalizeRoutine(nextRoutine);
    const persist=async()=>{
      if (isLocal()) return persistLocal(next);
      // Keep the browser cache aligned before the profile write so a complete
      // local backup remains recoverable if the connection drops afterward.
      publish(next);
      try { return publish(await saveRoutineProfile(supabase.auth,user.id,()=>next)); }
      catch(error) { throw new Error(`Journal restored locally, but Daily Routine could not be confirmed in your profile: ${error?.message || 'retry when online.'}`); }
    };
    const work=queue.current.catch(()=>{}).then(()=>globalThis.navigator?.locks ? navigator.locks.request(`tj-daily-routine:${user.id}`,persist) : persist());
    queue.current=work;return work;
  };
  return {routine,refresh,update,restore};
}

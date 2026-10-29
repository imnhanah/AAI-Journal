import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import { normalizeRoutine, loadRoutineProfile, saveRoutineProfile } from './dailyRoutine';

export function useDailyRoutine(user) {
  const key=`tj:daily-routine:${user.id}`;
  const [routine,setRoutine]=useState(()=>normalizeRoutine(user.user_metadata?.dailyRoutine));
  const latest=useRef(routine), queue=useRef(Promise.resolve());
  const publish=value=>{ const next=normalizeRoutine(value); latest.current=next; setRoutine(next); try {localStorage.setItem(key,JSON.stringify(next));}catch{} return next; };
  useEffect(()=>{publish(user.user_metadata?.dailyRoutine);},[user.id,user.user_metadata?.dailyRoutine]);
  useEffect(()=>{
    const receive=event=>{if(event.key===key&&event.newValue){try{const next=normalizeRoutine(JSON.parse(event.newValue));latest.current=next;setRoutine(next);}catch{}}};
    window.addEventListener('storage',receive);return()=>window.removeEventListener('storage',receive);
  },[key]);
  const refresh=async()=>{
    // Read browser-shared state at every click, then validate current profile remotely.
    try {const saved=JSON.parse(localStorage.getItem(key));if(saved) latest.current=normalizeRoutine(saved);}catch{}
    return publish(await loadRoutineProfile(supabase.auth,user.id));
  };
  const update=mutate=>{
    const persist=async()=>{
      return publish(await saveRoutineProfile(supabase.auth,user.id,mutate));
    };
    const work=queue.current.catch(()=>{}).then(()=>globalThis.navigator?.locks ? navigator.locks.request(`tj-daily-routine:${user.id}`,persist) : persist());
    queue.current=work;return work;
  };
  return {routine,refresh,update};
}

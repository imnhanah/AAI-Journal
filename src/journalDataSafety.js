import {useEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import {supabase} from './supabaseClient';
import {isLocalJournal} from './localJournalDb';
import {createSyncSession} from './syncSession.js';
import {createIndexedDbSyncStorage} from './durableSyncStorage.js';
import {createDurableSync} from './durableSync.js';
import {createJournalDraftController} from './journalDraftController.js';
import {createMobileStudyDraftController} from './mobileCaseStudyDraftController.js';

const runtimes=new Map();let authBound=false,authOwner=undefined;
const projectId=()=>new URL(import.meta.env.VITE_SUPABASE_URL).host;
function bindAuth(){
  if(authBound)return;authBound=true;
  supabase.auth.onAuthStateChange((_event,session)=>{
    authOwner=session?.user?.id||null;
    for(const runtime of runtimes.values())if(runtime.ownerId!==authOwner){runtime.session.activate(null);runtime.controllers.clear();} // Durable rows are never cleared.
  });
}
export function getJournalSafety(userId,{mode=isLocalJournal()?'local':'cloud',project=projectId()}={}){
  if(!userId)throw new Error('Sign in before saving a safety draft.');bindAuth();
  const key=JSON.stringify([project,userId]);
  if(!runtimes.has(key)){
    const session=createSyncSession(),storage=createIndexedDbSyncStorage();
    runtimes.set(key,{ownerId:userId,session,storage,repository:createDurableSync({storage,session}),controllers:new Map(),contexts:new Map()});
  }
  const runtime=runtimes.get(key);
  if(authOwner!==null&&(authOwner===undefined||authOwner===userId))runtime.session.activate({projectId:project,ownerId:userId});
  const contextKey=JSON.stringify([mode]);
  if(!runtime.contexts.has(contextKey)){
    const context={mode,userId,projectId:project,runtime,
      forWorkspace(workspaceId){return featureContext(context,[String(workspaceId)]);},
      recordReadFailure(){/* Error authority stays with feature state; no mode switch. */},
    };
    runtime.contexts.set(contextKey,context);
  }
  return runtime.contexts.get(contextKey);
}
function featureContext(root,path){
  const key=JSON.stringify([root.mode,...path]);
  if(root.runtime.contexts.has(key))return root.runtime.contexts.get(key);
  const context={...root,forReviewScope(balanceId){return featureContext(root,[...path,'review-scope',balanceId]);},
    draft(kind,id,initialValue,onError,mergeRecovered){
      const feature=JSON.stringify(['journal-safety',root.mode,...path,kind]),recordId=String(id),key=feature+recordId;
      if(!root.runtime.controllers.has(key))root.runtime.controllers.set(key,createJournalDraftController({repository:root.runtime.repository,feature,recordId,initialValue,onError,mergeRecovered}));
      return root.runtime.controllers.get(key);
    },
  };
  root.runtime.contexts.set(key,context);return context;
}
export function useJournalDataSafety({userId,mode}){return useMemo(()=>getJournalSafety(userId,{mode}),[userId,mode]);}
export function useReviewDraftController({context,periodId,confirmedAnswers,onDrafts,onError}){
  const controller=useMemo(()=>context.draft('period-review',periodId,{},onError),[context,periodId]);
  const active=useRef(controller);active.current=controller;
  const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot);
  useEffect(()=>{onDrafts(state.value);if(state.error)onError(state.error.message);},[controller,state,onDrafts,onError]);
  return useMemo(()=>({
    edit(key,text){const next=controller.edit(current=>{if(text===(confirmedAnswers[key]??''))delete current[key];else current[key]=text;return current;});onDrafts(next);},
    async captureAndPersist(){const captured=await controller.capture();return {...captured,changed:captured.value};},
    async acknowledge(attempt){if(active.current===controller)await controller.acknowledge(attempt);},
    hasUnacknowledgedChanges:()=>controller.getSnapshot().dirty,
    flushLocal:()=>controller.flush(),isCurrent:()=>active.current===controller,
    async dismissCurrent(){await controller.dismiss();if(active.current===controller){controller.setConfirmed({});onDrafts({});}},
  }),[controller,confirmedAnswers,onDrafts]);
}
export function useMobileCaseStudyDraftController({context,confirmedWorkspace,confirmedRevision,submitPatch,textToDoc}){
  const controller=useMemo(()=>createMobileStudyDraftController({context,workspace:confirmedWorkspace,revision:confirmedRevision,textToDoc,submit:submitPatch}),[context]);
  controller.updateTransport(submitPatch);
  const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot);
  useEffect(()=>controller.receiveConfirmed(confirmedWorkspace,confirmedRevision),[controller,confirmedWorkspace,confirmedRevision]);
  useEffect(()=>{controller.attachView();return()=>controller.detachView();},[controller]);
  return {...controller,workspace:state.workspace};
}
export async function listSafetyDrafts(userId,kind,{mode=isLocalJournal()?'local':'cloud'}={}){
  const {runtime}=getJournalSafety(userId,{mode}),token=runtime.session.capture(),scope=[token.projectId,token.ownerId];
  return runtime.storage.transaction('readonly',async tx=>{
    const rows=await tx.list('drafts',scope);
    return rows.filter(row=>{if(row.schemaVersion!==1)throw new Error('Unknown draft schema.');if(typeof row.feature!=='string'||!row.feature.startsWith('["journal-safety",'))return false;const f=JSON.parse(row.feature);return f[0]==='journal-safety'&&f[1]===mode&&f.at(-1)===kind;});
  },{assert:()=>runtime.session.assert(token),subscribe:listener=>runtime.session.subscribe(listener)});
}

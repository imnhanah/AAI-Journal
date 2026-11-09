import { useEffect, useState } from 'react';
import { validateEvidenceImage } from './caseStudyWorkspace.js';
import { isDocumentImageReference, readCaseStudyDocumentImage } from './caseStudyDocumentImages.js';
import { isCaseStudyEvidenceCloudReference, resolveCaseStudyEvidenceCloudUrl } from './caseStudyEvidenceCloud.js';

const DATABASE='tj-case-study-evidence-images';
const STORE='images';
const PREFIX='tj-case-study-evidence:';
const id=()=>globalThis.crypto?.randomUUID?.() || `evidence-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const transactionDone=transaction=>new Promise((resolve,reject)=>{transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);});
const requestResult=request=>new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
const open=()=>new Promise((resolve,reject)=>{
  if (!globalThis.indexedDB) return reject(new Error('Evidence image storage is unavailable in this browser.'));
  const request=globalThis.indexedDB.open(DATABASE,1);
  request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
});

export const isEvidenceImageReference=value=>typeof value==='string' && value.startsWith(PREFIX);
// Shared Evidence can point either at its own blob store or at the original
// Research Notes blob. Both must wait for IndexedDB resolution; neither is a
// browser-loadable image URL.
export const isStoredEvidenceImageReference=value=>isEvidenceImageReference(value)||isDocumentImageReference(value)||isCaseStudyEvidenceCloudReference(value);

export async function saveEvidenceImage(file) {
  const error=validateEvidenceImage(file); if (error) throw new Error(error);
  const ref=`${PREFIX}${id()}`;
  const database=await open();
  try {
    const transaction=database.transaction(STORE,'readwrite');
    transaction.objectStore(STORE).put({blob:file,type:file.type,name:file.name||'Evidence image',savedAt:new Date().toISOString()},ref);
    await transactionDone(transaction);
    return ref;
  } finally { database.close(); }
}

export async function readEvidenceImageReference(ref) {
  if (!isEvidenceImageReference(ref)) return null;
  const database=await open();
  try { return (await requestResult(database.transaction(STORE,'readonly').objectStore(STORE).get(ref)))?.blob || null; }
  finally { database.close(); }
}

export function useEvidenceImageUrl(value) {
  const [state,setState]=useState({url:isStoredEvidenceImageReference(value)?'':value||'',loading:isStoredEvidenceImageReference(value),missing:false});
  useEffect(()=>{
    let active=true; let objectUrl='';
    if (!isStoredEvidenceImageReference(value)) { setState({url:value||'',loading:false,missing:false}); return undefined; }
    setState({url:'',loading:true,missing:false});
    if (isCaseStudyEvidenceCloudReference(value)) {
      resolveCaseStudyEvidenceCloudUrl(value).then(result=>{
        if (!active) return;
        if (!result.url) { setState({url:'',loading:false,missing:true}); return; }
        setState({url:result.url,loading:false,missing:false});
      }).catch(()=>active&&setState({url:'',loading:false,missing:true}));
      return ()=>{active=false;};
    }
    const read=isDocumentImageReference(value) ? readCaseStudyDocumentImage : readEvidenceImageReference;
    read(value).then(blob=>{
      if (!active) return;
      if (!blob) { setState({url:'',loading:false,missing:true}); return; }
      objectUrl=URL.createObjectURL(blob); setState({url:objectUrl,loading:false,missing:false});
    }).catch(()=>active&&setState({url:'',loading:false,missing:true}));
    return ()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[value]);
  return state;
}

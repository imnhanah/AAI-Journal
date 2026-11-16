import { useLayoutEffect, useState, useCallback, useRef } from 'react';
import { validateEvidenceImage } from './caseStudyWorkspace.js';
import { isDocumentImageReference, readCaseStudyDocumentImage } from './caseStudyDocumentImages.js';
import { isCaseStudyEvidenceCloudReference, peekCaseStudyEvidenceCloudBlob, resolveCaseStudyEvidenceCloudBlob } from './caseStudyEvidenceCloud.js';
import { caseStudySharedImageIntegration, caseStudySharedImageId, isCaseStudySharedImageReference } from './caseStudySharedImageIntegration.js';

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
const debugImageDiagnostic=(stage, code='')=>{
  if (import.meta.env?.DEV) console.warn('[Case Study image]', {stage,code});
};
export const reportCaseStudyImageDecodeFailure=()=>debugImageDiagnostic('image-decoding-failed');
export const sharedImageCloudReference=({cloudRef='',metadata=null,userId='',assetId='' }={})=>
  cloudRef || (metadata?.cloudPath ? `tj-case-study-storage:${metadata.cloudPath}` : userId && assetId ? `tj-case-study-storage:${userId}/${assetId}` : '');
// Shared Evidence can point either at its own blob store or at the original
// Research Notes blob. Both must wait for IndexedDB resolution; neither is a
// browser-loadable image URL.
export const isStoredEvidenceImageReference=value=>isEvidenceImageReference(value)||isDocumentImageReference(value)||isCaseStudyEvidenceCloudReference(value)||isCaseStudySharedImageReference(value);

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

export function useEvidenceImageUrl(value, { userId='', cloudRef='', localOnly=false, defer=false } = {}) {
  const [attempt,setAttempt]=useState(0);
  const [visible,setVisible]=useState(!defer);
  const observer=useRef(null);
  const observeRef=useCallback(node=>{observer.current?.disconnect();if(!node)return;if(!defer||typeof IntersectionObserver==='undefined'){setVisible(true);return;}observer.current=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.current?.disconnect();}},{rootMargin:'100px'});observer.current.observe(node);},[defer]);
  useLayoutEffect(()=>()=>observer.current?.disconnect(),[]);
  const [state,setState]=useState(null);
  const stored=isStoredEvidenceImageReference(value);
  const requestKey=JSON.stringify([value,userId,cloudRef,attempt,visible,localOnly]);
  const retry=()=>setAttempt(current=>current+1);
  useLayoutEffect(()=>{
    if (!stored || !visible) return undefined;
    let active=true; let objectUrl='';
    const showBlob = blob => {
      if (!active) return;
      if (blob) objectUrl=URL.createObjectURL(blob);
      setState({requestKey,url:objectUrl,loading:false,missing:!blob});
    };
    const showCloudImage = async reference => {
      const result=await resolveCaseStudyEvidenceCloudBlob(reference,{userId});
      if (!result.blob) debugImageDiagnostic('cloud-image-resolution',result.code||'cloud-network-failed');
      showBlob(result.blob);
    };
    const cleanup=()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
    const assetId=caseStudySharedImageId(value);
    const reference=isCaseStudyEvidenceCloudReference(value) ? value : assetId
      ? sharedImageCloudReference({cloudRef,userId,assetId}) : '';
    const cached=peekCaseStudyEvidenceCloudBlob(reference,userId);
    if (cached) {
      showBlob(cached);
      return cleanup;
    }
    if (assetId) {
      const resolveSharedImage=async()=>{
        let blob=null; let metadata=null;
        try {
          blob=await caseStudySharedImageIntegration.storage.getImage(assetId,userId);
          if (!active) return;
          if (blob) { showBlob(blob); return; }
          metadata=await caseStudySharedImageIntegration.storage.getImageMetadata(assetId,userId);
        } catch {
          // A browser may deny or lose IndexedDB after a refresh. A verified
          // cloud reference must still be allowed to recover the image.
          debugImageDiagnostic('local-image-unavailable','local-image-missing');
        }
        if (!active) return;
        // Assets use a stable, owner-scoped object path. A second browser may
        // receive a rich-document `tj-image:` reference before it has local
        // metadata, so it can still request its private cloud copy safely.
        if((localOnly||metadata?.storageState==='local-only')&&!cloudRef&&!metadata?.cloudPath){showBlob(null);return;}
        const reference=sharedImageCloudReference({cloudRef,metadata,userId,assetId});
        if (!reference) { debugImageDiagnostic('cloud-reference-missing','missing-cloud-reference'); showBlob(null); return; }
        await showCloudImage(reference);
      };
      void resolveSharedImage().catch(()=>{
        debugImageDiagnostic('cloud-image-resolution','cloud-network-failed');
        showBlob(null);
      });
      return cleanup;
    }
    if (isCaseStudyEvidenceCloudReference(value)) {
      void showCloudImage(value).catch(()=>showBlob(null));
      return cleanup;
    }
    const read=isDocumentImageReference(value) ? readCaseStudyDocumentImage : readEvidenceImageReference;
    read(value).then(showBlob).catch(()=>showBlob(null));
    return cleanup;
  },[value,userId,cloudRef,stored,requestKey,visible,localOnly]);
  if (!stored) return {url:value||'',loading:false,missing:false,retry,observeRef};
  if (state?.requestKey === requestKey) return {...state,retry,observeRef};
  return {url:'',loading:true,missing:false,retry,observeRef};
}

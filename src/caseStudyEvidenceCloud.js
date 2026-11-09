import { normaliseCaseStudyWorkspace } from './caseStudyWorkspace.js';
import { readEvidenceImageReference } from './caseStudyEvidenceImages.js';
import { isDocumentImageReference, readCaseStudyDocumentImage } from './caseStudyDocumentImages.js';

export const CASE_STUDY_EVIDENCE_BUCKET='case-study-evidence';
const PREFIX='tj-case-study-storage:';
const LOCAL_EVIDENCE_PREFIX='tj-case-study-evidence:';
export const isCaseStudyEvidenceCloudReference=value=>typeof value==='string'&&value.startsWith(PREFIX);
export const caseStudyEvidenceCloudReference=path=>`${PREFIX}${path}`;
export const caseStudyEvidenceCloudPath=reference=>isCaseStudyEvidenceCloudReference(reference)?reference.slice(PREFIX.length):'';
const imagePath=(userId,evidenceId)=>`${userId}/${evidenceId}`;
const storageClient=async()=> (await import('./supabaseClient.js')).supabase;

export async function resolveCaseStudyEvidenceCloudUrl(reference,{client}={}) {
  const path=caseStudyEvidenceCloudPath(reference); if (!path) return {error:'Invalid Case Study image reference.'};
  const supabase=client||await storageClient();
  const {data,error}=await supabase.storage.from(CASE_STUDY_EVIDENCE_BUCKET).createSignedUrl(path,60*10);
  return error ? {error:error.message || 'The shared evidence image could not be opened.'} : {url:data?.signedUrl || ''};
}

export async function uploadCaseStudyEvidenceImage({userId,evidenceId,blob,cloudRef='',client}={}) {
  if (!userId||!evidenceId||!blob) return {error:'The evidence image is incomplete.'};
  const path=caseStudyEvidenceCloudPath(cloudRef)||imagePath(userId,evidenceId); const supabase=client||await storageClient();
  const bucket=supabase.storage.from(CASE_STUDY_EVIDENCE_BUCKET);
  const {error:uploadError}=await bucket.upload(path,blob,{upsert:false,contentType:blob.type||'application/octet-stream'});
  if (uploadError && !/already exists|duplicate/i.test(uploadError.message||'')) return {error:uploadError.message||'The evidence image could not be uploaded.'};
  // A metadata response alone is not enough: read the private object back
  // before publishing its durable reference into the synchronized library.
  const {data:verified,error:verifyError}=await bucket.download(path);
  if (verifyError||!verified||verified.size!==blob.size) return {error:verifyError?.message||'The evidence image upload could not be verified.'};
  return {cloudRef:caseStudyEvidenceCloudReference(path)};
}

const localBlob=async evidence=>{
  const reference=evidence?.url||evidence?.documentImageRef||'';
  if (typeof reference==='string' && reference.startsWith(LOCAL_EVIDENCE_PREFIX)) return readEvidenceImageReference(reference);
  if (isDocumentImageReference(reference)) return readCaseStudyDocumentImage(reference);
  return null;
};

// Never replaces local references. Only confirmed cloud objects add cloudRef;
// failed or unavailable images remain untouched and can be retried later.
export async function synchronizeCaseStudyEvidenceImages({userId,workspace,client}={}) {
  const base=normaliseCaseStudyWorkspace(workspace); const failures=[]; let uploaded=0;
  const evidence=[];
  for (const item of base.evidence) {
    if (isCaseStudyEvidenceCloudReference(item.cloudRef)) { evidence.push(item); continue; }
    const blob=await localBlob(item);
    if (!blob) { evidence.push(item); if ((item.url||'').startsWith(LOCAL_EVIDENCE_PREFIX)||isDocumentImageReference(item.url||item.documentImageRef)) failures.push({id:item.id,reason:'Image bytes are only available on another device.'}); continue; }
    const result=await uploadCaseStudyEvidenceImage({userId,evidenceId:item.id,blob,cloudRef:item.cloudRef,client});
    if (result.error) { evidence.push(item); failures.push({id:item.id,reason:result.error}); continue; }
    evidence.push({...item,cloudRef:result.cloudRef}); uploaded+=1;
  }
  return {workspace:{...base,evidence},uploaded,failures};
}

import { canQueueCloudUpload, createSharedImageStorage, IMAGE_STORAGE_STATES } from './sharedImageStorage.js';
import { caseStudyEvidenceCloudPath, caseStudyEvidenceCloudReference, uploadCaseStudyEvidenceImage } from './caseStudyEvidenceCloud.js';

// New Case Study media cannot share the journal's historical `tj-image:`
// namespace, whose suffix is revision JSON rather than an asset identifier.
export const CASE_STUDY_SHARED_IMAGE_PREFIX = 'tj-case-study-media:';
const CASE_STUDY_IMAGE_MODULES = ['case-study-evidence', 'case-study-document'];
const LEGACY_CASE_STUDY_SHARED_IMAGE_PREFIX = 'tj-image:';
const SAFE_LEGACY_ASSET_ID = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|asset-[a-z0-9-]+)$/i;
export const caseStudySharedImageReference = id => `${CASE_STUDY_SHARED_IMAGE_PREFIX}${id}`;
export const caseStudySharedImageId = value => {
  if (typeof value !== 'string') return '';
  if (value.startsWith(CASE_STUDY_SHARED_IMAGE_PREFIX)) return value.slice(CASE_STUDY_SHARED_IMAGE_PREFIX.length);
  const legacyId = value.startsWith(LEGACY_CASE_STUDY_SHARED_IMAGE_PREFIX) ? value.slice(LEGACY_CASE_STUDY_SHARED_IMAGE_PREFIX.length) : '';
  // Preserve older Case Study assets without mistaking journal RPC JSON for
  // a Case Study image ID.
  return SAFE_LEGACY_ASSET_ID.test(legacyId) ? legacyId : '';
};
export const isCaseStudySharedImageReference = value => !!caseStudySharedImageId(value);

// Apply verified references to the same evidence and asset in the latest
// workspace. Uploads can finish after edits, removals or an image replacement.
export function applyVerifiedCaseStudyImageReferences(workspace, synchronizedEvidence, verifiedAssets=[]) {
  const verified = new Map(synchronizedEvidence.filter(item => item.cloudRef).map(item => [item.id, item]));
  let changed = false;
  const evidence = workspace.evidence.map(item => {
    const candidate = verified.get(item.id);
    if (!candidate || item.cloudRef || !item.url || candidate.url !== item.url) return item;
    changed = true;
    return { ...item, cloudRef: candidate.cloudRef, localOnly:false };
  });
  const refs=new Map(verifiedAssets.map(asset=>[asset.reference,asset.cloudRef]));
  const visit=value=>{if(!value||typeof value!=='object')return value;if(Array.isArray(value)){const next=value.map(visit);return next.some((x,i)=>x!==value[i])?next:value;}let next=value;for(const [key,item]of Object.entries(value)){const result=visit(item);if(result!==item){if(next===value)next={...value};next[key]=result;}}const ref=refs.get(value.src);if(ref&&!value.cloudRef)next={...next,cloudRef:ref,localOnly:false};return next;};
  return visit(changed ? { ...workspace, evidence } : workspace);
}

// This adapter is intentionally narrow: it makes the Case Study Library use
// the shared, owner-scoped queue without changing the existing workspace data
// model or any historical image reader.
export function createCaseStudySharedImageIntegration({ storage = createSharedImageStorage(), uploader = uploadCaseStudyEvidenceImage } = {}) {
  const save = async ({ userId, membership, file, sourceRecordId = '', sourceModule = 'case-study-evidence' } = {}) => {
    const asset = await storage.saveImage({ userId, membership, file, sourceModule, sourceRecordId, fileName: file?.name || 'Case Study image' });
    return { asset, reference: caseStudySharedImageReference(asset.id), localOnly: asset.storageState === IMAGE_STORAGE_STATES.LOCAL_ONLY };
  };
  const sync = async ({ userId, membership, getMembership, workspace } = {}) => {
    if(getMembership)membership=await getMembership();
    // An image can be selected while membership is still resolving. In that
    // case it is deliberately stored local-only, rather than risk an
    // unauthorized upload. Once independent image authorization is confirmed, promote
    // *only* referenced, un-published Case Study assets into the existing queue.
    // This preserves the evidence record and its stable reference; the
    // cloudRef is still published only after processUploadQueue verifies bytes.
    let recoveredLocalOnly = 0;
    if (canQueueCloudUpload(membership)) {
      const references=new Set((workspace?.evidence||[]).filter(item=>!item.cloudRef).map(item=>caseStudySharedImageId(item.url)).filter(Boolean));
      const collect=value=>{if(Array.isArray(value)){value.forEach(collect);return;}if(value&&typeof value==='object'){if(value.src&&!value.cloudRef){const id=caseStudySharedImageId(value.src);if(id)references.add(id);}for(const[key,item]of Object.entries(value))if(key!=='src'&&key!=='cloudRef')collect(item);}else if(typeof value==='string'){const id=caseStudySharedImageId(value);if(id)references.add(id);}};
      collect(workspace?.studies||[]);
      for (const assetId of references) {
        const asset = await storage.getImageMetadata(assetId, userId);
        if (asset?.storageState !== IMAGE_STORAGE_STATES.LOCAL_ONLY || asset.cloudPath || !CASE_STUDY_IMAGE_MODULES.includes(asset.sourceModule)) continue;
        if (await storage.queueCloudUpload(assetId, { userId, membership })) recoveredLocalOnly += 1;
      }
    }
    const result = { processed: 0, failed: 0, recovered: 0 };
    const upload = async ({ asset, blob, userId: ownerUserId }) => {
      const uploaded = await uploader({
        userId: ownerUserId,
        evidenceId: asset.id,
        blob,
        cloudRef: asset.cloudPath ? caseStudyEvidenceCloudReference(asset.cloudPath) : '',
      });
      if (!uploaded?.verified) return { error: uploaded?.error || 'Cloud image upload could not be verified.' };
      return { verified: true, cloudPath: caseStudyEvidenceCloudPath(uploaded.cloudRef), checksum: uploaded.checksum };
    };
    for (const sourceModule of CASE_STUDY_IMAGE_MODULES) {
      const counts = await storage.processUploadQueue({ userId, membership, getMembership, sourceModule, uploader: upload });
      result.processed += counts.processed;
      result.failed += counts.failed;
      result.recovered += counts.recovered;
    }
    const evidence = await Promise.all((workspace?.evidence || []).map(async item => {
      const assetId = caseStudySharedImageId(item?.url);
      if (!assetId) return item;
      const asset = await storage.getImageMetadata(assetId, userId);
      if (asset?.storageState !== IMAGE_STORAGE_STATES.CLOUD_VERIFIED || !asset.cloudPath || item.cloudRef || !CASE_STUDY_IMAGE_MODULES.includes(asset.sourceModule)) return item;
      // Keep the local shared reference as url. It is always tried first;
      // cloudRef is only metadata published after byte verification.
      return { ...item, cloudRef: caseStudyEvidenceCloudReference(asset.cloudPath), localOnly:false };
    }));
    const assets=await storage.getImagesForRecord(userId,'');
    const verifiedAssets=assets.filter(asset=>asset.storageState===IMAGE_STORAGE_STATES.CLOUD_VERIFIED&&asset.cloudPath&&CASE_STUDY_IMAGE_MODULES.includes(asset.sourceModule)).map(asset=>({reference:caseStudySharedImageReference(asset.id),cloudRef:caseStudyEvidenceCloudReference(asset.cloudPath)}));
    return { ...result, recoveredLocalOnly, verifiedAssets, workspace:applyVerifiedCaseStudyImageReferences({...workspace,evidence},evidence,verifiedAssets) };
  };
  return {
    saveEvidenceImage: save,
    saveDocumentImage: options => save({ ...options, sourceModule: 'case-study-document' }),
    synchronizeWorkspace: sync,
    deleteReference: async ({ reference, userId } = {}) => {
      const id = caseStudySharedImageId(reference);
      return id ? storage.deleteImage(id, userId) : false;
    },
    retryReference: async ({ reference, userId, membership } = {}) => {
      const id = caseStudySharedImageId(reference);
      return id ? storage.retryFailedUpload(id, { userId, membership }) : false;
    },
    storage,
  };
}

export const caseStudySharedImageIntegration = createCaseStudySharedImageIntegration();

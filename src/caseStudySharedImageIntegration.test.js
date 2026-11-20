import test from 'node:test';
import assert from 'node:assert/strict';
import { MEMBERSHIP } from './membership.js';
import { calculateImageChecksum, createSharedImageStorage, IMAGE_STORAGE_STATES } from './sharedImageStorage.js';
import { caseStudyEvidenceCloudReference } from './caseStudyEvidenceCloud.js';
import { applyVerifiedCaseStudyImageReferences, createCaseStudySharedImageIntegration, caseStudySharedImageId, isCaseStudySharedImageReference } from './caseStudySharedImageIntegration.js';

const png = () => new Blob([new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])], {type:'image/png'});
const owner = {status:'ready',membership:MEMBERSHIP.OWNER,imageAccessStatus:'ready',imageUploadsAllowed:true};
const free = {status:'ready',membership:MEMBERSHIP.FREE};

function memoryPersistence() {
  const assets=new Map(), binaries=new Map(), queue=new Map(), leases=new Map();
  return {
    async save(asset,blob,item){assets.set(asset.id,structuredClone(asset));binaries.set(asset.id,{id:asset.id,ownerUserId:asset.ownerUserId,blob});if(item)queue.set(item.id,structuredClone(item));},
    async getAsset(id){return assets.get(id)?structuredClone(assets.get(id)):null;}, async getBinary(id){return binaries.get(id)||null;},
    async putAsset(asset){assets.set(asset.id,structuredClone(asset));}, async putQueue(item){queue.set(item.id,structuredClone(item));}, async getQueue(id){return queue.get(id)?structuredClone(queue.get(id)):null;},
    async listQueue(userId){return [...queue.values()].filter(item=>item.ownerUserId===userId).map(item=>structuredClone(item));},
    async listAssets(userId,sourceRecordId){return [...assets.values()].filter(item=>item.ownerUserId===userId&&(!sourceRecordId||item.sourceRecordId===sourceRecordId)).map(item=>structuredClone(item));},
    async updateAssetQueue(asset,item,remove=false){if(asset)assets.set(asset.id,structuredClone(asset));if(remove)queue.delete(item?.id||`upload:${asset?.id}`);else if(item)queue.set(item.id,structuredClone(item));},
    async acquireLease({assetId,userId,holderId,expiresAt,timestamp}){const key=`upload-lock:${assetId}`,current=leases.get(key);if(current&&current.ownerUserId===userId&&Date.parse(current.expiresAt)>timestamp)return false;leases.set(key,{id:key,assetId,ownerUserId:userId,holderId,expiresAt});return true;},
    async releaseLease({assetId,userId,holderId}){const key=`upload-lock:${assetId}`,current=leases.get(key);if(current?.ownerUserId===userId&&current.holderId===holderId)leases.delete(key);}, async clearLease({assetId,userId}){const key=`upload-lock:${assetId}`;if(leases.get(key)?.ownerUserId===userId)leases.delete(key);},
  };
}

test('an Owner Case Study image remains local first and publishes cloudRef only after verified upload', async () => {
  const storage=createSharedImageStorage({persistence:memoryPersistence()});
  const integration=createCaseStudySharedImageIntegration({storage,uploader:async({userId,evidenceId,blob})=>({verified:true,cloudRef:caseStudyEvidenceCloudReference(`${userId}/${evidenceId}`),checksum:await calculateImageChecksum(blob)})});
  const saved=await integration.saveEvidenceImage({userId:'owner-a',membership:owner,file:png(),sourceRecordId:'evidence-a'});
  assert.equal(isCaseStudySharedImageReference(saved.reference),true);
  assert.equal(await storage.getStorageStatus(saved.asset.id,'owner-a'),IMAGE_STORAGE_STATES.PENDING_UPLOAD);
  assert.equal((await storage.getImage(saved.asset.id,'owner-a')).size,png().size);
  const result=await integration.synchronizeWorkspace({userId:'owner-a',membership:owner,workspace:{evidence:[{id:'evidence-a',url:saved.reference}]}});
  assert.equal(result.processed,1);
  assert.equal(result.workspace.evidence[0].url,saved.reference);
  assert.equal(result.workspace.evidence[0].cloudRef,caseStudyEvidenceCloudReference(`owner-a/${saved.asset.id}`));
});

test('Free Case Study images stay local-only and never call the cloud uploader', async () => {
  const storage=createSharedImageStorage({persistence:memoryPersistence()}); let uploads=0;
  const integration=createCaseStudySharedImageIntegration({storage,uploader:async()=>{uploads+=1;return {verified:true};}});
  const saved=await integration.saveEvidenceImage({userId:'free-a',membership:free,file:png()});
  const result=await integration.synchronizeWorkspace({userId:'free-a',membership:free,workspace:{evidence:[{id:'free-evidence',url:saved.reference}]}});
  assert.equal(uploads,0); assert.equal(result.processed,0); assert.equal(result.workspace.evidence[0].cloudRef,undefined);
  assert.equal(await storage.getStorageStatus(saved.asset.id,'free-a'),IMAGE_STORAGE_STATES.LOCAL_ONLY);
});

test('an Owner safely recovers a Case Study image saved while membership was unresolved', async () => {
  const storage=createSharedImageStorage({persistence:memoryPersistence()}); let uploads=0;
  const integration=createCaseStudySharedImageIntegration({storage,uploader:async({userId,evidenceId,blob})=>{
    uploads+=1;
    return {verified:true,cloudRef:caseStudyEvidenceCloudReference(`${userId}/${evidenceId}`),checksum:await calculateImageChecksum(blob)};
  }});
  const unresolved={status:'loading',membership:null};
  const saved=await integration.saveEvidenceImage({userId:'owner-a',membership:unresolved,file:png(),sourceRecordId:'evidence-safari'});
  assert.equal(await storage.getStorageStatus(saved.asset.id,'owner-a'),IMAGE_STORAGE_STATES.LOCAL_ONLY);

  const result=await integration.synchronizeWorkspace({
    userId:'owner-a', membership:owner,
    workspace:{evidence:[{id:'evidence-safari',url:saved.reference}]},
  });

  assert.equal(result.recoveredLocalOnly,1);
  assert.equal(result.processed,1);
  assert.equal(uploads,1);
  assert.equal(await storage.getStorageStatus(saved.asset.id,'owner-a'),IMAGE_STORAGE_STATES.CLOUD_VERIFIED);
  assert.equal((await storage.getImage(saved.asset.id,'owner-a')).size,png().size);
  assert.equal(result.workspace.evidence[0].url,saved.reference);
  assert.equal(result.workspace.evidence[0].cloudRef,caseStudyEvidenceCloudReference(`owner-a/${saved.asset.id}`));
});

test('Case Study shared media has a distinct namespace while safely reading old asset IDs', async () => {
  const storage=createSharedImageStorage({persistence:memoryPersistence()});
  const integration=createCaseStudySharedImageIntegration({storage});
  const saved=await integration.saveEvidenceImage({userId:'owner-a',membership:owner,file:png()});
  assert.match(saved.reference,/^tj-case-study-media:/);
  assert.equal(isCaseStudySharedImageReference('tj-image:{"user":"owner"}'),false);
  assert.equal(caseStudySharedImageId('tj-image:123e4567-e89b-12d3-a456-426614174000'),'123e4567-e89b-12d3-a456-426614174000');
});

test('failed Case Study uploads retain local bytes, then retry without changing the stable image reference', async () => {
  const storage=createSharedImageStorage({persistence:memoryPersistence()}); let available=false;
  const integration=createCaseStudySharedImageIntegration({storage,uploader:async({userId,evidenceId,blob})=>available?{verified:true,cloudRef:caseStudyEvidenceCloudReference(`${userId}/${evidenceId}`),checksum:await calculateImageChecksum(blob)}:{error:'offline'}});
  const saved=await integration.saveDocumentImage({userId:'owner-a',membership:owner,file:png(),sourceRecordId:'study-a'});
  assert.equal((await integration.synchronizeWorkspace({userId:'owner-a',membership:owner,workspace:{evidence:[]}})).failed,1);
  assert.equal((await storage.getImage(saved.asset.id,'owner-a')).size,png().size);
  available=true;
  assert.equal((await integration.synchronizeWorkspace({userId:'owner-a',membership:owner,workspace:{evidence:[]}})).processed,1);
  assert.equal(await storage.getStorageStatus(saved.asset.id,'owner-a'),IMAGE_STORAGE_STATES.CLOUD_VERIFIED);
});


test('late verification preserves newer edits, deleted records and replaced images', () => {
  const evidence = [
    {id:'kept',url:'tj-case-study-media:asset-kept',title:'Edited'},
    {id:'replaced',url:'tj-case-study-media:asset-new'},
  ];
  const workspace = {evidence, studies:[{id:'study-a',title:'New title'}]};
  const synchronizedEvidence = [
    {id:'kept',url:evidence[0].url,title:'Old title',cloudRef:'tj-case-study-storage:owner-a/asset-kept'},
    {id:'replaced',url:'tj-case-study-media:asset-old',cloudRef:'tj-case-study-storage:owner-a/asset-old'},
    {id:'removed',url:'tj-case-study-media:asset-removed',cloudRef:'tj-case-study-storage:owner-a/asset-removed'},
  ];
  const updated = applyVerifiedCaseStudyImageReferences(workspace, synchronizedEvidence);
  assert.equal(updated.studies, workspace.studies);
  assert.deepEqual(updated.evidence, [{...evidence[0],cloudRef:synchronizedEvidence[0].cloudRef,localOnly:false}, evidence[1]]);
  assert.equal(applyVerifiedCaseStudyImageReferences(updated, synchronizedEvidence), updated);
  const laterEdit = {...workspace, evidence:[{...evidence[0],title:'Next title'}, evidence[1]]};
  assert.deepEqual(applyVerifiedCaseStudyImageReferences(laterEdit, updated.evidence).evidence[0], {
    ...laterEdit.evidence[0], cloudRef:synchronizedEvidence[0].cloudRef, localOnly:false,
  });
});

test('Case Study synchronization leaves other features’ queued images alone', async () => {
  const storage = createSharedImageStorage({persistence:memoryPersistence()});
  const foreign = await storage.saveImage({userId:'owner-a',membership:owner,file:png(),sourceModule:'strategy-testing'});
  const integration = createCaseStudySharedImageIntegration({
    storage,
    uploader:async () => assert.fail('The Case Study uploader took another feature’s image'),
  });
  const result = await integration.synchronizeWorkspace({
    userId:'owner-a',membership:owner,workspace:{evidence:[{id:'evidence-a',url:`tj-case-study-media:${foreign.id}`}]},
  });
  assert.equal(result.processed, 0);
  assert.equal(result.failed, 0);
  assert.equal(await storage.getStorageStatus(foreign.id,'owner-a'),IMAGE_STORAGE_STATES.PENDING_UPLOAD);
});

test('new image approval promotes referenced local-only document images without changing membership or unreferenced originals',async()=>{
 const storage=createSharedImageStorage({persistence:memoryPersistence()});let uploads=0;
 const integration=createCaseStudySharedImageIntegration({storage,uploader:async({userId,evidenceId,blob})=>{uploads++;return {verified:true,cloudRef:caseStudyEvidenceCloudReference(`${userId}/${evidenceId}`),checksum:await calculateImageChecksum(blob)};}});
 const selected=await integration.saveDocumentImage({userId:'free-a',membership:free,file:png(),sourceRecordId:'current'});
 const other=await integration.saveDocumentImage({userId:'free-a',membership:free,file:png(),sourceRecordId:'unreferenced'});
 const workspace={evidence:[],studies:[{id:'s',doc:{type:'image',attrs:{src:selected.reference,localOnly:true}}}]};
 const approved={...free,imageAccessStatus:'ready',imageUploadsAllowed:true};
 const result=await integration.synchronizeWorkspace({userId:'free-a',membership:free,getMembership:async()=>approved,workspace});
 assert.equal(uploads,1);assert.equal(result.workspace.studies[0].doc.attrs.localOnly,false);assert.ok(result.workspace.studies[0].doc.attrs.cloudRef);
 assert.equal(await storage.getStorageStatus(other.asset.id,'free-a'),IMAGE_STORAGE_STATES.LOCAL_ONLY);
 assert.equal(approved.membership,MEMBERSHIP.FREE);assert.equal((await storage.getImage(selected.asset.id,'free-a')).size,png().size);
});

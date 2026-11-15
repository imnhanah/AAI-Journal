import test from 'node:test';
import assert from 'node:assert/strict';
import { MEMBERSHIP } from './membership.js';
import { IMAGE_STORAGE_STATES, MAX_NEW_IMAGE_BYTES, calculateImageChecksum, createSharedImageStorage, detectImageMimeType, isHistoricalImageReference, validateNewImage } from './sharedImageStorage.js';

const png = () => new Blob([new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])], { type: 'image/png' });
const jpeg = () => new Blob([new Uint8Array([0xff,0xd8,0xff,0xe0])], { type: 'image/jpeg' });
const webp = () => new Blob([new Uint8Array([0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50])], { type: 'image/webp' });
const owner = { status: 'ready', membership: MEMBERSHIP.OWNER };
const free = { status: 'ready', membership: MEMBERSHIP.FREE };
const unresolved = { status: 'error', membership: MEMBERSHIP.FREE };

function memoryPersistence() {
  const assets = new Map(); const binaries = new Map(); const queue = new Map(); const leases = new Map();
  return {
    async save(asset, blob, item) { assets.set(asset.id, structuredClone(asset)); binaries.set(asset.id, { id: asset.id, ownerUserId: asset.ownerUserId, blob }); if (item) queue.set(item.id, structuredClone(item)); },
    async getAsset(id) { return assets.get(id) ? structuredClone(assets.get(id)) : null; },
    async getBinary(id) { return binaries.get(id) || null; },
    async putAsset(asset) { assets.set(asset.id, structuredClone(asset)); },
    async putQueue(item) { queue.set(item.id, structuredClone(item)); },
    async getQueue(id) { return queue.get(id) ? structuredClone(queue.get(id)) : null; },
    async listQueue(userId) { return [...queue.values()].filter(item => item.ownerUserId === userId).map(item => structuredClone(item)); },
    async listAssets(userId, sourceRecordId) { return [...assets.values()].filter(item => item.ownerUserId === userId && (!sourceRecordId || item.sourceRecordId === sourceRecordId)).map(item => structuredClone(item)); },
    async updateAssetQueue(asset, item, remove = false) { if (asset) assets.set(asset.id, structuredClone(asset)); if (remove) queue.delete(item?.id || `upload:${asset?.id}`); else if (item) queue.set(item.id, structuredClone(item)); },
    async acquireLease({assetId,userId,holderId,expiresAt,timestamp}) { const key=`upload-lock:${assetId}`; const current=leases.get(key); if (current && current.ownerUserId===userId && Date.parse(current.expiresAt)>timestamp) return false; leases.set(key,{id:key,assetId,ownerUserId:userId,holderId,expiresAt}); return true; },
    async releaseLease({assetId,userId,holderId}) { const key=`upload-lock:${assetId}`; const current=leases.get(key); if(current?.ownerUserId===userId&&current.holderId===holderId) leases.delete(key); },
    async clearLease({assetId,userId}) { const key=`upload-lock:${assetId}`; if(leases.get(key)?.ownerUserId===userId) leases.delete(key); },
  };
}

const verifiedUpload = async ({asset,userId}) => ({verified:true,cloudPath:`${userId}/${asset.id}`,checksum:asset.checksum});

test('new uploads validate actual PNG, JPEG, and WebP bytes at the shared boundary', async () => {
  assert.equal(await detectImageMimeType(png()), 'image/png');
  assert.equal((await validateNewImage(png())).error, undefined);
  assert.equal((await validateNewImage(jpeg())).mimeType, 'image/jpeg');
  assert.equal((await validateNewImage(webp())).mimeType, 'image/webp');
  assert.match((await validateNewImage(new Blob(['not an image'], { type: 'image/png' }))).error, /PNG, JPEG, or WebP/);
  const oversized = new Blob([new Uint8Array(MAX_NEW_IMAGE_BYTES + 1)], { type: 'image/png' });
  assert.match((await validateNewImage(oversized)).error, /5 MB/);
});

test('both Owner identities receive a pending local asset and a durable upload operation', async () => {
  const storage = createSharedImageStorage({ persistence: memoryPersistence() });
  for (const userId of ['owner-one', 'owner-two']) {
    const asset = await storage.saveImage({ userId, membership: owner, file: png(), sourceModule: 'case-studies', sourceRecordId: 'study-a' });
    assert.equal(asset.ownerUserId, userId); assert.equal(asset.storageState, IMAGE_STORAGE_STATES.PENDING_UPLOAD);
    assert.equal((await storage.processUploadQueue({ userId, membership: owner, uploader: verifiedUpload })).processed, 1);
    assert.equal(await storage.getStorageStatus(asset.id, userId), IMAGE_STORAGE_STATES.CLOUD_VERIFIED);
  }
});

test('Free and unresolved membership images remain local-only and never enter an upload queue', async () => {
  const persistence = memoryPersistence(); const storage = createSharedImageStorage({ persistence });
  for (const membership of [free, unresolved]) {
    const asset = await storage.saveImage({ userId: 'free-user', membership, file: png(), sourceModule: 'trade-review' });
    assert.equal(asset.storageState, IMAGE_STORAGE_STATES.LOCAL_ONLY);
  }
  const result = await storage.processUploadQueue({ userId: 'free-user', membership: free, uploader: async () => { throw new Error('must not run'); } });
  assert.deepEqual(result, { processed: 0, failed: 0, recovered: 0 });
  assert.equal((await persistence.listQueue('free-user')).length, 0);
});

test('assets survive service recreation, remain isolated by authenticated UUID, and are not lost after sign-out', async () => {
  const persistence = memoryPersistence();
  const first = createSharedImageStorage({ persistence });
  const asset = await first.saveImage({ userId: 'user-a', membership: free, file: png(), sourceModule: 'trade-journal', sourceRecordId: 'trade-a' });
  const afterReload = createSharedImageStorage({ persistence });
  assert.equal((await afterReload.getImage(asset.id, 'user-a')).size, png().size);
  assert.equal(await afterReload.getImage(asset.id, 'user-b'), null);
  assert.equal(await afterReload.getImageMetadata(asset.id, 'user-b'), null);
  assert.equal((await afterReload.getImagesForRecord('user-a', 'trade-a')).length, 1);
});

test('failed Owner uploads preserve the binary, are retryable, and cannot be processed by another account', async () => {
  const persistence = memoryPersistence(); const storage = createSharedImageStorage({ persistence });
  const asset = await storage.saveImage({ userId: 'owner-a', membership: owner, file: png(), sourceModule: 'case-studies' });
  assert.deepEqual(await storage.processUploadQueue({ userId: 'owner-b', membership: owner, uploader: verifiedUpload }), { processed: 0, failed: 0, recovered: 0 });
  assert.equal((await storage.processUploadQueue({ userId: 'owner-a', membership: owner, uploader: async () => ({ error: 'offline' }) })).failed, 1);
  assert.equal(await storage.getStorageStatus(asset.id, 'owner-a'), IMAGE_STORAGE_STATES.SYNC_FAILED);
  assert.equal((await storage.getImage(asset.id, 'owner-a')).size, png().size);
  assert.equal(await storage.retryFailedUpload(asset.id, { userId: 'owner-a', membership: owner }), true);
  assert.equal((await storage.processUploadQueue({ userId: 'owner-a', membership: owner, uploader: verifiedUpload })).processed, 1);
});

test('soft deletion cancels a pending upload and restoring recreates the queue only for an Owner', async () => {
  const persistence=memoryPersistence(); const storage=createSharedImageStorage({persistence});
  const asset=await storage.saveImage({userId:'owner-a',membership:owner,file:png(),sourceModule:'case-studies'});
  assert.equal(await storage.deleteImage(asset.id,'owner-a'),true);
  assert.equal((await persistence.listQueue('owner-a')).length,0);
  assert.deepEqual(await storage.processUploadQueue({userId:'owner-a',membership:owner,uploader:verifiedUpload}),{processed:0,failed:0,recovered:0});
  assert.equal(await storage.restoreImage(asset.id,{userId:'owner-a',membership:free}),true);
  assert.equal(await storage.getStorageStatus(asset.id,'owner-a'),IMAGE_STORAGE_STATES.LOCAL_ONLY);
  assert.equal(await storage.retryFailedUpload(asset.id,{userId:'owner-a',membership:owner}),true);
  assert.equal((await storage.processUploadQueue({userId:'owner-a',membership:owner,uploader:verifiedUpload})).processed,1);
});

test('stale syncing records recover without losing their local binary and retry safely', async () => {
  const persistence=memoryPersistence(); const storage=createSharedImageStorage({persistence});
  const asset=await storage.saveImage({userId:'owner-a',membership:owner,file:png(),sourceModule:'case-studies'});
  const entry=await persistence.getQueue(`upload:${asset.id}`); const old='2000-01-01T00:00:00.000Z';
  await persistence.putAsset({...asset,storageState:IMAGE_STORAGE_STATES.SYNCING,updatedAt:old}); await persistence.putQueue({...entry,status:IMAGE_STORAGE_STATES.SYNCING,updatedAt:old});
  assert.equal((await storage.recoverInterruptedUploads({userId:'owner-a',membership:owner,staleAfterMs:1})).recovered,1);
  assert.equal(await storage.getStorageStatus(asset.id,'owner-a'),IMAGE_STORAGE_STATES.SYNC_FAILED);
  assert.equal((await storage.getImage(asset.id,'owner-a')).size,png().size);
  assert.equal((await storage.processUploadQueue({userId:'owner-a',membership:owner,uploader:verifiedUpload})).processed,1);
});

test('a feature-scoped queue does not recover or process another feature’s pending asset', async () => {
  const persistence=memoryPersistence(); const storage=createSharedImageStorage({persistence});
  const caseStudy=await storage.saveImage({userId:'owner-a',membership:owner,file:png(),sourceModule:'case-studies'});
  const strategy=await storage.saveImage({userId:'owner-a',membership:owner,file:png(),sourceModule:'strategy-testing'});
  const caseEntry=await persistence.getQueue(`upload:${caseStudy.id}`); const old='2000-01-01T00:00:00.000Z';
  await persistence.putAsset({...caseStudy,storageState:IMAGE_STORAGE_STATES.SYNCING,updatedAt:old});
  await persistence.putQueue({...caseEntry,status:IMAGE_STORAGE_STATES.SYNCING,updatedAt:old});
  const result=await storage.processUploadQueue({userId:'owner-a',membership:owner,sourceModule:'strategy-testing',uploader:verifiedUpload});
  assert.equal(result.recovered,0);
  assert.equal(result.processed,1);
  assert.equal(await storage.getStorageStatus(caseStudy.id,'owner-a'),IMAGE_STORAGE_STATES.SYNCING);
  assert.equal(await storage.getStorageStatus(strategy.id,'owner-a'),IMAGE_STORAGE_STATES.CLOUD_VERIFIED);
});

test('two tabs share a durable lease, so one upload request wins and the other skips it', async () => {
  const persistence=memoryPersistence(); const first=createSharedImageStorage({persistence,instanceId:'tab-a'}); const second=createSharedImageStorage({persistence,instanceId:'tab-b'});
  const asset=await first.saveImage({userId:'owner-a',membership:owner,file:png(),sourceModule:'case-studies'}); let calls=0;
  const uploader=async input=>{calls+=1; await new Promise(resolve=>setTimeout(resolve,20)); return verifiedUpload(input);};
  const [a,b]=await Promise.all([first.processUploadQueue({userId:'owner-a',membership:owner,uploader}),second.processUploadQueue({userId:'owner-a',membership:owner,uploader})]);
  assert.equal(calls,1); assert.equal(a.processed+b.processed,1); assert.equal(await first.getStorageStatus(asset.id,'owner-a'),IMAGE_STORAGE_STATES.CLOUD_VERIFIED);
});

test('a second tab with a stale pending snapshot skips the already verified upload after getting the lease', async () => {
  const persistence = memoryPersistence();
  let captured, resume;
  const snapshotReady = new Promise(resolve => { captured = resolve; });
  const continueSecondTab = new Promise(resolve => { resume = resolve; });
  let reads = 0;
  const secondPersistence = {...persistence, async listQueue(userId) {
    const snapshot = await persistence.listQueue(userId);
    if (++reads === 2) { captured(); await continueSecondTab; }
    return snapshot;
  }};
  const first = createSharedImageStorage({persistence,instanceId:'first'});
  const second = createSharedImageStorage({persistence:secondPersistence,instanceId:'second'});
  const asset = await first.saveImage({userId:'owner-a',membership:owner,file:png()});
  let uploads = 0;
  const options = {userId:'owner-a',membership:owner,uploader: async input => {
    uploads += 1;
    return verifiedUpload(input);
  }};
  const pending = second.processUploadQueue(options);
  await snapshotReady;
  assert.equal((await first.processUploadQueue(options)).processed, 1);
  resume();
  assert.equal((await pending).processed, 0);
  assert.equal(uploads, 1);
  assert.equal((await persistence.getQueue('upload:' + asset.id)).attempts, 1);
});

test('membership is rechecked before uploading, so a downgraded account keeps its binary local-only', async () => {
  const persistence=memoryPersistence(); const storage=createSharedImageStorage({persistence}); const asset=await storage.saveImage({userId:'owner-a',membership:owner,file:png(),sourceModule:'case-studies'});
  const result=await storage.processUploadQueue({userId:'owner-a',membership:owner,getMembership:async()=>free,uploader:async()=>{throw new Error('must not upload');}});
  assert.equal(result.processed,0); assert.equal(await storage.getStorageStatus(asset.id,'owner-a'),IMAGE_STORAGE_STATES.LOCAL_ONLY); assert.equal((await persistence.listQueue('owner-a')).length,0);
});

test('a mismatched cloud checksum fails closed and preserves retryable local bytes', async () => {
  const persistence=memoryPersistence(); const storage=createSharedImageStorage({persistence}); const asset=await storage.saveImage({userId:'owner-a',membership:owner,file:png(),sourceModule:'case-studies'});
  const result=await storage.processUploadQueue({userId:'owner-a',membership:owner,uploader:async()=>({verified:true,cloudPath:'owner-a/wrong',checksum:'not-the-local-checksum'})});
  assert.equal(result.failed,1); assert.equal(await storage.getStorageStatus(asset.id,'owner-a'),IMAGE_STORAGE_STATES.SYNC_FAILED); assert.equal((await storage.getImage(asset.id,'owner-a')).size,png().size);
  assert.equal(typeof await calculateImageChecksum(png()),'string');
});

test('historical references are compatibility inputs, including legacy images over the new upload limit', () => {
  assert.equal(isHistoricalImageReference('data:image/png;base64,legacy'), true);
  assert.equal(isHistoricalImageReference('tj-image:{"user":"a"}'), true);
  assert.equal(isHistoricalImageReference('tj-shared-media:asset-a'), true);
  assert.equal(isHistoricalImageReference('tj-case-study-storage:user-a/evidence-a'), true);
  assert.equal(isHistoricalImageReference('plain-text'), false);
});

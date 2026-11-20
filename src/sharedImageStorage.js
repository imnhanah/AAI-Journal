import { IMAGE_MAX_BYTES, IMAGE_LIMIT_MESSAGE } from './imagePolicy.js';

export const IMAGE_ASSET_DATABASE = 'tj-image-assets';
// Version 2 only adds the lease store. Existing records are untouched.
export const IMAGE_ASSET_VERSION = 2;
export const IMAGE_ASSET_STORES = Object.freeze({ ASSETS: 'assets', BINARIES: 'binaries', QUEUE: 'queue', LEASES: 'leases' });
export const MAX_NEW_IMAGE_BYTES = IMAGE_MAX_BYTES;
export const ACCEPTED_IMAGE_TYPES = Object.freeze(['image/png', 'image/jpeg', 'image/webp']);
export const IMAGE_STORAGE_STATES = Object.freeze({ LOCAL_ONLY: 'local-only', PENDING_UPLOAD: 'pending-upload', SYNCING: 'syncing', CLOUD_VERIFIED: 'cloud-verified', SYNC_FAILED: 'sync-failed', SOFT_DELETED: 'soft-deleted', PURGED: 'purged' });

const now = () => new Date().toISOString();
const assetId = () => globalThis.crypto?.randomUUID?.() || `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const tabId = () => globalThis.crypto?.randomUUID?.() || `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const requestValue = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error || new Error('Image storage request failed.')); });
const transactionDone = transaction => new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = event => reject(transaction.error || event.target?.error || new Error('Image storage transaction failed.')); transaction.onabort = () => reject(transaction.error || new Error('Image storage transaction was aborted.')); });
const leaseId = id => `upload-lock:${id}`;
const parseTime = value => Date.parse(value || '') || 0;
const bytes = async value => new Uint8Array(await value.slice(0, 16).arrayBuffer());

export async function detectImageMimeType(file) {
  if (!file?.slice) return '';
  const first = await bytes(file);
  if (first[0] === 0x89 && first[1] === 0x50 && first[2] === 0x4e && first[3] === 0x47) return 'image/png';
  if (first[0] === 0xff && first[1] === 0xd8 && first[2] === 0xff) return 'image/jpeg';
  if (String.fromCharCode(...first.slice(0, 4)) === 'RIFF' && String.fromCharCode(...first.slice(8, 12)) === 'WEBP') return 'image/webp';
  return '';
}

export async function validateNewImage(file) {
  if (!file?.size) return { error: 'Choose an image first.' };
  if (file.size > MAX_NEW_IMAGE_BYTES) return { error: IMAGE_LIMIT_MESSAGE };
  const detectedType = await detectImageMimeType(file);
  if (!ACCEPTED_IMAGE_TYPES.includes(detectedType)) return { error: 'Use a PNG, JPEG, or WebP image.' };
  if (file.type && file.type !== detectedType) return { error: 'The image file type does not match its contents.' };
  return { mimeType: detectedType };
}

export async function calculateImageChecksum(blob) {
  const data = await blob.arrayBuffer();
  if (globalThis.crypto?.subtle) {
    const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  // A deterministic fallback is only an in-browser dedupe hint; an uploader
  // must still return a matching post-upload verification checksum.
  let hash = 2166136261;
  for (const byte of new Uint8Array(data)) hash = Math.imul(hash ^ byte, 16777619);
  return `fallback-${(hash >>> 0).toString(16)}`;
}

// The deployed independent image grant remains authoritative; Office can only pause it.
export const setImageUploadsPaused = paused => { globalThis.__tjImageUploadsPaused = paused === true; };
export const canQueueCloudUpload = membership => globalThis.__tjImageUploadsPaused !== true && membership?.imageAccessStatus === 'ready' && membership.imageUploadsAllowed === true && membership.imageUploadAllowed !== false;
const isUploadPending = state => state === IMAGE_STORAGE_STATES.PENDING_UPLOAD || state === IMAGE_STORAGE_STATES.SYNC_FAILED;
export const isHistoricalImageReference = value => typeof value === 'string' && (value.startsWith('data:image/') || value.startsWith('tj-image:') || value.startsWith('tj-case-study-media:') || value.startsWith('tj-shared-media:') || value.startsWith('tj-trade-media:') || value.startsWith('tj-case-study-evidence:') || value.startsWith('tj-case-study-image:') || value.startsWith('tj-case-study-storage:') || /^https?:\/\//.test(value));

export function createIndexedDbImagePersistence({ indexedDb = globalThis.indexedDB } = {}) {
  const open = () => new Promise((resolve, reject) => {
    if (!indexedDb) return reject(new Error('Image storage is unavailable in this browser.'));
    const request = indexedDb.open(IMAGE_ASSET_DATABASE, IMAGE_ASSET_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_ASSET_STORES.ASSETS)) { const store = db.createObjectStore(IMAGE_ASSET_STORES.ASSETS, { keyPath: 'id' }); store.createIndex('ownerUserId', 'ownerUserId'); store.createIndex('ownerRecord', ['ownerUserId', 'sourceRecordId']); }
      if (!db.objectStoreNames.contains(IMAGE_ASSET_STORES.BINARIES)) db.createObjectStore(IMAGE_ASSET_STORES.BINARIES, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(IMAGE_ASSET_STORES.QUEUE)) { const store = db.createObjectStore(IMAGE_ASSET_STORES.QUEUE, { keyPath: 'id' }); store.createIndex('ownerUserId', 'ownerUserId'); store.createIndex('assetId', 'assetId'); }
      if (!db.objectStoreNames.contains(IMAGE_ASSET_STORES.LEASES)) db.createObjectStore(IMAGE_ASSET_STORES.LEASES, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error || new Error('Image storage request failed.'));
  });
  const withStore = async (stores, mode, action) => { const db = await open(); try { const tx = db.transaction(stores, mode); const result = await action(tx); await transactionDone(tx); return result; } finally { db.close(); } };
  const updateAssetQueue = (asset, queue, removeQueue = false) => withStore([IMAGE_ASSET_STORES.ASSETS, IMAGE_ASSET_STORES.QUEUE], 'readwrite', tx => { if (asset) tx.objectStore(IMAGE_ASSET_STORES.ASSETS).put(asset); if (removeQueue) tx.objectStore(IMAGE_ASSET_STORES.QUEUE).delete(queue?.id || `upload:${asset?.id}`); else if (queue) tx.objectStore(IMAGE_ASSET_STORES.QUEUE).put(queue); });
  return {
    async save(asset, blob, queue) {
      // WebKit can fail to serialize a Blob into IndexedDB. Store its bytes
      // directly, and keep the reader compatible with previously saved blobs.
      const bytes = await blob.arrayBuffer();
      return withStore([IMAGE_ASSET_STORES.ASSETS, IMAGE_ASSET_STORES.BINARIES, IMAGE_ASSET_STORES.QUEUE], 'readwrite', tx => {
        tx.objectStore(IMAGE_ASSET_STORES.ASSETS).put(asset);
        tx.objectStore(IMAGE_ASSET_STORES.BINARIES).put({ id: asset.id, ownerUserId: asset.ownerUserId, bytes, type: asset.mimeType });
        if (queue) tx.objectStore(IMAGE_ASSET_STORES.QUEUE).put(queue);
      });
    },
    async getAsset(id) { return withStore([IMAGE_ASSET_STORES.ASSETS], 'readonly', tx => requestValue(tx.objectStore(IMAGE_ASSET_STORES.ASSETS).get(id))); },
    async getBinary(id) {
      const binary = await withStore([IMAGE_ASSET_STORES.BINARIES], 'readonly', tx => requestValue(tx.objectStore(IMAGE_ASSET_STORES.BINARIES).get(id)));
      if (!binary || binary.blob || !binary.bytes) return binary;
      return { id:binary.id, ownerUserId:binary.ownerUserId, blob:new Blob([binary.bytes], {type:binary.type}) };
    },
    async putAsset(asset) { return withStore([IMAGE_ASSET_STORES.ASSETS], 'readwrite', tx => { tx.objectStore(IMAGE_ASSET_STORES.ASSETS).put(asset); }); },
    async putQueue(item) { return withStore([IMAGE_ASSET_STORES.QUEUE], 'readwrite', tx => { tx.objectStore(IMAGE_ASSET_STORES.QUEUE).put(item); }); },
    async getQueue(id) { return withStore([IMAGE_ASSET_STORES.QUEUE], 'readonly', tx => requestValue(tx.objectStore(IMAGE_ASSET_STORES.QUEUE).get(id))); },
    async listQueue(ownerUserId) { return withStore([IMAGE_ASSET_STORES.QUEUE], 'readonly', tx => requestValue(tx.objectStore(IMAGE_ASSET_STORES.QUEUE).index('ownerUserId').getAll(ownerUserId))); },
    async listAssets(ownerUserId, sourceRecordId) { return withStore([IMAGE_ASSET_STORES.ASSETS], 'readonly', tx => { const store = tx.objectStore(IMAGE_ASSET_STORES.ASSETS); return sourceRecordId ? requestValue(store.index('ownerRecord').getAll([ownerUserId, sourceRecordId])) : requestValue(store.index('ownerUserId').getAll(ownerUserId)); }); },
    updateAssetQueue,
    async acquireLease({ assetId: id, userId, holderId, expiresAt, timestamp }) { return withStore([IMAGE_ASSET_STORES.LEASES], 'readwrite', async tx => { const store = tx.objectStore(IMAGE_ASSET_STORES.LEASES); const current = await requestValue(store.get(leaseId(id))); if (current && current.ownerUserId === userId && parseTime(current.expiresAt) > timestamp) return false; store.put({ id: leaseId(id), assetId: id, ownerUserId: userId, holderId, expiresAt, updatedAt: new Date(timestamp).toISOString() }); return true; }); },
    async releaseLease({ assetId: id, userId, holderId }) { return withStore([IMAGE_ASSET_STORES.LEASES], 'readwrite', async tx => { const store = tx.objectStore(IMAGE_ASSET_STORES.LEASES); const current = await requestValue(store.get(leaseId(id))); if (current?.ownerUserId === userId && current.holderId === holderId) store.delete(leaseId(id)); }); },
    async clearLease({ assetId: id, userId }) { return withStore([IMAGE_ASSET_STORES.LEASES], 'readwrite', async tx => { const store = tx.objectStore(IMAGE_ASSET_STORES.LEASES); const current = await requestValue(store.get(leaseId(id))); if (current?.ownerUserId === userId) store.delete(leaseId(id)); }); },
  };
}

export function createSharedImageStorage({ persistence = createIndexedDbImagePersistence(), clock = now, instanceId = tabId(), leaseMs = 90_000 } = {}) {
  const owned = (item, userId) => item && item.ownerUserId === userId;
  const assetFor = async (id, userId) => { const asset = await persistence.getAsset(id); return owned(asset, userId) ? asset : null; };
  const queueFor = (asset, at, status = IMAGE_STORAGE_STATES.PENDING_UPLOAD, prior = {}) => ({ id: `upload:${asset.id}`, assetId: asset.id, ownerUserId: asset.ownerUserId, status, attempts: prior.attempts || 0, lastError: prior.lastError || '', createdAt: prior.createdAt || at, updatedAt: at });
  const recover = async ({ userId, membership, staleAfterMs = leaseMs, sourceModule = '' } = {}) => {
    if (!canQueueCloudUpload(membership)) return { recovered: 0 };
    let recovered = 0;
    for (const entry of await persistence.listQueue(userId)) {
      if (entry.status !== IMAGE_STORAGE_STATES.SYNCING || Date.now() - parseTime(entry.updatedAt) < staleAfterMs) continue;
      const { assetId } = entry;
      const acquired = await persistence.acquireLease?.({ assetId, userId, holderId: instanceId, timestamp: Date.now(), expiresAt: new Date(Date.now() + leaseMs).toISOString() });
      if (acquired === false) continue;
      try {
        const current = await persistence.getQueue(entry.id);
        if (!owned(current, userId) || current.status !== IMAGE_STORAGE_STATES.SYNCING
          || Date.now() - parseTime(current.updatedAt) < staleAfterMs) continue;
        const asset = await assetFor(assetId, userId);
        if (sourceModule && asset?.sourceModule !== sourceModule) continue;
        if (!asset || asset.storageState === IMAGE_STORAGE_STATES.SOFT_DELETED) {
          await persistence.updateAssetQueue(asset, current, true);
          continue;
        }
        if (asset.cloudPath || asset.storageState !== IMAGE_STORAGE_STATES.SYNCING) continue;
        const at = clock();
        const failed = { ...asset, storageState: IMAGE_STORAGE_STATES.SYNC_FAILED, updatedAt: at };
        await persistence.updateAssetQueue(failed, queueFor(failed, at, IMAGE_STORAGE_STATES.SYNC_FAILED, {
          ...current, lastError: 'Upload was interrupted and can be retried.',
        }));
        recovered += 1;
      } finally {
        await persistence.releaseLease?.({ assetId, userId, holderId: instanceId });
      }
    }
    return { recovered };
  };
  return {
    async saveImage({ userId, membership, file, sourceModule, sourceRecordId = '', fileName = file?.name || 'image' } = {}) { if (!userId) throw new Error('Sign in before saving an image.'); const validation = await validateNewImage(file); if (validation.error) throw new Error(validation.error); const at = clock(); const id = assetId(); const checksum = await calculateImageChecksum(file); const queueable = canQueueCloudUpload(membership); const asset = { id, ownerUserId: userId, sourceModule: sourceModule || 'unknown', sourceRecordId, mimeType: validation.mimeType, fileName, byteSize: file.size, checksum, width: null, height: null, createdAt: at, updatedAt: at, storageState: queueable ? IMAGE_STORAGE_STATES.PENDING_UPLOAD : IMAGE_STORAGE_STATES.LOCAL_ONLY, cloudPath: '', localStorageKey: id, revision: 1, deletedAt: null, purgeAfter: null, resumeStorageState: null }; await persistence.save(asset, file, queueable ? queueFor(asset, at) : null); return asset; },
    async getImageMetadata(id, userId) { return assetFor(id, userId); },
    async getImage(id, userId) { const asset = await assetFor(id, userId); if (!asset || asset.storageState === IMAGE_STORAGE_STATES.SOFT_DELETED) return null; const binary = await persistence.getBinary(id); return owned(binary, userId) ? binary.blob : null; },
    async getImagesForRecord(userId, sourceRecordId) { return (await persistence.listAssets(userId, sourceRecordId)).filter(asset => asset.storageState !== IMAGE_STORAGE_STATES.PURGED); },
    async getStorageUsage(userId) { const assets = await persistence.listAssets(userId); return { count: assets.length, bytes: assets.filter(asset => asset.storageState !== IMAGE_STORAGE_STATES.PURGED).reduce((total, asset) => total + (asset.byteSize || 0), 0) }; },
    async getStorageStatus(id, userId) { return (await assetFor(id, userId))?.storageState || null; },
    async getLocalImageUrl(id, userId) { const blob = await this.getImage(id, userId); return blob ? URL.createObjectURL(blob) : ''; },
    async recoverInterruptedUploads(options) { return recover(options); },
    async deleteImage(id, userId) { const asset = await assetFor(id, userId); if (!asset) return false; const at = clock(); await persistence.updateAssetQueue({ ...asset, resumeStorageState: asset.storageState, storageState: IMAGE_STORAGE_STATES.SOFT_DELETED, deletedAt: at, updatedAt: at }, { id: `upload:${id}` }, true); await persistence.clearLease?.({ assetId: id, userId }); return true; },
    async restoreImage(id, { userId, membership } = {}) { const asset = await assetFor(id, userId); if (!asset || asset.storageState !== IMAGE_STORAGE_STATES.SOFT_DELETED) return false; const at = clock(); const resumable = canQueueCloudUpload(membership) && [IMAGE_STORAGE_STATES.PENDING_UPLOAD, IMAGE_STORAGE_STATES.SYNC_FAILED, IMAGE_STORAGE_STATES.SYNCING].includes(asset.resumeStorageState); const state = resumable ? IMAGE_STORAGE_STATES.PENDING_UPLOAD : (asset.cloudPath ? IMAGE_STORAGE_STATES.CLOUD_VERIFIED : IMAGE_STORAGE_STATES.LOCAL_ONLY); const restored = { ...asset, storageState: state, deletedAt: null, resumeStorageState: null, updatedAt: at }; await persistence.updateAssetQueue(restored, resumable ? queueFor(restored, at) : { id: `upload:${id}` }, !resumable); return true; },
    async retryFailedUpload(id, { userId, membership } = {}) { const asset = await assetFor(id, userId); if (!asset || asset.cloudPath || [IMAGE_STORAGE_STATES.SYNCING, IMAGE_STORAGE_STATES.SOFT_DELETED, IMAGE_STORAGE_STATES.PURGED].includes(asset.storageState) || !canQueueCloudUpload(membership)) return false; const at = clock(); const updated = { ...asset, storageState: IMAGE_STORAGE_STATES.PENDING_UPLOAD, updatedAt: at }; await persistence.updateAssetQueue(updated, queueFor(updated, at)); return true; },
    async queueCloudUpload(id, options = {}) { return this.retryFailedUpload(id, options); },
    async processUploadQueue({ userId, membership, getMembership, uploader, sourceModule = '', assetIds } = {}) {
      const currentMembership = async () => getMembership ? getMembership() : membership;
      if (typeof uploader !== 'function') return { processed: 0, failed: 0, recovered: 0 };
      // Even after a membership downgrade, inspect the owner's queue once so
      // pre-existing pending work becomes local-only instead of lingering.
      const recovered = await recover({ userId, membership: await currentMembership(), sourceModule }); let processed = 0; let failed = 0;
      for (const entry of await persistence.listQueue(userId)) {
        if (assetIds && !assetIds.has(entry.assetId)) continue;
        if (!isUploadPending(entry.status)) continue;
        const asset = await assetFor(entry.assetId, userId);
        // A feature-specific synchronizer must never take responsibility for
        // another feature's durable metadata publication.
        if (sourceModule && asset?.sourceModule !== sourceModule) continue;
        if (!asset || asset.storageState === IMAGE_STORAGE_STATES.SOFT_DELETED) { await persistence.updateAssetQueue(asset, entry, true); continue; }
        const acquired = await persistence.acquireLease?.({ assetId: asset.id, userId, holderId: instanceId, timestamp: Date.now(), expiresAt: new Date(Date.now() + leaseMs).toISOString() }); if (acquired === false) continue;
        let syncingQueue;
        try {
          // A worker may acquire the lease after another tab finished using it.
          const fresh = await assetFor(entry.assetId, userId);
          const currentEntry = await persistence.getQueue(entry.id);
          if (!fresh || fresh.cloudPath || !isUploadPending(fresh.storageState)
            || !owned(currentEntry, userId) || !isUploadPending(currentEntry.status)) continue;
          const binary = await persistence.getBinary(entry.assetId);
          if (!owned(binary, userId)) { await persistence.updateAssetQueue(fresh, currentEntry, true); continue; }
          const access = await currentMembership();
          if(access?.imageAccessStatus==='unavailable')throw new Error('Image permission could not be confirmed. The original is retained; retry when online.');
          if (!canQueueCloudUpload(access)) {
            await persistence.updateAssetQueue({ ...fresh, storageState: IMAGE_STORAGE_STATES.LOCAL_ONLY, updatedAt: clock() }, currentEntry, true);
            continue;
          }
          const at = clock();
          const syncingAsset = { ...fresh, storageState: IMAGE_STORAGE_STATES.SYNCING, updatedAt: at };
          syncingQueue = queueFor(fresh, at, IMAGE_STORAGE_STATES.SYNCING, { ...currentEntry, attempts: currentEntry.attempts + 1 });
          await persistence.updateAssetQueue(syncingAsset, syncingQueue);
          const finalAccess = await currentMembership();
          if(finalAccess?.imageAccessStatus==='unavailable')throw new Error('Image permission could not be confirmed. The original is retained; retry when online.');
          if (!canQueueCloudUpload(finalAccess)) {
            await persistence.updateAssetQueue({ ...fresh, storageState: IMAGE_STORAGE_STATES.LOCAL_ONLY, updatedAt: clock() }, syncingQueue, true);
            continue;
          }
          const result = await uploader({ asset: syncingAsset, blob: binary.blob, userId });
          if (!result?.verified || !result.cloudPath || !result.checksum || result.checksum !== fresh.checksum) throw new Error(result?.error || 'Cloud image bytes could not be verified.');
          const done = clock(); const verified = { ...fresh, cloudPath: result.cloudPath, storageState: IMAGE_STORAGE_STATES.CLOUD_VERIFIED, updatedAt: done }; await persistence.updateAssetQueue(verified, queueFor(verified, done, IMAGE_STORAGE_STATES.CLOUD_VERIFIED, { ...syncingQueue, lastError: '' })); processed += 1;
        } catch (error) {
          const failedAsset = await assetFor(entry.assetId, userId);
          if (syncingQueue && failedAsset?.storageState === IMAGE_STORAGE_STATES.SYNCING && !failedAsset.cloudPath) {
            const at = clock();
            const updated = { ...failedAsset, storageState: IMAGE_STORAGE_STATES.SYNC_FAILED, updatedAt: at };
            const lastError = error?.message || 'Cloud image upload failed.';
            await persistence.updateAssetQueue(updated, queueFor(updated, at, IMAGE_STORAGE_STATES.SYNC_FAILED, { ...syncingQueue, lastError }));
          }
          failed += 1;
        }
        finally { await persistence.releaseLease?.({ assetId: entry.assetId, userId, holderId: instanceId }); }
      }
      return { processed, failed, recovered: recovered.recovered };
    },
  };
}

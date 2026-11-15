import test from 'node:test';
import assert from 'node:assert/strict';
import { MEMBERSHIP } from './membership.js';
import { calculateImageChecksum, createSharedImageStorage, IMAGE_STORAGE_STATES } from './sharedImageStorage.js';
import { TRADE_JOURNAL_MEDIA_PREFIX, createTradeJournalSharedMediaAdapter } from './tradeJournalSharedMedia.js';

const owner = { status: 'ready', membership: MEMBERSHIP.OWNER };
const free = { status: 'ready', membership: MEMBERSHIP.FREE };
const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';

function persistence() {
  const assets = new Map(), binaries = new Map(), queue = new Map();
  return {
    async save(asset, blob, item) { assets.set(asset.id, structuredClone(asset)); binaries.set(asset.id, { ownerUserId: asset.ownerUserId, blob }); if (item) queue.set(item.id, structuredClone(item)); },
    async getAsset(id) { return assets.get(id) && structuredClone(assets.get(id)); }, async getBinary(id) { return binaries.get(id) || null; }, async putAsset(asset) { assets.set(asset.id, structuredClone(asset)); }, async putQueue(item) { queue.set(item.id, structuredClone(item)); }, async getQueue(id) { return queue.get(id) && structuredClone(queue.get(id)); },
    async listQueue(userId) { return [...queue.values()].filter(item => item.ownerUserId === userId).map(item => structuredClone(item)); }, async listAssets(userId, record = '') { return [...assets.values()].filter(item => item.ownerUserId === userId && (!record || item.sourceRecordId === record)).map(item => structuredClone(item)); },
    async updateAssetQueue(asset, item, remove = false) { if (asset) assets.set(asset.id, structuredClone(asset)); if (remove) queue.delete(item?.id || `upload:${asset?.id}`); else if (item) queue.set(item.id, structuredClone(item)); },
    async acquireLease() { return true; }, async releaseLease() {}, async clearLease() {},
  };
}

function adapter({ persistenceStore = persistence(), resolveCloud } = {}) {
  const storage = createSharedImageStorage({ persistence: persistenceStore }); let uploads = 0;
  const upload = async ({ userId, evidenceId, blob }) => { uploads += 1; return { verified: true, cloudRef: `tj-case-study-storage:${userId}/${evidenceId}`, checksum: await calculateImageChecksum(blob) }; };
  return { storage, uploads: () => uploads, media: createTradeJournalSharedMediaAdapter({ storage, upload, resolveCloud: resolveCloud || (async ref => ({ url: `signed:${ref}` })) }) };
}

test('Owner trade entry, exit, and session-review images save locally, verify privately, and resolve after refresh', async () => {
  const persistenceStore = persistence();
  const { media, storage } = adapter({ persistenceStore });
  const prepared = await media.prepareScreenshots({ userId: 'owner-a', membership: owner, sourceRecordId: 'trades:trade-1', screenshots: { entry: [{ src: dataUrl, tag: 'Entry' }], exit: [{ src: dataUrl, tag: 'Exit' }] } });
  const review = await media.prepareScreenshots({ userId: 'owner-a', membership: owner, sourceRecordId: 'trade_reviews:review-1', screenshots: [{ src: dataUrl, label: 'Post-session review' }] });
  assert.match(prepared.entry[0].src, new RegExp(`^${TRADE_JOURNAL_MEDIA_PREFIX}`));
  assert.match(prepared.exit[0].src, new RegExp(`^${TRADE_JOURNAL_MEDIA_PREFIX}`));
  assert.match(review[0].src, new RegExp(`^${TRADE_JOURNAL_MEDIA_PREFIX}`));
  const syncedTrade = await media.synchronizeScreenshots({ userId: 'owner-a', membership: owner, screenshots: prepared });
  const syncedReview = await media.synchronizeScreenshots({ userId: 'owner-a', membership: owner, screenshots: review });
  assert.match(syncedTrade.entry[0].cloudRef, /^tj-case-study-storage:owner-a\//);
  assert.match(syncedReview[0].cloudRef, /^tj-case-study-storage:owner-a\//);
  const id = syncedTrade.entry[0].src.slice(TRADE_JOURNAL_MEDIA_PREFIX.length);
  assert.equal(await storage.getStorageStatus(id, 'owner-a'), IMAGE_STORAGE_STATES.CLOUD_VERIFIED);
  const persistedRecord = await media.serializeScreenshots(syncedTrade);
  const refreshedAdapter = adapter({ persistenceStore });
  const refreshed = await refreshedAdapter.media.resolveScreenshots({ userId: 'owner-a', screenshots: persistedRecord });
  assert.match(refreshed.entry[0].displaySrc, /^blob:/);
  assert.equal(refreshed.entry[0].tag, 'Entry');
  // A second signed-in device has no IndexedDB binary. It must use the
  // persisted, verified cloud reference rather than treating the image as lost.
  const secondDevice = adapter({ resolveCloud: async ref => ({ url: `signed-cross-device:${ref}` }) });
  const crossDevice = await secondDevice.media.resolveScreenshots({ userId: 'owner-a', screenshots: persistedRecord });
  assert.match(crossDevice.entry[0].displaySrc, /^signed-cross-device:tj-case-study-storage:owner-a\//);
  const withoutPublishedCloudRef = await secondDevice.media.resolveScreenshots({ userId: 'owner-a', screenshots: { entry: [{ src: persistedRecord.entry[0].src }] } });
  assert.match(withoutPublishedCloudRef.entry[0].displaySrc, /^signed-cross-device:tj-case-study-storage:owner-a\//);
});

test('Free trade screenshots stay local-only and keep their entry/exit ordering', async () => {
  const { media, uploads, storage } = adapter();
  const prepared = await media.prepareScreenshots({ userId: 'free-a', membership: free, sourceRecordId: 'trades:trade-1', screenshots: { entry: [{ src: dataUrl, label: 'first' }, { src: dataUrl, label: 'second' }], exit: [{ src: dataUrl, label: 'third' }] } });
  const synced = await media.synchronizeScreenshots({ userId: 'free-a', membership: free, screenshots: prepared });
  assert.deepEqual(synced.entry.map(item => item.label), ['first', 'second']);
  assert.deepEqual(synced.exit.map(item => item.label), ['third']);
  assert.equal(synced.entry[0].src, synced.entry[1].src);
  const id = synced.entry[0].src.slice(TRADE_JOURNAL_MEDIA_PREFIX.length);
  assert.equal(await storage.getStorageStatus(id, 'free-a'), IMAGE_STORAGE_STATES.LOCAL_ONLY);
  assert.equal(uploads(), 0);
});

test('Trade media isolates owners and only accepts private cloud paths for the current authenticated owner', async () => {
  const { media } = adapter();
  const prepared = await media.prepareScreenshots({ userId: 'owner-a', membership: owner, sourceRecordId: 'trades:trade-1', screenshots: { entry: [dataUrl] } });
  const synced = await media.synchronizeScreenshots({ userId: 'owner-a', membership: owner, screenshots: prepared });
  const denied = await media.resolveScreenshots({ userId: 'owner-b', screenshots: synced });
  assert.equal(denied.entry[0].displaySrc, undefined);
  assert.equal(denied.entry[0].displayError, 'missing-cloud-reference');
});

test('Interrupted Trade Journal uploads retain their reference and safely retry without duplicates', async () => {
  const state = adapter(); const prepared = await state.media.prepareScreenshots({ userId: 'owner-a', membership: owner, sourceRecordId: 'trades:trade-1', screenshots: { entry: [dataUrl] } });
  const source = prepared.entry[0].src; const id = source.slice(TRADE_JOURNAL_MEDIA_PREFIX.length); let first = true;
  const retrying = createTradeJournalSharedMediaAdapter({ storage: state.storage, upload: async ({ blob }) => first ? (first = false, { error: 'offline' }) : { verified: true, cloudRef: `tj-case-study-storage:owner-a/${id}`, checksum: await calculateImageChecksum(blob) } });
  const once = await retrying.synchronizeScreenshots({ userId: 'owner-a', membership: owner, screenshots: prepared });
  assert.equal(once.entry[0].cloudRef, '');
  const twice = await retrying.synchronizeScreenshots({ userId: 'owner-a', membership: owner, screenshots: once });
  assert.equal(twice.entry[0].src, source);
  assert.match(twice.entry[0].cloudRef, /owner-a\//);
});

test('legacy journal Data URLs, RPC references, revisioned media, Case Study media, and Strategy media remain unchanged', async () => {
  const { media } = adapter();
  const historical = { entry: ['data:image/png;base64,legacy', { src: 'https://legacy.example/rpc-image.png', revision: 4 }], exit: ['tj-image:{"legacy":true}'], reviews: [{ src: 'tj-shared-media:strategy-asset' }] };
  const prepared = await media.prepareScreenshots({ userId: 'owner-a', membership: owner, sourceRecordId: 'trades:trade-1', screenshots: historical, existingScreenshots: historical });
  assert.deepEqual(prepared, historical);
  assert.deepEqual(await media.serializeScreenshots(prepared), historical);
});

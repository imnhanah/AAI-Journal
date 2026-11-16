import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MEMBERSHIP } from './membership.js';
import { IMAGE_STORAGE_STATES, createSharedImageStorage } from './sharedImageStorage.js';
import { BACKTEST_SHARED_MEDIA_PREFIX, backtestMediaVersion, createBacktestSharedMediaAdapter, shouldLoadBacktestMedia } from './backtestSharedMedia.js';

const owner={status:'ready',membership:MEMBERSHIP.OWNER,imageAccessStatus:'ready',imageUploadsAllowed:true};
const free={status:'ready',membership:MEMBERSHIP.FREE};
const png=()=>new Blob([new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])],{type:'image/png'});
const dataUrl='data:image/png;base64,iVBORw0KGgo=';

function persistence(){const assets=new Map(),binaries=new Map(),queue=new Map();return {
 async save(asset,blob,item){assets.set(asset.id,structuredClone(asset));binaries.set(asset.id,{ownerUserId:asset.ownerUserId,blob});if(item)queue.set(item.id,structuredClone(item));},
 async getAsset(id){return assets.get(id)&&structuredClone(assets.get(id));},async getBinary(id){return binaries.get(id)||null;},async putAsset(asset){assets.set(asset.id,structuredClone(asset));},async putQueue(item){queue.set(item.id,structuredClone(item));},async getQueue(id){return queue.get(id)&&structuredClone(queue.get(id));},
 async listQueue(userId){return [...queue.values()].filter(item=>item.ownerUserId===userId).map(item=>structuredClone(item));},async listAssets(userId,record=''){return [...assets.values()].filter(item=>item.ownerUserId===userId&&(!record||item.sourceRecordId===record)).map(item=>structuredClone(item));},
 async updateAssetQueue(asset,item,remove=false){if(asset)assets.set(asset.id,structuredClone(asset));if(remove)queue.delete(item?.id||`upload:${asset?.id}`);else if(item)queue.set(item.id,structuredClone(item));},
 async acquireLease(){return true;},async releaseLease(){},async clearLease(){}
};}
function adapter(){const storage=createSharedImageStorage({persistence:persistence()});let uploads=0;const upload=async({userId,evidenceId,blob})=>{uploads++;return {verified:true,cloudRef:`tj-case-study-storage:${userId}/${evidenceId}`,checksum:await (await import('./sharedImageStorage.js')).calculateImageChecksum(blob)};};return {storage,uploads:()=>uploads,adapter:createBacktestSharedMediaAdapter({storage,upload,resolveCloud:async ref=>({url:`signed:${ref}`})})};}

test('Owner Strategy screenshots queue, verify, publish a private cloud reference, and resolve after refresh',async()=>{
 const {adapter:media,storage}=adapter();const prepared=await media.prepareScreenshots({userId:'owner-a',membership:owner,sourceRecordId:'trade-a',screenshots:{entry:[{src:dataUrl,caption:'entry'}]}});const item=prepared.entry[0];assert.match(item.src,new RegExp(`^${BACKTEST_SHARED_MEDIA_PREFIX}`));assert.equal(item.caption,'entry');
 const synced=await media.synchronizeScreenshots({userId:'owner-a',membership:owner,screenshots:prepared});assert.match(synced.entry[0].cloudRef,/^tj-case-study-storage:owner-a\//);const id=synced.entry[0].src.slice(BACKTEST_SHARED_MEDIA_PREFIX.length);assert.equal(await storage.getStorageStatus(id,'owner-a'),IMAGE_STORAGE_STATES.CLOUD_VERIFIED);
 const resolved=await media.resolveScreenshots({userId:'owner-a',screenshots:synced});assert.match(resolved.entry[0].displaySrc,/^blob:/);
});

test('a thin, persisted trade record reloads its versioned shared media after a browser refresh',async()=>{
 const {adapter:media}=adapter();
 const saved=await media.prepareScreenshots({userId:'owner-a',membership:owner,sourceRecordId:'trade-a',screenshots:{entry:[dataUrl]}});
 const synced=await media.synchronizeScreenshots({userId:'owner-a',membership:owner,screenshots:saved});
 const persisted=await media.serializeScreenshots(synced);
 // tj_sync_backtests returns this deliberately thin representation after reload.
 const rehydratedTrade={id:'trade-a',updatedAt:'2026-11-12T00:00:00.000Z',screenshotCount:1};
 assert.equal(shouldLoadBacktestMedia(rehydratedTrade),true);
 assert.equal(backtestMediaVersion(rehydratedTrade),'trade-a:2026-11-12T00:00:00.000Z:1');
 const reloaded=await media.resolveScreenshots({userId:'owner-a',screenshots:persisted});
 assert.match(reloaded.entry[0].displaySrc,/^blob:/);
 assert.match(reloaded.entry[0].src,new RegExp(`^${BACKTEST_SHARED_MEDIA_PREFIX}`));
 const savedAgain=await media.serializeScreenshots(reloaded);
 assert.equal(savedAgain.entry[0].displaySrc,undefined);
 assert.equal(savedAgain.entry[0].src,persisted.entry[0].src);
});

test('the Strategy Testing editor uses a resolved preview URL without replacing its persisted reference',()=>{
 const source=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
 assert.match(source,/function ImagePreview\(\{ src, media = null, displaySrc = ""/);
 assert.match(source,/displaySrc \? Promise\.resolve\(displaySrc\) : loadJournalImage\(media \|\| src\)/);
 assert.equal((source.match(/previewSource=\{backtest \? resolvedScreenshotSource : null\}/g)||[]).length,4);
});

test('media loading follows an updated version for the same trade ID',()=>{
 const before={id:'trade-a',updatedAt:'v1',screenshotCount:0};
 const after={id:'trade-a',updatedAt:'v2',screenshotCount:1};
 assert.notEqual(backtestMediaVersion(before),backtestMediaVersion(after));
 assert.equal(shouldLoadBacktestMedia(before),false);
 assert.equal(shouldLoadBacktestMedia(after),true);
});

test('Free Strategy screenshots stay local-only and are never uploaded',async()=>{
 const {adapter:media,uploads,storage}=adapter();const prepared=await media.prepareScreenshots({userId:'free-a',membership:free,sourceRecordId:'trade-a',screenshots:{entry:[dataUrl]}});const synced=await media.synchronizeScreenshots({userId:'free-a',membership:free,screenshots:prepared});const id=synced.entry[0].src.slice(BACKTEST_SHARED_MEDIA_PREFIX.length);assert.equal(await storage.getStorageStatus(id,'free-a'),IMAGE_STORAGE_STATES.LOCAL_ONLY);assert.equal(uploads(),0);
});

test('shared Strategy assets are isolated by owner and cloud fallback preserves a valid private reference',async()=>{
 const {adapter:media}=adapter();const prepared=await media.prepareScreenshots({userId:'owner-a',membership:owner,sourceRecordId:'trade-a',screenshots:{entry:[dataUrl]}});const synced=await media.synchronizeScreenshots({userId:'owner-a',membership:owner,screenshots:prepared});const denied=await media.resolveScreenshots({userId:'owner-b',screenshots:synced});assert.equal(denied.entry[0].displaySrc,undefined);assert.equal(denied.entry[0].displayError,'missing-cloud-reference');
 const remote=createBacktestSharedMediaAdapter({storage:createSharedImageStorage({persistence:persistence()}),resolveCloud:async ref=>({url:`signed:${ref}`})});const resolved=await remote.resolveScreenshots({userId:'owner-a',screenshots:synced});assert.match(resolved.entry[0].displaySrc,/^signed:tj-case-study-storage:owner-a\//);
 const withoutPublishedCloudRef=await remote.resolveScreenshots({userId:'owner-a',screenshots:{entry:[{src:synced.entry[0].src}]}});assert.match(withoutPublishedCloudRef.entry[0].displaySrc,/^signed:tj-case-study-storage:owner-a\//);
});

test('interrupted uploads retain the exact media reference and retry idempotently',async()=>{
 const state=adapter();const prepared=await state.adapter.prepareScreenshots({userId:'owner-a',membership:owner,sourceRecordId:'trade-a',screenshots:{entry:[dataUrl]}});let first=true;const failing=createBacktestSharedMediaAdapter({storage:state.storage,upload:async()=>first?(first=false,{error:'offline'}):{verified:true,cloudRef:`tj-case-study-storage:owner-a/${prepared.entry[0].src.slice(BACKTEST_SHARED_MEDIA_PREFIX.length)}`,checksum:(await state.storage.getImage(prepared.entry[0].src.slice(BACKTEST_SHARED_MEDIA_PREFIX.length),'owner-a'))&&await (await import('./sharedImageStorage.js')).calculateImageChecksum(await state.storage.getImage(prepared.entry[0].src.slice(BACKTEST_SHARED_MEDIA_PREFIX.length),'owner-a'))}});
 const once=await failing.synchronizeScreenshots({userId:'owner-a',membership:owner,screenshots:prepared});assert.equal(once.entry[0].cloudRef,'');const twice=await failing.synchronizeScreenshots({userId:'owner-a',membership:owner,screenshots:once});assert.match(twice.entry[0].cloudRef,/owner-a\//);assert.equal(twice.entry[0].src,prepared.entry[0].src);
});

test('historical Backtest RPC media remains byte-for-byte compatible and ordering is retained',async()=>{
 const {adapter:media}=adapter();const legacy={entry:['data:image/png;base64,legacy',{src:'https://legacy.example/image.png'}],exit:['tj-image:{"legacy":true}']};const prepared=await media.prepareScreenshots({userId:'owner-a',membership:owner,sourceRecordId:'trade-a',screenshots:legacy,existingScreenshots:legacy});assert.deepEqual(prepared,legacy);assert.deepEqual(await media.serializeScreenshots(prepared),legacy);
});

test('adapter does not reinterpret Case Study references',async()=>{
 const {adapter:media}=adapter();const value={evidence:[{src:'tj-image:{"caseStudy":true}',cloudRef:'tj-case-study-storage:owner-a/evidence'}]};assert.deepEqual(await media.prepareScreenshots({userId:'owner-a',membership:owner,sourceRecordId:'trade-a',screenshots:value,existingScreenshots:value}),value);
});

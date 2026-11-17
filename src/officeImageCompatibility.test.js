import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMemberAccess, imageUploadsAreExplicitlyPaused } from './memberAccess.js';
import { canQueueCloudUpload, setImageUploadsPaused, createSharedImageStorage, IMAGE_STORAGE_STATES } from './sharedImageStorage.js';
const active={available:true,status:'active',journalCloudWriteAllowed:true,imageUploadAllowed:true};
const grant={imageAccessStatus:'ready',imageUploadsAllowed:true};
test('Office preserves independently granted Owner, Free and Premium image permissions',()=>{
  setImageUploadsPaused(false);
  for(const membership of ['owner','free','premium']) assert.equal(canQueueCloudUpload(applyMemberAccess({...grant,status:'ready',membership},active,true)),true);
});
test('Office never grants uploads when the independent grant is denied, unresolved or absent',()=>{
  for(const base of [{imageAccessStatus:'ready',imageUploadsAllowed:false},{imageAccessStatus:'unavailable',imageUploadsAllowed:true},{membership:'owner',status:'ready'}]) assert.equal(canQueueCloudUpload(applyMemberAccess(base,active,true)),false);
});
test('pending, unavailable, suspended, banned, deleting and revoked access pause both image field conventions',()=>{
  for(const access of [null,{available:false},...['suspended','banned','deleting'].map(status=>({...active,status})),{...active,imageUploadAllowed:false}]) {
    const gated=applyMemberAccess({...grant},access,true);
    assert.equal(gated.imageUploadAllowed,false);assert.equal(gated.imageUploadsAllowed,false);assert.equal(canQueueCloudUpload(gated),false);assert.equal(imageUploadsAreExplicitlyPaused(access,true),true);
  }
});
test('journal-only denial does not revoke independently permitted images, and image denial does not disable journals',()=>{
  const deniedJournal={...active,journalCloudWriteAllowed:false};
  const allowed=applyMemberAccess({...grant,cloudWritesAllowed:true},deniedJournal,true);
  assert.equal(allowed.cloudWritesAllowed,false);assert.equal(canQueueCloudUpload(allowed),true);assert.equal(imageUploadsAreExplicitlyPaused(deniedJournal,true),false);
  const deniedImages=applyMemberAccess({...grant,cloudWritesAllowed:true},{...active,imageUploadAllowed:false},true);
  assert.equal(deniedImages.cloudWritesAllowed,true);assert.equal(canQueueCloudUpload(deniedImages),false);
});
test('a fresh grant response cannot bypass the current Office pause; flag-off retains production behavior',()=>{
  try {setImageUploadsPaused(true);assert.equal(canQueueCloudUpload(grant),false);assert.equal(imageUploadsAreExplicitlyPaused(null,false),false);}
  finally{setImageUploadsPaused(false);}
  assert.equal(canQueueCloudUpload(grant),true);
});
test('paused uploads preserve original local bytes and ownership without invoking the uploader',async()=>{
  const assets=new Map(),bytes=new Map(),queue=new Map();const clone=x=>x?structuredClone(x):null;
  const persistence={save:async(a,b,q)=>{assets.set(a.id,clone(a));bytes.set(a.id,{ownerUserId:a.ownerUserId,blob:b});if(q)queue.set(q.id,clone(q));},getAsset:async id=>clone(assets.get(id)),getBinary:async id=>bytes.get(id),listAssets:async user=>[...assets.values()].filter(a=>a.ownerUserId===user).map(clone),listQueue:async user=>[...queue.values()].filter(q=>q.ownerUserId===user).map(clone),getQueue:async id=>clone(queue.get(id)),updateAssetQueue:async(a,q,remove)=>{if(a)assets.set(a.id,clone(a));if(remove)queue.delete(q.id);else queue.set(q.id,clone(q));},acquireLease:async()=>true,releaseLease:async()=>{}};
  const storage=createSharedImageStorage({persistence});const file=new Blob([Uint8Array.from([137,80,78,71,13,10,26,10])],{type:'image/png'});let uploads=0;
  try{
    setImageUploadsPaused(false);const asset=await storage.saveImage({userId:'isolated-fixture',membership:grant,file,sourceModule:'case-studies'});
    assert.equal(asset.storageState,IMAGE_STORAGE_STATES.PENDING_UPLOAD);
    setImageUploadsPaused(true);
    const result=await storage.processUploadQueue({userId:'isolated-fixture',membership:grant,getMembership:async()=>({...grant}),uploader:async()=>{uploads++;throw Error('must not upload');}});
    assert.equal(uploads,0);assert.equal(result.processed,0);
    assert.deepEqual(new Uint8Array(await(await storage.getImage(asset.id,'isolated-fixture')).arrayBuffer()),new Uint8Array(await file.arrayBuffer()));
    assert.equal(await storage.getImage(asset.id,'other-fixture'),null);
    assert.equal((await storage.getImageMetadata(asset.id,'isolated-fixture')).cloudPath,'');
  }finally{setImageUploadsPaused(false);}
});

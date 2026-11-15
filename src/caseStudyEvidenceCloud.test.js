import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {caseStudyEvidenceCloudPath,caseStudyEvidenceCloudReference,classifyCaseStudyEvidenceCloudError,createCaseStudyImageResolver,isCaseStudyEvidenceCloudReference,resolveCaseStudyEvidenceCloudUrl,uploadCaseStudyEvidenceImage} from './caseStudyEvidenceCloud.js';
import {IMAGE_STORAGE_STATES} from './sharedImageStorage.js';
import {evidenceImageReference} from './caseStudyCover.js';

test('private Case Study evidence references are durable paths, not image bytes in the synced library',()=>{
  const ref=caseStudyEvidenceCloudReference('user-a/evidence-a');
  assert.equal(isCaseStudyEvidenceCloudReference(ref),true);
  assert.equal(caseStudyEvidenceCloudPath(ref),'user-a/evidence-a');
  assert.equal(evidenceImageReference({url:'tj-case-study-evidence:local',cloudRef:ref}),ref);
});

test('evidence storage uploads verify the private object before publishing its cloud reference',()=>{
  const source=readFileSync(new URL('./caseStudyEvidenceCloud.js',import.meta.url),'utf8');
  assert.match(source,/bucket\.upload\(path,bytes,\{upsert:false/);
  assert.match(source,/bucket\.download\(path\)/);
  assert.match(source,/verified\.size!==blob\.size/);
  assert.match(source,/before the shared\s+\/\/ queue can publish a durable cloud reference/);
  assert.doesNotMatch(source,/synchronizeCaseStudyEvidenceImages/);
});

test('active Case Study writes use the membership-aware shared integration, not a legacy cloud synchronizer',()=>{
  const source=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  assert.match(source,/caseStudySharedImageIntegration\.saveEvidenceImage/);
  assert.match(source,/caseStudySharedImageIntegration\.saveDocumentImage/);
  assert.match(source,/caseStudySharedImageIntegration\.synchronizeWorkspace/);
  assert.doesNotMatch(source,/uploadCaseStudyEvidenceImage/);
  assert.doesNotMatch(source,/synchronizeCaseStudyEvidenceImages/);
});

const storageStub=({uploadError=null,downloadError=null,size=3}={})=>{
  const calls=[];
  const bucket={
    upload:async (...args)=>{calls.push(['upload',...args]);return {error:uploadError};},
    download:async path=>{calls.push(['download',path]);return {data:downloadError?null:new Blob(['abc']),error:downloadError};},
  };
  return {client:{storage:{from:()=>bucket}},calls};
};

test('a new evidence image is read back before its cloud reference is returned',async()=>{
  const {client,calls}=storageStub();
  const result=await uploadCaseStudyEvidenceImage({userId:'user-a',evidenceId:'evidence-a',blob:new Blob(['abc'],{type:'image/png'}),client});
  assert.equal(result.cloudRef,'tj-case-study-storage:user-a/evidence-a');
  assert.deepEqual(calls.map(([name])=>name),['upload','download']);
  assert.ok(calls[0][2] instanceof ArrayBuffer);
  assert.deepEqual(new Uint8Array(calls[0][2]),new TextEncoder().encode('abc'));
  assert.deepEqual(calls[0][3],{upsert:false,contentType:'image/png'});
});

test('a retry reuses its stable object path and only succeeds after a verified download',async()=>{
  const {client,calls}=storageStub({uploadError:{message:'The resource already exists'}});
  const result=await uploadCaseStudyEvidenceImage({userId:'user-a',evidenceId:'evidence-a',blob:new Blob(['abc']),client});
  assert.equal(result.cloudRef,'tj-case-study-storage:user-a/evidence-a');
  assert.deepEqual(calls.map(([name])=>name),['upload','download']);
});

test('a failed verification never returns a cloud reference',async()=>{
  const {client}=storageStub({downloadError:{message:'Network unavailable'}});
  const result=await uploadCaseStudyEvidenceImage({userId:'user-a',evidenceId:'evidence-a',blob:new Blob(['abc']),client});
  assert.equal(result.cloudRef,undefined);
  assert.match(result.error,/Network unavailable/);
});

test('a same-size but different cloud binary never publishes a durable reference',async()=>{
  const bucket={upload:async()=>({error:null}),download:async()=>({data:new Blob(['xyz']),error:null})};
  const result=await uploadCaseStudyEvidenceImage({userId:'user-a',evidenceId:'evidence-a',blob:new Blob(['abc']),client:{storage:{from:()=>bucket}}});
  assert.equal(result.cloudRef,undefined);
  assert.match(result.error,/did not match/i);
});

test('signed URL retrieval keeps the exact owner-scoped path and reports private-access failures safely',async()=>{
  const paths=[];
  const client={storage:{from:()=>({createSignedUrl:async path=>{paths.push(path);return {data:null,error:{message:'new row violates row-level security policy'}};}})}};
  const result=await resolveCaseStudyEvidenceCloudUrl(caseStudyEvidenceCloudReference('owner-a/asset-a'),{client});
  assert.deepEqual(paths,['owner-a/asset-a']);
  assert.equal(result.code,'signed-url-authorization-failed');
  assert.equal(result.url,undefined);
  assert.equal(classifyCaseStudyEvidenceCloudError({message:'The object was not found'}),'cloud-object-missing');
  assert.equal(classifyCaseStudyEvidenceCloudError({message:'fetch failed'}),'cloud-network-failed');
});

test('a successful signed URL can be renewed after an earlier expired or failed request',async()=>{
  let call=0;
  const client={storage:{from:()=>({createSignedUrl:async()=>++call===1?{data:null,error:{message:'JWT expired'}}:{data:{signedUrl:'https://signed.example.test/fresh'},error:null}})}};
  const reference=caseStudyEvidenceCloudReference('owner-a/asset-a');
  assert.equal((await resolveCaseStudyEvidenceCloudUrl(reference,{client})).code,'signed-url-authorization-failed');
  assert.equal((await resolveCaseStudyEvidenceCloudUrl(reference,{client})).url,'https://signed.example.test/fresh');
});

function imageResolverFixture(options = {}) {
  let owner = 'owner-a';
  let time = 0;
  let authChanged;
  const requests = [];
  const client = {
    auth: {
      getSession: async () => ({data:{session:owner ? {user:{id:owner}} : null}}),
      onAuthStateChange: callback => { authChanged = callback; },
    },
    storage: {from: () => ({
      createSignedUrl: async path => {
        requests.push(['sign', path]);
        return {data:{signedUrl:'https://signed.example.test/' + path + '?version=' + requests.length}};
      },
    })},
  };
  const resolve = createCaseStudyImageResolver({
    client, now: () => time, storage:{getImageMetadata:async () => null},
    fetchImage: async (url, init) => {
      requests.push(['get', new URL(url).pathname.slice(1)]);
      return options.response?.(url, init) ?? new Response(new Blob(['image'], {type:'image/png'}));
    },
    ...options,
  });
  return {resolve, requests, advance: ms => { time += ms; }, switchOwner: id => {
    owner = id;
    authChanged('SIGNED_IN', id ? {user:{id}} : null);
  }};
}

const privateImage = 'tj-case-study-storage:owner-a/image';

test('thumbnail, detail and remount share one signing POST and one original GET', async () => {
  const {resolve, requests} = imageResolverFixture();
  const sign = resolve(privateImage);
  const first = resolve(privateImage, {bytes:true});
  const detail = resolve(privateImage, {bytes:true});
  const [signed, thumbnail, selected] = await Promise.all([sign, first, detail]);
  assert.equal((await resolve(privateImage)).url, signed.url);
  assert.equal(selected.blob, thumbnail.blob);
  assert.equal((await resolve(privateImage, {bytes:true})).blob, thumbnail.blob);
  assert.deepEqual(requests, [['sign','owner-a/image'],['get','owner-a/image']]);
});

test('synchronous cache lookup exposes only unexpired image bytes for the active owner', async () => {
  const {resolve, requests, advance, switchOwner} = imageResolverFixture();
  assert.equal(resolve.peekBlob(privateImage, 'owner-a'), undefined);
  const {blob} = await resolve(privateImage, {bytes:true});
  assert.equal(resolve.peekBlob(privateImage, 'owner-a'), blob);
  assert.equal(resolve.peekBlob(privateImage, 'owner-b'), undefined);
  assert.equal(resolve.peekBlob(privateImage, ''), undefined);
  advance(600_000);
  assert.equal(resolve.peekBlob(privateImage, 'owner-a'), undefined);
  await resolve(privateImage, {bytes:true});
  switchOwner('owner-b');
  assert.equal(resolve.peekBlob(privateImage, 'owner-a'), undefined);
  switchOwner('owner-a');
  assert.equal(resolve.peekBlob(privateImage, 'owner-a'), undefined);
  assert.deepEqual(requests.map(([method]) => method), ['sign','get','sign','get']);
});

test('an owner-scoped verified IndexedDB original avoids signing and downloading', async () => {
  const blob = new Blob(['local']);
  const {resolve, requests} = imageResolverFixture({storage:{
    getImageMetadata: async () => ({storageState:IMAGE_STORAGE_STATES.CLOUD_VERIFIED,cloudPath:'owner-a/image'}),
    getImage: async () => blob,
  }});
  assert.equal((await resolve(privateImage, {bytes:true})).blob, blob);
  assert.deepEqual(requests, []);
});

test('signed URLs expire early, image bytes expire independently and cache size is bounded', async () => {
  const {resolve, requests, advance} = imageResolverFixture({maxEntries:2,maxBytes:7});
  const original = await resolve(privateImage);
  await resolve(privateImage, {bytes:true});
  advance(570_000);
  assert.notEqual((await resolve(privateImage)).url, original.url);
  await resolve(privateImage, {bytes:true});
  assert.equal(requests.filter(([method]) => method === 'get').length, 1);
  advance(30_000);
  await resolve(privateImage, {bytes:true});
  await resolve(privateImage + '-other', {bytes:true});
  await resolve(privateImage, {bytes:true});
  assert.equal(requests.filter(([method]) => method === 'get').length, 4);
});

test('account switching aborts pending downloads and discards both signed URLs and cached bytes', async () => {
  let finish;
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const fixture = imageResolverFixture({response: (url, {signal}) => {
    if (url.includes('/pending?')) return new Promise(resolve => {
      finish = () => { assert.equal(signal.aborted, true); resolve(new Response('late')); };
      started();
    });
  }});
  const initial = await fixture.resolve(privateImage, {bytes:true});
  const pending = fixture.resolve('tj-case-study-storage:owner-a/pending', {bytes:true});
  await ready;
  fixture.switchOwner('owner-b');
  assert.equal((await fixture.resolve(privateImage, {bytes:true})).code, 'signed-url-authorization-failed');
  assert.equal((await fixture.resolve('tj-case-study-storage:owner-b/image', {bytes:true,userId:'owner-a'})).code, 'signed-url-authorization-failed');
  finish();
  assert.equal((await pending).code, 'signed-url-authorization-failed');
  fixture.switchOwner('owner-a');
  assert.notEqual((await fixture.resolve(privateImage, {bytes:true})).blob, initial.blob);
  assert.equal(fixture.requests.filter(([method,path]) => method === 'sign' && path === 'owner-a/image').length, 2);
});

test('expired image token refreshes once and transient download failure is retryable', async () => {
  let count = 0;
  const {resolve, requests} = imageResolverFixture({response: () => {
    count += 1;
    if (count === 1) return new Response(null, {status:403});
    if (count === 2) return new Response(null, {status:503});
  }});
  assert.equal((await resolve(privateImage, {bytes:true})).code, 'cloud-network-failed');
  assert.ok((await resolve(privateImage, {bytes:true})).blob);
  assert.deepEqual(requests.map(([method]) => method), ['sign','get','sign','get','get']);
});

test('Mobile Case Studies uses the common cloudRef-first evidence resolver',()=>{
  const source=readFileSync(new URL('./MobileCaseStudies.jsx',import.meta.url),'utf8');
  assert.match(source,/import \{ evidenceImageReference \} from '\.\/caseStudyCover\.js'/);
  assert.match(source,/const ref = evidenceImageReference\(evidence\)/);
});

test('private bucket setup restricts reads and uploads to the authenticated user folder',()=>{
  const sql=readFileSync(new URL('../supabase/case_study_evidence_storage.sql',import.meta.url),'utf8');
  assert.match(sql,/case-study-evidence', 'case-study-evidence', false/i);
  assert.match(sql,/storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/g);
  assert.match(sql,/for select to authenticated/i);
  assert.match(sql,/for insert to authenticated/i);
  assert.doesNotMatch(sql,/for delete/i);
});

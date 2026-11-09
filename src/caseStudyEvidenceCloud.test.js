import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {caseStudyEvidenceCloudPath,caseStudyEvidenceCloudReference,isCaseStudyEvidenceCloudReference,uploadCaseStudyEvidenceImage} from './caseStudyEvidenceCloud.js';
import {evidenceImageReference} from './caseStudyCover.js';

test('private Case Study evidence references are durable paths, not image bytes in the synced library',()=>{
  const ref=caseStudyEvidenceCloudReference('user-a/evidence-a');
  assert.equal(isCaseStudyEvidenceCloudReference(ref),true);
  assert.equal(caseStudyEvidenceCloudPath(ref),'user-a/evidence-a');
  assert.equal(evidenceImageReference({url:'tj-case-study-evidence:local',cloudRef:ref}),ref);
});

test('evidence storage uploads verify the private object before publishing its cloud reference',()=>{
  const source=readFileSync(new URL('./caseStudyEvidenceCloud.js',import.meta.url),'utf8');
  assert.match(source,/bucket\.upload\(path,blob,\{upsert:false/);
  assert.match(source,/bucket\.download\(path\)/);
  assert.match(source,/verified\.size!==blob\.size/);
  assert.match(source,/Only confirmed cloud objects add cloudRef/);
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
  assert.equal(calls[0][3].upsert,false);
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

test('private bucket setup restricts reads and uploads to the authenticated user folder',()=>{
  const sql=readFileSync(new URL('../supabase/case_study_evidence_storage.sql',import.meta.url),'utf8');
  assert.match(sql,/case-study-evidence', 'case-study-evidence', false/i);
  assert.match(sql,/storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/g);
  assert.match(sql,/for select to authenticated/i);
  assert.match(sql,/for insert to authenticated/i);
  assert.doesNotMatch(sql,/for delete/i);
});

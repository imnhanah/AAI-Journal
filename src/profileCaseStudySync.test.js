import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cloudSyncState,planTemporaryLibraryUpload,sameProfileCaseStudyLibrary} from './profileCaseStudySync.js';

const library = id => ({studies:[{id,body:`${id} note`,evidenceIds:[`evidence-${id}`],evidencePlacements:{[`evidence-${id}`]:{annotations:[{id:`annotation-${id}`}],board:{objects:[{id:`text-${id}`,tool:'text',text:id}]}}}}],evidence:[{id:`evidence-${id}`}],notebooks:[],personalTemplates:[{id:`template-${id}`,metadata:{id}}]});

test('two-device save plans reject stale or divergent cloud libraries without overwriting either version',()=>{
  const mac=library('mac'), phone=library('phone');
  const conflict=planTemporaryLibraryUpload({temporaryLibrary:mac,cloudLibrary:phone,cloudRevision:4});
  assert.equal(conflict.kind,'reconciliation-required');
  assert.deepEqual(conflict.local,mac); assert.deepEqual(conflict.cloud,phone);
  assert.equal(cloudSyncState({conflict:true}),'Sync conflict');
  assert.equal(cloudSyncState({syncing:true}),'Syncing');
  assert.equal(cloudSyncState({error:true}),'Sync failed');
});

test('initial uploads, repeated uploads, and device-only payloads preserve complete structures',()=>{
  const device=library('device');
  const first=planTemporaryLibraryUpload({temporaryLibrary:device,cloudLibrary:null,cloudRevision:null});
  assert.deepEqual(first,{kind:'initial-upload',expectedRevision:null});
  const repeated=planTemporaryLibraryUpload({temporaryLibrary:device,cloudLibrary:structuredClone(device),cloudRevision:1});
  assert.deepEqual(repeated,{kind:'already-synced',expectedRevision:1});
  assert.equal(sameProfileCaseStudyLibrary(device,structuredClone(device)),true);
  assert.equal(device.studies[0].evidencePlacements['evidence-device'].board.objects[0].text,'device');
});

test('cloud contract uses database RPC compare-and-swap rather than unconditional upsert',()=>{
  const cloud=readFileSync(new URL('./caseStudyCloud.js',import.meta.url),'utf8');
  const sql=readFileSync(new URL('../supabase/profile_case_study_sync_concurrency.sql',import.meta.url),'utf8');
  const journal=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(cloud,/rpc\('tj_save_profile_case_study_library'/);
  assert.doesNotMatch(cloud,/\.upsert\(/);
  assert.match(sql,/revision bigint not null default 0/);
  assert.match(sql,/where user_id=auth\.uid\(\) and revision=expected_revision/);
  assert.match(sql,/on conflict \(user_id\) do nothing/);
  assert.match(journal,/setProfileCaseStudySyncStatus\('Sync conflict'\)/);
  assert.match(journal,/setProfileCaseStudyConflict\(\{ local:caseStudyWorkspace/);
});

test('sync statuses distinguish local saves, confirmed sync, failure, and conflict',()=>{
  assert.equal(cloudSyncState({temporary:true}),'Saved locally');
  assert.equal(cloudSyncState({synced:true}),'Synced');
  assert.equal(cloudSyncState({error:true}),'Sync failed');
  assert.equal(cloudSyncState({conflict:true}),'Sync conflict');
});

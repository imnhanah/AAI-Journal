import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyDurableRecoveryRow,DURABLE_RECOVERY_DATABASE as database} from './durableDeviceRecovery.js';
import {canonicalRecovery,recoveryHash,verifyDeviceRecovery,portableDeviceRecovery,deviceRecoveryCopies,preservePortableDurableRecovery} from './deviceRecovery.js';
const owner='90000000-0000-4000-8000-000000000001',project='synthetic.aai.invalid';
const draft=()=>({database,store:'drafts',key:[project,owner,'pending-trade','trade'],value:{schemaVersion:1,key:[project,owner,'pending-trade','trade'],scope:[project,owner],feature:'pending-trade',recordId:'trade',revision:1,payload:{codecVersion:1,state:'dirty',value:['object',[['image',['value','tj-trade-media:original']]]]}}});
const seal=async payload=>({...payload,payloadSha256:await recoveryHash(canonicalRecovery(payload))});
const archive=async rows=>seal({format:'aaicorefx-device-recovery',version:1,recoveryOwnerId:owner,projectId:project,records:rows||[draft()],localStorage:[],stores:[],issues:[],exportedAt:'2026-11-15T00:00:00Z'});
const reseal=async value=>{const {payloadSha256,...payload}=value;return seal(payload);};
test('durable recovery: exact draft/history/operation/receipt scope and keys are accepted',()=>{
 const d=draft();assert.equal(verifyDurableRecoveryRow(d,owner,project),true);
 const h=structuredClone(d);h.store='history';h.key.push(1);h.value.key=h.key;assert.equal(verifyDurableRecoveryRow(h,owner,project),true);
 for(const store of ['operations','receipts']){const key=[project,owner,'operation'];assert.equal(verifyDurableRecoveryRow({store,key,value:{schemaVersion:1,key,scope:[project,owner],operationId:'operation'}},owner,project),true);}
});
test('durable recovery: foreign owner and project are rejected independently',()=>{assert.throws(()=>verifyDurableRecoveryRow(draft(),'other',project),/scope/);assert.throws(()=>verifyDurableRecoveryRow(draft(),owner,'other'),/scope/);});
test('durable recovery: forged IDB key, schema and scope cannot pass validation',()=>{for(const mutate of [r=>r.value.scope.reverse(),r=>r.value.schemaVersion=2,r=>r.key.push('extra'),r=>r.value.recordId='wrong',r=>r.value.revision=0]){const row=draft();mutate(row);assert.throws(()=>verifyDurableRecoveryRow(row,owner,project));}});
test('durable recovery: old device archives remain compatible',async()=>{const a=await archive([]);delete a.projectId;assert.equal((await verifyDeviceRecovery(await reseal(a),owner)).records,0);});
test('durable recovery: raw draft image references and originals remain unchanged in portable copies',async()=>{const a=await archive(),before=canonicalRecovery(a),copy=await portableDeviceRecovery(a,'durable-pending',{expectedOwner:owner});assert.equal(copy.durableRecoveryArchive.payloadSha256,a.payloadSha256);assert.deepEqual(copy.durableRecoveryArchive.records,a.records);assert.equal(canonicalRecovery(a),before);assert.equal(deviceRecoveryCopies(a)[0].id,'durable-pending');});
test('durable recovery: authenticated expected project rejects a different archive project',async()=>{await assert.rejects(verifyDeviceRecovery(await archive(),owner,{expectedProjectId:'other'}),/project/);});
test('durable recovery: outer checksum cannot disguise foreign-scope rows',async()=>{const a=await archive();a.records[0].value.scope[1]='other';await assert.rejects(verifyDeviceRecovery(await reseal(a),owner),/scope/);});
test('durable recovery: duplicate keys are rejected before any restore',async()=>{const a=await archive();a.records.push(structuredClone(a.records[0]));await assert.rejects(verifyDeviceRecovery(await reseal(a),owner),/duplicate/);});
test('durable recovery: wrong-key history revisions cannot overwrite another history entry',()=>{const r=draft();r.store='history';r.key.push(2);r.value.key=r.key;assert.throws(()=>verifyDurableRecoveryRow(r,owner,project),/history/);});
test('durable recovery: unrelated settings stay forbidden',async()=>{const a=await archive();a.localStorage.push({key:'sb-auth-token',value:'synthetic'});await assert.rejects(verifyDeviceRecovery(await reseal(a),owner),/unrelated/);});
test('durable recovery: imports without sidecars do not open or change any storage',async()=>{assert.deepEqual(await preservePortableDurableRecovery({},owner,{indexedDb:{open(){throw Error('must not open');}}}),{copies:0,queuesReactivated:false});});
test('durable recovery: malformed archive and missing account fence cannot open storage',async()=>{let opened=false;await assert.rejects(preservePortableDurableRecovery({durableRecoveryArchive:await archive()},owner,{projectId:project,indexedDb:{open(){opened=true;}}}),/Confirm/);assert.equal(opened,false);});

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const { AAI_STAGING_URL: url, AAI_STAGING_REF: ref, AAI_STAGING_PUBLIC_KEY: key } = process.env;
if (!/^[a-z0-9]{20}$/.test(ref || '') || ref === 'vuopjbkkbrcohtjlzlxt'
  || url !== `https://${ref}.supabase.co` || !key || key.startsWith('sb_secret_')) {
  throw new Error('Provide a separate staging project ref, matching URL, and publishable or legacy anon key.');
}
if (!key.startsWith('sb_publishable_')) {
  const claims = JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64url').toString() || '{}');
  assert.equal(claims.role,'anon');
  assert.equal(claims.ref,ref);
}

async function signIn(role) {
  const email = process.env[`AAI_STAGING_${role}_EMAIL`];
  const password = process.env[`AAI_STAGING_${role}_PASSWORD`];
  if (!email?.endsWith('@example.test') || !password) throw new Error(`Configure the synthetic ${role} account.`);
  const client = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const { data, error } = await client.auth.signInWithPassword({email,password});
  if (error) throw new Error(`Could not sign in as the synthetic ${role} account.`);
  return {client,id:data.user.id};
}

async function ok(request, label) {
  const {data,error} = await request;
  assert.ok(!error,`${label}: ${error?.code || error?.message || ''}`);
  return data;
}
async function denied(request, label) {
  const {error} = await request;
  assert.ok(error,`${label} unexpectedly succeeded`);
  return error;
}
async function rights(session, membership, allowed) {
  const result = await ok(session.client.rpc('tj_current_entitlements'),'Read entitlement');
  assert.deepEqual(result,[{membership,cloud_writes_allowed:allowed}]);
}

const [owner, free, admin] = await Promise.all(['OWNER','FREE','ADMIN'].map(signIn));
assert.equal(new Set([owner.id,free.id,admin.id]).size,3);
await rights(owner,'owner',true);
await rights(free,'free',false);
assert.equal(await ok(admin.client.rpc('tj_is_membership_admin'),'Read administrator grant'),true);
assert.equal(await ok(owner.client.rpc('tj_is_membership_admin'),'Read ordinary Owner grant'),false);
await denied(owner.client.rpc('tj_list_membership_accounts'),'Ordinary Owner list');
const change = (session, user, previous, previousFlag, membership, cloudFlag) => session.client.rpc('tj_change_membership',{
  target_user:user,expected_membership:previous,expected_cloud_flag:previousFlag,next_membership:membership,next_cloud_flag:cloudFlag,
}).single();
await denied(change(free,free.id,'free',false,'owner',true),'Free self promotion');
await denied(change(owner,free.id,'free',false,'owner',true),'Ordinary Owner membership change');
await denied(change(admin,admin.id,'free',false,'owner',true),'Administrator self promotion');

const nonce = randomUUID();
const image = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQLsAAAAASUVORK5CYII=','base64'));
const path = session => `${session.id}/${nonce}.png`;
const bucket = session => session.client.storage.from('case-study-evidence');
const insert = session => session.client.from('accounts').insert({id:nonce,user_id:session.id,name:`Synthetic staging ${nonce}`}).select('id').single();
const publish = session => session.client.rpc('tj_publish_device_journal',{rows_by_table:{},device_library:null,preview:false});
const backtest = session => session.client.rpc('tj_save_backtest_run',{
  row_id:nonce,expected_version:null,settings:{name:'Synthetic run',instrument:'EUR/USD',startingBalance:10000,tradeTarget:10,currency:'USD',riskPct:1},remove_row:false,
});

await denied(insert(free),'Free REST insert');
await denied(publish(free),'Free promotion RPC');
await denied(backtest(free),'Free Strategy Testing RPC');
await denied(bucket(free).upload(path(free),image.buffer,{contentType:'image/png'}),'Free private upload');

await ok(insert(owner),'Owner REST insert');
await ok(publish(owner),'Owner promotion RPC');
await ok(backtest(owner),'Owner Strategy Testing RPC');
await ok(bucket(owner).upload(path(owner),image.buffer,{contentType:'image/png'}),'Owner private upload');
await ok(change(admin,owner.id,'owner',true,'owner',false),'Disable Owner cloud permission');
try {
  await rights(owner,'owner',false);
  const update = await ok(owner.client.from('accounts').update({name:'Must not change'}).eq('id',nonce).select('id'),'Restricted REST update');
  assert.deepEqual(update,[]);
  const removed = await ok(owner.client.from('accounts').delete().eq('id',nonce).select('id'),'Restricted REST delete');
  assert.deepEqual(removed,[]);
  await denied(owner.client.from('accounts').upsert({id:nonce,user_id:owner.id,name:'Must not change'}),'Restricted REST upsert');
  await denied(publish(owner),'Restricted promotion RPC');
  await denied(bucket(owner).upload(path(owner),image.buffer,{contentType:'image/png',upsert:true}),'Restricted Storage upsert');
  const account = await ok(owner.client.from('accounts').select('name').eq('id',nonce).single(),'Restricted Owner read');
  assert.equal(account.name,`Synthetic staging ${nonce}`);
  const {signedUrl} = await ok(bucket(owner).createSignedUrl(path(owner),60),'Restricted Owner signed URL');
  const response = await fetch(signedUrl);
  assert.ok(response.ok);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()),image);
  await denied(bucket(free).createSignedUrl(path(owner),60),'Cross-account signed URL');
} finally {
  await ok(change(admin,owner.id,'owner',false,'owner',true),'Restore synthetic Owner permission');
}
await rights(owner,'owner',true);
console.log('Hosted staging authorization checks passed. Synthetic records and images remain for the rollback rehearsal.');

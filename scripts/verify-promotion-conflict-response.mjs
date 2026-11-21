// Local-only PostgreSQL regressions. No environment files or network access.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {PostgrestClient} from '@supabase/postgrest-js';
const {PGlite}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'@electric-sql/pglite');
const repo=fileURLToPath(new URL('../',import.meta.url));
const db=new PGlite(),q=(s,a)=>db.query(s,a);
const owner='70000000-0000-4000-8000-000000000001',other='70000000-0000-4000-8000-000000000002',free='70000000-0000-4000-8000-000000000003',restricted='70000000-0000-4000-8000-000000000004';
const id=n=>`71000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const become=async(user,role='authenticated')=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);if(role)await db.exec('set role '+role);};
const apply=async(file)=>db.exec((await readFile(repo+file,'utf8')).replace(/^create extension if not exists pgcrypto;/gim,''));
const publish=(rows,library,preview=false)=>q('select public.tj_publish_device_journal($1,$2,$3) result',[rows,library,preview]);
const save=(rev,lib)=>q('select * from public.tj_save_profile_case_study_library($1,$2)',[rev,lib]);
const library={version:1,studies:[{id:'study'}],evidence:[{id:'evidence',url:'tj-case-study-media:original',cloudRef:{bucket:'case-study-evidence',path:owner+'/original',checksum:'preserved-original-hash'}}],placements:[{id:'placement',evidenceId:'evidence'}],annotations:[{id:'annotation',placementId:'placement'}],personalTemplates:[{id:'template'}]};
const tracked=['public.accounts','public.profile_case_study_libraries','public.user_settings','public.tj_memberships','public.profiles','storage.objects'];
const snapshot=async()=>{await become(null,null);const rows={};for(const table of tracked)rows[table]=(await q('select to_jsonb(t) data from '+table+' t order by to_jsonb(t)::text')).rows;return rows;};
const preserved=async(action,code='PT409')=>{const before=await snapshot();await become(owner);await assert.rejects(action,e=>e.code===code);assert.deepEqual(await snapshot(),before);await become(owner);};
const retryTransient=async(action,limit=3)=>{let attempts=0;for(;;){attempts++;try{return {attempts,value:await action()};}catch(error){if(error.code==='40001'&&attempts<limit)continue;return{attempts,error};}}};
try{
 await apply('scripts/membership-security-fixture.sql');await apply('supabase/schema.sql');
 await db.exec('alter table public.profiles add column cloud_sync_enabled boolean not null default false');
 for(const file of ['finance_migration.sql','challenge_migration.sql','multi_balance_workspaces_migration.sql','backtest_accounts.sql','profile_case_study_library_concurrency_install.sql','case_study_evidence_storage.sql','membership_authorization_foundation.sql','membership_entitlements_preview.sql'])await apply('supabase/'+file);
 const corrected=await readFile(repo+'supabase/membership_journal_promotion.sql','utf8');
 assert.equal((corrected.match(/errcode = 'PT409'/g)||[]).length,5);assert.equal((corrected.match(/errcode = '40001'/g)||[]).length,0);
 await db.exec(corrected);
 for(const [i,user]of[owner,other,free,restricted].entries())await q('insert into auth.users(id,email) values($1,$2)',[user,`promotion-${i}@example.test`]);
 await q("insert into public.tj_memberships(user_id,membership) values($1,'owner'),($2,'owner'),($3,'owner')",[owner,other,restricted]);
 await q('update public.profiles set cloud_sync_enabled=true where id in ($1,$2,$3)',[owner,other,free]);
 await q("insert into storage.objects(bucket_id,name) values('case-study-evidence',$1)",[owner+'/original']);
 await test('successful first promotion saves one library and repeated publication is idempotent',async()=>{
  await become(owner);const rows={accounts:[{id:id(1),name:'Synthetic device record'}]};await publish(rows,library);const before=await snapshot();await become(owner);await publish(rows,library);assert.deepEqual(await snapshot(),before);
 });
 const changed={...library,settings:{query:'Changed on another device'}};
 await test('preview reports exact existing revision without changing any rows or image metadata',async()=>{
  const before=await snapshot();await become(owner);const result=(await publish({},changed,true)).rows[0].result;assert.deepEqual(result.conflicts,[{table:'Case Studies',revision:1}]);assert.equal(result.caseStudyRevision,1);assert.deepEqual(await snapshot(),before);
 });
 await test('original SQLSTATE reproduces a bounded transaction retry loop locally',async()=>{
  await become(null,null);await db.exec(corrected.replaceAll("errcode = 'PT409'","errcode = '40001'").replace('create function public.','create or replace function public.'));
  const before=await snapshot();await become(owner);const result=await retryTransient(()=>publish({},changed));assert.equal(result.attempts,3);assert.equal(result.error.code,'40001');assert.deepEqual(await snapshot(),before);
  await db.exec(corrected.replace('create function public.','create or replace function public.'));
 });
 await test('corrected Case Study conflict stops after one attempt and preserves all originals',async()=>{
  const before=await snapshot();await become(owner);const result=await retryTransient(()=>publish({},changed));assert.equal(result.attempts,1);assert.equal(result.error.code,'PT409');assert.match(result.error.message,/cloud Case Study Library differs/);assert.deepEqual(await snapshot(),before);
 });
 await test('record conflict rolls back preceding attempted inserts atomically',async()=>{
  await preserved(()=>publish({accounts:[{id:id(2),name:'Must roll back'},{id:id(1),name:'Conflicting name'}]},null));
 });
 await test('cross-user identifier collision returns conflict without modifying either user',async()=>{
  await become(other);await q('insert into public.accounts(id,user_id,name) values($1,$2,$3)',[id(3),other,'Other account']);await preserved(()=>publish({accounts:[{id:id(3),name:'Must not overwrite'}]},null));
 });
 await test('settings compare-and-swap failure uses the non-retrying conflict code',async()=>{
  await become(null,null);await db.exec("create function public.fixture_skip_settings_update() returns trigger language plpgsql as $$ begin return null; end $$; create trigger fixture_skip_settings before update on public.user_settings for each row execute function public.fixture_skip_settings_update();");
  try{await preserved(()=>publish({user_settings:[{user_id:owner,custom_type_tags:['New'],custom_mistake_tags:[],custom_confluence_sessions:[],custom_instruments:[]}]},null));}finally{await become(null,null);await db.exec('drop trigger fixture_skip_settings on public.user_settings; drop function public.fixture_skip_settings_update();');}
 });
 await test('concurrent first-library appearance branch rolls back earlier records',async()=>{
  await become(null,null);const original=(await q("select pg_get_functiondef('public.tj_save_profile_case_study_library(bigint,jsonb)'::regprocedure) definition")).rows[0].definition;
  await db.exec("create or replace function public.tj_save_profile_case_study_library(expected_revision bigint,next_library jsonb) returns table(outcome text,library jsonb,revision bigint,updated_at timestamptz) language sql security definer set search_path=pg_catalog as $$ select 'conflict'::text,null::jsonb,1::bigint,null::timestamptz $$;");
  const before=await snapshot();await become(other);
  try{await assert.rejects(()=>publish({accounts:[{id:id(4),name:'Must roll back'}]},library),e=>e.code==='PT409'&&/appeared/.test(e.message));assert.deepEqual(await snapshot(),before);}finally{await become(null,null);await db.exec(original);}
 });
 await test('normal Case Study CAS saves and stale revisions preserve evidence and metadata',async()=>{
  await become(owner);let saved=(await save(1,library)).rows[0];assert.equal(saved.outcome,'saved');assert.equal(saved.revision,2);
  const before=await snapshot();await become(owner);for(const rev of[0,1,null]){const result=(await save(rev,changed)).rows;assert.equal(result.length,1);assert.equal(result[0].outcome,'conflict');assert.equal(result[0].revision,2);assert.deepEqual(result[0].library,library);}assert.deepEqual(await snapshot(),before);
 });
 await test('Free, restricted Owner and unauthenticated callers remain rejected',async()=>{
  const before=await snapshot();for(const user of[free,restricted,null]){await become(user);await assert.rejects(()=>publish({},null),e=>e.code==='42501');}await become(null,'anon');await assert.rejects(()=>publish({},null),e=>e.code==='42501');assert.deepEqual(await snapshot(),before);
 });
 await test('cross-user Case Study reads remain isolated and no enforcement was installed locally',async()=>{
  await become(other);assert.deepEqual((await q('select user_id from public.profile_case_study_libraries')).rows,[]);await become(null,null);assert.equal((await q("select to_regprocedure('public.tj_can_write_cloud()') fn")).rows[0].fn,null);
 });
 await test('installed SDK parses HTTP 409 / PT409 once without a network retry',async()=>{
  let calls=0;const client=new PostgrestClient('https://synthetic.invalid/rest/v1',{fetch:async()=>{calls++;return new Response(JSON.stringify({code:'PT409',details:null,hint:null,message:'Review the two libraries before publishing.'}),{status:409,headers:{'Content-Type':'application/json'}});}});
  const result=await client.rpc('tj_publish_device_journal',{rows_by_table:{},device_library:changed,preview:false});assert.equal(calls,1);assert.equal(result.status,409);assert.equal(result.error.code,'PT409');assert.equal(result.data,null);
 });
}finally{await db.close();}

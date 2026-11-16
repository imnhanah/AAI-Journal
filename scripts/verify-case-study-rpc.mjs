// Local synthetic PostgreSQL response-cardinality and data-safety regression.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
const {PGlite}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'@electric-sql/pglite');
const root=fileURLToPath(new URL('../',import.meta.url));
const db=new PGlite();
const q=(sql,args)=>db.query(sql,args);
const a='40000000-0000-4000-8000-000000000001',b='40000000-0000-4000-8000-000000000002';
const image='tj-case-study-storage:'+a+'/synthetic-original.png';
const library={version:1,studies:[{id:'synthetic-study'}],evidence:[{id:'original-evidence',url:image}],placements:[{id:'original-placement',evidenceId:'original-evidence'}],annotations:[{id:'original-note'}],personalTemplates:[{id:'original-template'}]};
const become=async(user,role='authenticated')=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);if(role)await db.exec('set role '+role);};
const save=(revision,value=library)=>q('select * from public.tj_save_profile_case_study_library($1,$2)',[revision,value]);
const state=async()=>{await become(null,null);return(await q('select to_jsonb(t) data from public.profile_case_study_libraries t order by user_id')).rows;};
try{
 await db.exec(await readFile(root+'scripts/membership-security-fixture.sql','utf8'));
 await db.exec(await readFile(root+'supabase/profile_case_study_library_concurrency_install.sql','utf8'));
 await q('insert into auth.users(id,email) values($1,$2),($3,$4)',[a,'case-a@example.test',b,'case-b@example.test']);
 await become(a);
 await test('fresh first save returns exactly one saved row for PostgREST single-object clients',async()=>{
  const result=await save(null);assert.equal(result.rows.length,1);assert.deepEqual(result.rows.map(row=>row.outcome),['saved']);
 });
 const originalData=await state();
 const before=(await q("select oid,prosecdef,proconfig,proacl::text acl,proowner::regrole::text owner from pg_proc where oid='public.tj_save_profile_case_study_library(bigint,jsonb)'::regprocedure")).rows[0];
 const definition=(await q("select pg_get_functiondef('public.tj_save_profile_case_study_library(bigint,jsonb)'::regprocedure) definition")).rows[0].definition;
 await db.exec(definition);
 await test('definition-only correction preserves every pre-existing payload, revision and timestamp',async()=>assert.deepEqual(await state(),originalData));
 await test('correction preserves function identity, definer owner, fixed path and authenticated-only ACL',async()=>{
  assert.deepEqual((await q("select oid,prosecdef,proconfig,proacl::text acl,proowner::regrole::text owner from pg_proc where oid='public.tj_save_profile_case_study_library(bigint,jsonb)'::regprocedure")).rows[0],before);
 });
 await become(b);
 await test('a fresh first save returns exactly one saved row with its durable original references',async()=>{
  const result=await save(null);assert.equal(result.rows.length,1);assert.equal(result.rows[0].outcome,'saved');assert.equal(result.rows[0].revision,1);assert.deepEqual(result.rows[0].library,library);
 });
 await test('an existing library save returns exactly one saved row and preserves original relationships',async()=>{
  const next={...library,evidence:[...library.evidence,{id:'new-evidence'}]};
  const result=await save(1,next);assert.equal(result.rows.length,1);assert.equal(result.rows[0].outcome,'saved');assert.equal(result.rows[0].revision,2);assert.deepEqual(result.rows[0].library,next);
 });
 await test('stale and null revisions return one conflict without overwriting the current library',async()=>{
  for(const expected of [0,1,null]){const result=await save(expected,library);assert.equal(result.rows.length,1);assert.equal(result.rows[0].outcome,'conflict');assert.equal(result.rows[0].revision,2);assert.equal(result.rows[0].library.evidence.length,2);}
 });
 await test('malformed libraries are rejected and preserve original records',async()=>{
  const before=await state();await become(b);await assert.rejects(()=>save(2,[]),error=>error.code==='22023');assert.deepEqual(await state(),before);
 });
 await test('anonymous and signed-out callers are rejected; caller-owned reads remain isolated',async()=>{
  await become(null,'anon');await assert.rejects(()=>save(null),error=>error.code==='42501');await become(null);await assert.rejects(()=>save(null),error=>error.code==='28000');
  await become(a);assert.deepEqual((await q('select user_id from public.profile_case_study_libraries')).rows,[{user_id:a}]);
 });
 await test('reapplying the captured RPC definition preserves all synthetic data',async()=>{
  const before=await state();await db.exec(definition);assert.deepEqual(await state(),before);await db.exec(definition);assert.deepEqual(await state(),before);
 });
}finally{await db.close();}

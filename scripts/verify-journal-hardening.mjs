// Local synthetic PostgreSQL review of migrations 01–11. No hosted SDK/client.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {JOURNAL_TABLES,journalManifest,mergeJournalDelta,imageReference,resolveImageReferences} from '../src/journalDelta.js';
import {createPrivateCache} from '../src/privateCache.js';
import {loadRevisionedImage} from '../src/journalImageLoader.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const {PGlite}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'@electric-sql/pglite');
const db=new PGlite();
const q=(sql,args)=>db.query(sql,args);
const one=async(sql,args)=>(await q(sql,args)).rows[0];
const apply=async file=>db.exec((await readFile(file,'utf8')).replace(/^create extension if not exists pgcrypto;/gim,''));
const id=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [alice,bob,accountA,accountB,tradeA,tradeB,gone,reviewA,markupA,periodA]=Array.from({length:10},(_,i)=>id(i+1));
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQLsAAAAASUVORK5CYII=';
const shots={entry:[{src:image,caption:'Original setup'}],exit:[],sessionReview:{marketOutcome:'Trend'},shared:'tj-trade-media:synthetic',storage:`tj-case-study-storage:${alice}/synthetic.png`};
const body={notes:'Original full review body',embedded:image,accountScopes:{[accountA]:{completed:true,notes:'Account private detail'},[accountB]:{completed:false}}};
const become=async(user,role='authenticated')=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);if(role)await db.exec(`set role ${role}`);};
const sync=async known=>(await one('select public.tj_sync_journal($1::jsonb) data',[JSON.stringify(known)])).data;
const readImage=async ref=>(await one('select public.tj_journal_image($1,$2,$3,$4) data',[ref.table,ref.id,ref.path,ref.version])).data;
const noChanges=result=>{for(const table of JOURNAL_TABLES){assert.deepEqual(result.tables[table].rows,[],table);assert.deepEqual(result.tables[table].deleted,[],table);}};
const raw=async()=>Object.fromEntries(await Promise.all(JOURNAL_TABLES.map(async table=>[table,(await q(`select to_jsonb(t) data from public.${table} t order by user_id`)).rows.map(row=>row.data)])));
let legacy,snapshot,baseline,oldSync;
try{
 await apply(path.join(root,'scripts/membership-security-fixture.sql'));
 for(const file of ['schema.sql','trade_close_timing_migration.sql','finance_migration.sql','multi_balance_workspaces_migration.sql','savings_account_scope_migration.sql','challenge_migration.sql','challenge_modes_migration.sql','backtest_accounts.sql','economic_calendar_cache_migration.sql','journal_low_egress_migration.sql'])await apply(path.join(root,'supabase',file));
 for(const [user,account,trade] of [[alice,accountA,tradeA],[bob,accountB,tradeB]]){
  await q('insert into auth.users(id,email) values($1,$2)',[user,`synthetic-${user.slice(-1)}@example.test`]);
  await q('insert into public.accounts(id,user_id,name,profile_image) values($1,$2,$3,$4)',[account,user,'Synthetic workspace',image]);
  await q('insert into public.trades(id,user_id,account_id,trade_date,asset,screenshots) values($1,$2,$3,$4,$5,$6)',[trade,user,account,'2026-10-12','EUR/USD',JSON.stringify(shots)]);
 }
 await q('insert into public.trades(id,user_id,account_id,trade_date,asset) values($1,$2,$3,$4,$5)',[gone,alice,accountA,'2026-10-12','EUR/USD']);
 await q('insert into public.trade_reviews(id,user_id,account_id,trade_id,review_date,screenshots,execution_score,adherence_score,psychology_score) values($1,$2,$3,$4,$5,$6,5,4,3)',[reviewA,alice,accountA,tradeA,'2026-10-12',JSON.stringify(shots)]);
 await q('insert into public.premarket_markups(id,user_id,account_id,markup_date,screenshots) values($1,$2,$3,$4,$5)',[markupA,alice,accountA,'2026-10-12',JSON.stringify(shots)]);
 await q('insert into public.period_reviews(id,user_id,account_id,period_type,period_key,content) values($1,$2,$3,$4,$5,$6)',[periodA,alice,accountA,'monthly','2026-10',JSON.stringify(body)]);
 await become(alice);legacy=mergeJournalDelta({},await sync({}));
 await test('Migration 10 baseline caches original references, review scores and the soon-deleted record',()=>{
  assert.equal(legacy._protocol,1);assert.equal(legacy.trades.length,2);assert.equal(legacy.trade_reviews[0].execution_score,5);
  assert.deepEqual(legacy.period_reviews[0].content,body);assert.equal(legacy.accounts[0].profile_image,image);
 });
 // Simulate a remote deletion only in the isolated in-memory database.
 await q('delete from public.trades where id=$1',[gone]);
 await become(null,null);baseline=await raw();oldSync=(await one("select pg_get_functiondef('public.tj_sync_journal(jsonb)'::regprocedure) source")).source;
 const notices=[];const stop=await db.listen('pgrst',payload=>notices.push(payload));
 try{await apply(process.argv[3]||path.join(root,'supabase/journal_egress_hardening.sql'));}finally{await stop();}
 await test('Migration 11 is read-only with respect to all stored records, timestamps and images',async()=>assert.deepEqual(await raw(),baseline));
 await test('the migration emits a commit-time PostgREST schema refresh',()=>assert.deepEqual(notices,['reload schema']));
 await test('all three invoker RPC/helpers retain authenticated-only privileges',async()=>{
  for(const signature of ['tj_sync_journal(jsonb)','tj_bootstrap_metadata(jsonb,uuid,text,text)','tj_image_references(jsonb,uuid,text,text,text,text[])']){
   assert.equal((await one('select prosecdef from pg_proc where oid=$1::regprocedure',['public.'+signature])).prosecdef,false);
   for(const role of ['anon','authenticated'])assert.equal((await one('select has_function_privilege($1,$2,\'execute\') allowed',[role,'public.'+signature])).allowed,role==='authenticated');
  }
 });
 await become(alice);
 await test('protocol-1 upgrade refreshes projections and removes records deleted since its cached snapshot',async()=>{
  const result=await sync(journalManifest(legacy));assert.equal(result.protocol,3);
  assert.deepEqual(result.tables.trades.deleted,[gone]);assert.equal(result.tables.trades.rows.length,1);
  const merged=mergeJournalDelta(legacy,result);assert.deepEqual(merged.trades.map(row=>row.id),[tradeA]);assert.equal(merged._protocol,3);
 });
 await test('protocol-2 and unknown-version upgrades preserve deletion manifests too',async()=>{
  for(const protocol of [2,0,99]){
   const manifest={...journalManifest(legacy),_protocol:protocol};const result=await sync(manifest);
   assert.deepEqual(result.tables.trades.deleted,[gone]);assert.equal(result.tables.trades.rows.length,1);
   assert.deepEqual(mergeJournalDelta(legacy,result).trades.map(row=>row.id),[tradeA]);
  }
 });
 await test('first-time metadata hydration preserves all existing review assessment scores',async()=>{
  const result=await sync({});const review=result.tables.trade_reviews.rows[0];
  assert.deepEqual([review.execution_score,review.adherence_score,review.psychology_score],[5,4,3]);
 });
 snapshot=mergeJournalDelta({},await sync({}));
 await test('current-protocol repeated sync is empty and never duplicates or changes cached records',async()=>{
  for(let i=0;i<5;i++){const result=await sync(journalManifest(snapshot));noChanges(result);assert.deepEqual(mergeJournalDelta(snapshot,result),snapshot);}
 });
 await test('legacy references stay byte-identical across projection upgrade and hydrate without cloud downloads',async()=>{
  for(const [table,record] of [['trades',tradeA],['trade_reviews',reviewA],['premarket_markups',markupA]]){
   const media=snapshot[table].find(row=>row.id===record).screenshots;
   assert.deepEqual(media,legacy[table].find(row=>row.id===record).screenshots);
   assert.deepEqual(await resolveImageReferences(media,value=>readImage(imageReference(value))),shots);
  }
 });
 await test('period review metadata is marked unloaded and retains scope completion without exposing the body',()=>{
  const period=snapshot.period_reviews[0];assert.equal(period.content_loaded,false);
  assert.deepEqual(period.content,{accountScopes:{[accountA]:{completed:true},[accountB]:{completed:false}}});
  assert.equal(period.content.notes,undefined);assert.equal(period.content.embedded,undefined);
 });
 await test('the actual frontend lazy-content loader recovers the full original period body through owner RLS',async()=>{
  const store=new Map();const cache=createPrivateCache({read:async key=>store.get(key),write:async(key,value,valid)=>{if(valid())store.set(key,value);},clear:async()=>store.clear(),evict:async()=>store.clear()});
  await cache.activate(alice);let reads=0;
  const transport={from(table){assert.equal(table,'period_reviews');const filters={};return{select(columns){assert.equal(columns,'content,updated_at');const chain={eq(key,value){filters[key]=value;return chain;},async single(){reads++;const row=await one('select to_jsonb(t) data from public.period_reviews t where id=$1 and user_id=$2',[filters.id,filters.user_id]);return row?{data:row.data,error:null}:{data:null,error:{message:'Review unavailable'}};}};return chain;}};}};
  const source=(await readFile(path.join(root,'src/journalCloudCache.js'),'utf8')).split('export async function loadPeriodReviewContent')[1];
  const load=new Function('privateCache','supabase','async function loadPeriodReviewContent'+source+';return loadPeriodReviewContent;')(cache,transport);
  const row=snapshot.period_reviews[0];const record={id:row.id,updatedAt:row.updated_at};
  assert.deepEqual(await load(record),body);assert.deepEqual(await load(record),body);assert.equal(reads,1);
  await assert.rejects(()=>load({...record,updatedAt:'stale-revision'}),/changed in another tab/);
  await cache.activate(bob);await become(bob);await assert.rejects(()=>load(record),/unavailable/);await become(alice);
 });
 await test('the frontend image cache survives the projection change and deduplicates parallel/repeated reads',async()=>{
  const store=new Map();const cache=createPrivateCache({read:async key=>store.get(key),write:async(key,value,valid)=>{if(valid())store.set(key,value);},clear:async()=>store.clear(),evict:async()=>{}});await cache.activate(alice);let reads=0;
  const old=legacy.trades.find(row=>row.id===tradeA).screenshots.entry[0].src;
  const current=snapshot.trades[0].screenshots.entry[0].src;assert.equal(old,current);
  const load=source=>cache.get(source,()=>loadRevisionedImage(source,{readImage:async ref=>{reads++;return readImage(ref);},refreshMetadata:async()=>snapshot}));
  assert.deepEqual(await Promise.all([load(old),load(current),load(current)]),[image,image,image]);
  for(let i=0;i<5;i++)assert.equal(await load(current),image);assert.equal(reads,1);
 });
 await test('account image bytes are omitted from normal metadata but remain readable by their owner',async()=>{
  assert.equal(Object.hasOwn(snapshot.accounts[0],'profile_image'),false);
  assert.equal((await one('select profile_image from public.accounts where id=$1',[accountA])).profile_image,image);
 });
 await test('anonymous calls and authenticated calls without a user fail',async()=>{
  await become(null,'anon');await assert.rejects(()=>sync({}),error=>error.code==='42501');
  await become(null);await assert.rejects(()=>sync({}),/Authentication required/);await become(alice);
 });
 await test('cross-user sync and forged screenshot row IDs do not disclose another user\'s content',async()=>{
  const ref=imageReference(snapshot.trades[0].screenshots.entry[0].src);
  await become(bob);const other=await sync(journalManifest(snapshot));
  for(const table of JOURNAL_TABLES)for(const row of other.tables[table].rows)assert.equal(row.user_id,bob);
  assert.equal(await readImage(ref),null);await become(alice);
  assert.equal(await readImage({...ref,id:tradeB}),null);
 });
 await test('malformed manifests retain Migration 10 fail-closed behavior',async()=>{
  for(const manifest of [[],7,'bad',{_protocol:3,trades:[]},{_protocol:3,trades:null}])await assert.rejects(()=>sync(manifest),error=>error.code==='22023');
 });
 await test('optional table absence remains unavailable rather than a successful empty replacement',async()=>{
  await become(null,null);await db.exec('begin');
  try{await db.exec('alter table public.finance_movements rename to audit_absent_movements');await become(alice);assert.deepEqual((await sync({})).tables.finance_movements,{rows:[],deleted:[],available:false});}
  finally{await db.exec('rollback');await become(alice);}
 });
 await test('large cold metadata synchronization returns every historical row, followed by an empty warm sync',async()=>{
  await become(bob);await q("insert into public.trades(account_id,user_id,trade_date,asset) select $1,$2,'2020-01-01','EUR/USD' from generate_series(1,1203)",[accountB,bob]);
  const result=await sync({});assert.equal(result.tables.trades.rows.length,1204);noChanges(await sync(journalManifest(mergeJournalDelta({},result))));await become(alice);
 });
 await test('restoring the captured prior sync definition rolls back the protocol without altering any records',async()=>{
  await become(null,null);const before=await raw();await db.exec(oldSync);assert.deepEqual(await raw(),before);
  await become(alice);const result=await sync({});assert.equal(result.protocol,undefined);assert.deepEqual(result.tables.period_reviews.rows[0].content,body);
  assert.equal(result.tables.accounts.rows[0].profile_image,image);
  await become(null,null);await apply(process.argv[3]||path.join(root,'supabase/journal_egress_hardening.sql'));assert.deepEqual(await raw(),before);
 });
}finally{await db.close();}

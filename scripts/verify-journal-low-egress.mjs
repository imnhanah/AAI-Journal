// Local-only PostgreSQL regression review for migrations 01–10.
// Supply a separately installed @electric-sql/pglite entry point as argv[2].
// Optional argv[3] tests an archived Migration 10. No hosted client is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {JOURNAL_TABLES,journalManifest,mergeJournalDelta,imageReference,resolveImageReferences} from '../src/journalDelta.js';
import {loadRevisionedImage} from '../src/journalImageLoader.js';
import {createPrivateCache} from '../src/privateCache.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const {PGlite}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'@electric-sql/pglite');
const db=new PGlite();
const query=(sql,args)=>db.query(sql,args);
const one=async(sql,args)=>(await query(sql,args)).rows[0];
const apply=async file=>db.exec((await readFile(file,'utf8')).replace(/^create extension if not exists pgcrypto;/gim,''));
const uuid=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [alice,bob,accountA,accountB,tradeA,tradeB,markupA,markupB,reviewA,reviewB,ruleA,ruleB,balanceA,balanceB]=Array.from({length:14},(_,i)=>uuid(i+1));
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQLsAAAAASUVORK5CYII=';
const screenshots={
 entry:[image,{src:image,caption:'Original caption'}],exit:[],
 sessionReview:{marketOutcome:'Trending',notes:'Keep this review'},
 odd:{'quoted " / { key':image},
 shared:'tj-trade-media:synthetic-existing-reference',
 caseStudy:'tj-case-study-media:synthetic-existing-reference',
 storage:`tj-case-study-storage:${alice}/existing.png`,
 remote:'https://example.test/synthetic.png',missing:null,
};
const sourceScreenshots=new Map([['trades',screenshots],['premarket_markups',screenshots],['trade_reviews',screenshots]]);
const ids={trades:tradeA,premarket_markups:markupA,trade_reviews:reviewA};
const become=async(user,role='authenticated')=>{
 await db.exec('reset role');
 await query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);
 if(role)await db.exec(`set role ${role}`);
};
const sync=async known=>(await one('select public.tj_sync_journal($1::jsonb) as data',[JSON.stringify(known??{})])).data;
const readImage=async ref=>(await one('select public.tj_journal_image($1,$2,$3,$4) as data',[ref.table,ref.id,ref.path,ref.version])).data;
const noChanges=delta=>{for(const table of JOURNAL_TABLES){assert.deepEqual(delta.tables[table].rows,[],table);assert.deepEqual(delta.tables[table].deleted,[],table);}};
const userIndexes=async table=>(await one(`select count(*)::int as count
 from pg_index i join pg_class c on c.oid=i.indexrelid join pg_am am on am.oid=c.relam
 join pg_attribute a on a.attrelid=i.indrelid and a.attname='user_id'
 where i.indrelid=to_regclass($1) and i.indisvalid and i.indisready
 and i.indpred is null and i.indexprs is null and am.amname='btree' and i.indkey[0]=a.attnum`,['public.'+table])).count;
let cold,snapshot,known;
const before={},indexesBefore={};

try {
 await apply(path.join(root,'scripts/membership-security-fixture.sql'));
 // These are the ONLY application migrations installed by this verifier.
 for(const file of ['schema.sql','trade_close_timing_migration.sql','finance_migration.sql',
  'multi_balance_workspaces_migration.sql','savings_account_scope_migration.sql','challenge_migration.sql',
  'challenge_modes_migration.sql','backtest_accounts.sql','economic_calendar_cache_migration.sql'])await apply(path.join(root,'supabase',file));
 for(const [id,email] of [[alice,'alice@example.test'],[bob,'bob@example.test']])await query('insert into auth.users(id,email) values($1,$2)',[id,email]);
 for(const [user,account,trade,markup,review,rule,balance] of [
  [alice,accountA,tradeA,markupA,reviewA,ruleA,balanceA],
  [bob,accountB,tradeB,markupB,reviewB,ruleB,balanceB],
 ]) {
  await query('insert into public.accounts(id,user_id,name,profile_image) values($1,$2,$3,$4)',[account,user,'Synthetic workspace',image]);
  await query('insert into public.trades(id,account_id,user_id,trade_date,asset,screenshots) values($1,$2,$3,$4,$5,$6)',[trade,account,user,'2026-10-12','EUR/USD',JSON.stringify(screenshots)]);
  await query('insert into public.premarket_markups(id,account_id,user_id,markup_date,screenshots) values($1,$2,$3,$4,$5)',[markup,account,user,'2026-10-12',JSON.stringify(screenshots)]);
  await query('insert into public.trade_reviews(id,account_id,user_id,trade_id,review_date,screenshots) values($1,$2,$3,$4,$5,$6)',[review,account,user,trade,'2026-10-12',JSON.stringify(screenshots)]);
  await query('insert into public.rules(id,account_id,user_id,rule_text) values($1,$2,$3,$4)',[rule,account,user,'Synthetic rule']);
  await query('insert into public.journal_entries(account_id,user_id,rule_id,entry_date) values($1,$2,$3,$4)',[account,user,rule,'2026-10-12']);
  await query('insert into public.period_reviews(account_id,user_id,period_type,period_key,content) values($1,$2,$3,$4,$5)',[account,user,'monthly','2026-10',JSON.stringify({notes:'Synthetic original',image})]);
  await query('insert into public.finance_settings(account_id,user_id,enabled) values($1,$2,true)',[account,user]);
  await query('insert into public.workspace_balances(id,workspace_id,user_id,name) values($1,$2,$3,$4)',[balance,account,user,'Synthetic balance']);
  await query('insert into public.savings_accounts(account_id,user_id,name,balance_id) values($1,$2,$3,$4)',[account,user,'Synthetic savings',balance]);
  await query('insert into public.finance_movements(account_id,user_id,movement_type,amount,movement_date) values($1,$2,$3,10,$4)',[account,user,'deposit','2026-10-12']);
  await query('insert into public.trade_balance_results(trade_id,balance_id,user_id) values($1,$2,$3)',[trade,balance,user]);
 }
 for(const table of JOURNAL_TABLES){
  before[table]=(await query(`select to_jsonb(t) as data from public.${table} t order by user_id`)).rows.map(row=>row.data);
  indexesBefore[table]=await userIndexes(table);
  await test(`01–09 schema assumptions: ${table}`,async()=>{
   const key=table==='user_settings'?'user_id':table==='finance_settings'?'account_id':'id';
   const columns=(await query('select column_name,data_type,is_nullable from information_schema.columns where table_schema=\'public\' and table_name=$1',[table])).rows;
   assert.deepEqual(columns.find(c=>c.column_name==='user_id'),{column_name:'user_id',data_type:'uuid',is_nullable:'NO'});
   assert.equal(columns.find(c=>c.column_name===key)?.data_type,'uuid');
   const pk=(await one(`select array_agg(a.attname order by k.n) as keys from pg_constraint c
    cross join lateral unnest(c.conkey) with ordinality k(attnum,n)
    join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum
    where c.contype='p' and c.conrelid=to_regclass($1)`,['public.'+table])).keys;
   assert.deepEqual(pk,[key]);
   assert.equal((await one('select relrowsecurity as rls from pg_class where oid=to_regclass($1)',['public.'+table])).rls,true);
   if(['trades','premarket_markups','trade_reviews'].includes(table))assert.equal(columns.find(c=>c.column_name==='screenshots')?.data_type,'jsonb');
  });
 }
 const notifications=[];
 const stopListening=await db.listen('pgrst',payload=>notifications.push(payload));
 try{await apply(process.argv[3]||path.join(root,'supabase/journal_low_egress_migration.sql'));}
 finally{await stopListening();}
 await test('Migration 10 requests a PostgREST schema-cache reload at commit',()=>{
  assert.deepEqual(notifications,['reload schema']);
 });
 await test('Migration 10 preserves every pre-existing row, original field, and screenshot byte',async()=>{
  for(const table of JOURNAL_TABLES){
   const after=(await query(`select to_jsonb(t) as data from public.${table} t order by user_id`)).rows.map(row=>row.data);
   assert.equal(after.length,before[table].length);
   assert.deepEqual(after.map((row,i)=>Object.fromEntries(Object.keys(before[table][i]).map(key=>[key,row[key]]))),before[table],table);
   const column=await one('select data_type,is_nullable,column_default from information_schema.columns where table_schema=\'public\' and table_name=$1 and column_name=\'updated_at\'',[table]);
   assert.equal(column.data_type,'timestamp with time zone');assert.equal(column.is_nullable,'NO');assert.ok(column.column_default);
  }
 });
 await test('owner indexes exist without duplicating usable indexes from 01–09',async()=>{
  for(const table of JOURNAL_TABLES)assert.equal(await userIndexes(table),Math.max(indexesBefore[table],1),table);
 });
 await test('RPCs are invoker-only, fixed-path, authenticated-only, and retain helper EXECUTE',async()=>{
  for(const signature of ['tj_sync_journal(jsonb)','tj_journal_image(text,uuid,text[],text)','tj_image_references(jsonb,uuid,text,text,text,text[])']){
   const fn=await one('select prosecdef,proconfig from pg_proc where oid=($1::regprocedure)',['public.'+signature]);
   assert.equal(fn.prosecdef,false);assert.ok(fn.proconfig.some(value=>value.startsWith('search_path=')));
   for(const role of ['anon','authenticated'])assert.equal((await one('select has_function_privilege($1,$2,\'execute\') allowed',[role,'public.'+signature])).allowed,role==='authenticated');
  }
 });
 await test('anonymous calls and authenticated-role calls without a user are rejected',async()=>{
  await become(null,'anon');
  await assert.rejects(()=>sync({}),error=>error.code==='42501');
  await assert.rejects(()=>readImage({table:'trades',id:tradeA,path:['entry','0'],version:'anything'}),error=>error.code==='42501');
  await assert.rejects(()=>query('select public.tj_image_references($1,$2,$3,$4,$5)',[JSON.stringify(image),alice,'trades',tradeA,'v']),error=>error.code==='42501');
  await become(null);
  await assert.rejects(()=>sync({}),/Authentication required/);
  await assert.rejects(()=>readImage({table:'trades',id:tradeA,path:[],version:'x'}),/Authentication required/);
 });
 await become(alice);
 await test('cold synchronization returns all 13 tables, special primary keys, and only the caller',async()=>{
  cold=await sync({});snapshot=mergeJournalDelta({},cold);known=journalManifest(snapshot);
  assert.deepEqual(Object.keys(cold.tables).sort(),[...JOURNAL_TABLES].sort());
  for(const table of JOURNAL_TABLES){assert.equal(cold.tables[table].available,true);assert.equal(cold.tables[table].rows.length,1,table);assert.equal(cold.tables[table].rows[0].user_id,alice);assert.deepEqual(cold.tables[table].deleted,[]);}
  assert.ok(known.user_settings[alice]);assert.ok(known.finance_settings[accountA]);assert.equal(snapshot._protocol,1);
 });
 await test('unchanged repeated sync produces no changed rows/deletions and preserves the snapshot',async()=>{
  for(let i=0;i<5;i++){
   const delta=await sync(known);noChanges(delta);
   assert.deepEqual(mergeJournalDelta(snapshot,delta),snapshot);
  }
 });
 await test('references preserve shape, captions, session review, existing private references, and exact JSON paths',async()=>{
  for(const table of sourceScreenshots.keys()){
   const media=snapshot[table][0].screenshots;
   const ref=imageReference(media.entry[1].src);
   assert.deepEqual([ref.user,ref.table,ref.id,ref.path],[alice,table,ids[table],['entry','1','src']]);
   assert.deepEqual(imageReference(media.odd['quoted " / { key']).path,['odd','quoted " / { key']);
   assert.equal(media.entry[1].caption,screenshots.entry[1].caption);
   assert.deepEqual(media.sessionReview,screenshots.sessionReview);assert.deepEqual(media.exit,[]);
   for(const field of ['shared','caseStudy','storage','remote','missing'])assert.deepEqual(media[field],screenshots[field]);
   const hydrated=await resolveImageReferences(media,async value=>readImage(imageReference(value)));
   assert.deepEqual(hydrated,screenshots);
  }
 });
 await test('a parent JSON path cannot retrieve an entire screenshot collection',async()=>{
  const ref=imageReference(snapshot.trades[0].screenshots.entry[0]);
  assert.equal(await readImage({...ref,path:[]}),null);
  assert.equal(await readImage({...ref,path:['entry']}),null);
  assert.equal(await readImage({...ref,path:['entry','1']}),null);
  assert.equal(await readImage({...ref,path:['sessionReview']}),null);
  assert.equal(await readImage({...ref,path:['entry','1','caption']}),null);
  assert.equal(await readImage({...ref,path:['storage']}),null);
  assert.equal(await readImage({...ref,path:['missing']}),null);
  assert.equal(await readImage({...ref,path:['not-present']}),null);
  assert.equal(await readImage(ref),image);
 });
 await test('a legacy scalar screenshot still resolves using its empty root path',async()=>{
  await query('insert into public.trades(id,account_id,user_id,trade_date,asset,screenshots) values($1,$2,$3,$4,$5,$6)',[uuid(40),accountA,alice,'2026-10-12','EUR/USD',JSON.stringify(image)]);
  const delta=await sync(known);const row=delta.tables.trades.rows.find(row=>row.id===uuid(40));
  const ref=imageReference(row.screenshots);assert.deepEqual(ref.path,[]);assert.equal(await readImage(ref),image);
  snapshot=mergeJournalDelta(snapshot,delta);known=journalManifest(snapshot);
 });
 await test('cross-user sync, forged row IDs, forged reference owners, and invalid table names do not disclose data',async()=>{
  const aliceRef=imageReference(snapshot.trades.find(row=>row.id===tradeA).screenshots.entry[0]);
  await become(bob);
  const other=await sync(known);
  for(const table of JOURNAL_TABLES)for(const row of other.tables[table].rows)assert.equal(row.user_id,bob);
  assert.equal(await readImage(aliceRef),null);
  assert.equal(await readImage({...aliceRef,id:tradeA,user:bob}),null);
  await become(alice);
  assert.equal(await readImage({...aliceRef,id:tradeB}),null);
  await assert.rejects(()=>readImage({...aliceRef,table:'trades; select * from profiles'}),/Invalid screenshot table/);
 });
 await test('direct helper execution transforms only supplied JSON and cannot authorize a forged reference',async()=>{
  const transformed=(await one('select public.tj_image_references($1,$2,$3,$4,$5) as data',[JSON.stringify(image),bob,'trades',tradeB,'forged-version'])).data;
  assert.equal(imageReference(transformed).user,bob);
  assert.equal(await readImage(imageReference(transformed)),null);
 });
 await test('authenticated helper EXECUTE is required by the invoker sync RPC',async()=>{
  await become(null,null);await db.exec('begin');
  try{
   await db.exec('revoke execute on function public.tj_image_references(jsonb,uuid,text,text,text,text[]) from authenticated');
   await become(alice);
   await assert.rejects(()=>sync({}),error=>error.code==='42501');
  }finally{await db.exec('rollback');await become(alice);}
  assert.ok((await sync({})).tables.trades.rows.length);
 });
 await test('missing table SELECT privileges fail closed without bypassing RLS or mutating cached data',async()=>{
  const original=structuredClone(snapshot);
  await become(null,null);await db.exec('begin');
  try{
   await db.exec('revoke select on public.trades from authenticated');await become(alice);
   await assert.rejects(()=>sync(known),error=>error.code==='42501');
  }finally{await db.exec('rollback');await become(alice);}
  assert.deepEqual(snapshot,original);
 });
 await test('each journal update gets a server revision after legacy BEFORE triggers',async()=>{
  for(const table of JOURNAL_TABLES){
   const key=table==='user_settings'?'user_id':table==='finance_settings'?'account_id':'id';
   const id=snapshot[table][0][key];
   const start=(await one(`select updated_at::text stamp from public.${table} where ${key}=$1`,[id])).stamp;
   await new Promise(resolve=>setTimeout(resolve,5));
   const changed=(await one(`update public.${table} set updated_at='2000-01-01' where ${key}=$1 returning updated_at::text stamp`,[id])).stamp;
   assert.ok(Date.parse(changed)>Date.parse(start),table);
   const delta=await sync(known);assert.equal(delta.tables[table].rows.length,1,table);
   snapshot=mergeJournalDelta(snapshot,delta);known=journalManifest(snapshot);
   noChanges(await sync(known));
  }
  await db.exec('begin');
  try{
   const first=(await one('update public.trades set context=\'first\' where id=$1 returning updated_at::text stamp',[tradeA])).stamp;
   await new Promise(resolve=>setTimeout(resolve,5));
   const second=(await one('update public.trades set context=\'second\' where id=$1 returning updated_at::text stamp',[tradeA])).stamp;
   assert.ok(Date.parse(second)>Date.parse(first),'clock time, not the transaction start time, controls revisions');
  }finally{await db.exec('rollback');}
 });
 await test('text-only edits retain image revisions and a shared cache avoids another image RPC',async()=>{
  const row=snapshot.trades.find(row=>row.id===tradeA);const ref=row.screenshots.entry[0];
  const saved=new Map();let reads=0;
  const cache=createPrivateCache({read:async key=>saved.get(key),write:async(key,value,valid)=>{if(valid())saved.set(key,value);},clear:async()=>saved.clear(),evict:async()=>{}});
  await cache.activate(alice);
  const load=()=>cache.get(ref,()=>loadRevisionedImage(ref,{readImage:async parsed=>{reads++;return readImage(parsed);},refreshMetadata:async()=>mergeJournalDelta(snapshot,await sync(known))}));
  assert.deepEqual(await Promise.all([load(),load(),load()]),[image,image,image]);
  await query('update public.trades set context=$1 where id=$2',['Text-only synthetic change',tradeA]);
  const delta=await sync(known);const fresh=delta.tables.trades.rows.find(row=>row.id===tradeA);
  assert.equal(fresh.screenshots.entry[0],ref);
  for(let i=0;i<5;i++)assert.equal(await load(),image);
  assert.equal(reads,1);
  snapshot=mergeJournalDelta(snapshot,delta);known=journalManifest(snapshot);
  await cache.activate(bob);assert.equal(saved.size,0);
 });
 await test('stale screenshot revisions return null and the frontend refreshes only that same record/path',async()=>{
  const old=snapshot.trades.find(row=>row.id===tradeA).screenshots.entry[0];
  const revised={...screenshots,entry:[image.replace('image/png','image/png;charset=utf-8'),screenshots.entry[1]]};
  await query('update public.trades set screenshots=$1 where id=$2',[JSON.stringify(revised),tradeA]);
  assert.equal(await readImage(imageReference(old)),null);
  let refreshes=0;
  const hydrated=await loadRevisionedImage(old,{readImage,refreshMetadata:async()=>{refreshes++;const delta=await sync(known);snapshot=mergeJournalDelta(snapshot,delta);known=journalManifest(snapshot);return snapshot;}});
  assert.equal(hydrated,revised.entry[0]);assert.equal(refreshes,1);
  await query('update public.trades set screenshots=$1 where id=$2',[JSON.stringify(screenshots),tradeA]);
  snapshot=mergeJournalDelta(snapshot,await sync(known));known=journalManifest(snapshot);
 });
 await test('recovery hydration retrieves each source image exactly and does not rewrite stored media',async()=>{
  for(const table of sourceScreenshots.keys()){
   const row=snapshot[table].find(row=>row.id===ids[table]);
   const restored=await resolveImageReferences(row.screenshots,source=>loadRevisionedImage(source,{readImage,refreshMetadata:async()=>snapshot}));
   assert.deepEqual(restored,screenshots);
   assert.deepEqual((await one(`select screenshots as media from public.${table} where id=$1`,[ids[table]])).media,screenshots);
  }
 });
 await test('deletions include ordinary and nonstandard primary keys; account cascades reconcile locally',async()=>{
  await query('delete from public.finance_settings where account_id=$1',[accountA]);
  // Migration 01 intentionally has no user_settings DELETE policy. Model a
  // privileged remote deletion without weakening that client restriction.
  assert.deepEqual((await query('delete from public.user_settings where user_id=$1 returning user_id',[alice])).rows,[]);
  await become(null,null);
  await query('delete from public.user_settings where user_id=$1',[alice]);
  await become(alice);
  let delta=await sync(known);
  assert.deepEqual(delta.tables.finance_settings.deleted,[accountA]);assert.deepEqual(delta.tables.user_settings.deleted,[alice]);
  snapshot=mergeJournalDelta(snapshot,delta);known=journalManifest(snapshot);
  await query('delete from public.accounts where id=$1',[accountA]);
  delta=await sync(known);
  for(const table of JOURNAL_TABLES){assert.equal(delta.tables[table].rows.length,0,table);assert.deepEqual(new Set(delta.tables[table].deleted),new Set(Object.keys(known[table])),table);}
  snapshot=mergeJournalDelta(snapshot,delta);known=journalManifest(snapshot);noChanges(await sync(known));
  for(const table of JOURNAL_TABLES)assert.deepEqual(snapshot[table],[]);
 });
 await test('optional tables missing return unavailable, while missing required tables fail closed',async()=>{
  for(const table of ['period_reviews','finance_settings','savings_accounts','finance_movements','workspace_balances','trade_balance_results','trades']){
   await become(null,null);await db.exec('begin');
   try{
    await db.exec(`alter table public.${table} rename to audit_missing_${table}`);await become(alice);
    if(table==='trades')await assert.rejects(()=>sync(known),/Required journal table missing: trades/);
    else{
     const delta=await sync(known);assert.deepEqual(delta.tables[table],{rows:[],deleted:[],available:false});
     assert.equal(mergeJournalDelta(snapshot,delta)[table],null);
    }
   }finally{await db.exec('rollback');await become(alice);}
  }
 });
 await test('malformed manifests are rejected explicitly without a partial response or cache changes',async()=>{
  for(const value of [[],42,'invalid',{trades:[]},{trades:null}])await assert.rejects(()=>sync(value),error=>error.code==='22023');
  const sqlNull=(await one('select public.tj_sync_journal(null) as data')).data;
  noChanges(sqlNull);assert.deepEqual(snapshot,mergeJournalDelta(snapshot,await sync(known)));
 });
 await test('first synchronization includes more than 1,000 historical records and warm sync sends none',async()=>{
  await become(bob);
  await query(`insert into public.trades(account_id,user_id,trade_date,asset,pnl)
    select $1,$2,'2020-01-01','EUR/USD',case when n%2=0 then 20 else -10 end from generate_series(1,1203) n`,[accountB,bob]);
  const initial=await sync({});const raw=await one('select count(*)::int count,sum(pnl)::text pnl from public.trades where user_id=$1',[bob]);
  assert.equal(initial.tables.trades.rows.length,raw.count);assert.ok(raw.count>1203);
  assert.equal(initial.tables.trades.rows.reduce((sum,row)=>sum+Number(row.pnl),0),Number(raw.pnl));
  noChanges(await sync(journalManifest(mergeJournalDelta({},initial))));
 });
 await test('Migration 10 rerun is local/idempotent and preserves rows, permissions, and usable indexes',async()=>{
  await become(null,null);
  const saved=(await one('select jsonb_agg(to_jsonb(t) order by id) data from public.trades t')).data;
  const counts=Object.fromEntries(await Promise.all(JOURNAL_TABLES.map(async table=>[table,await userIndexes(table)])));
  await apply(process.argv[3]||path.join(root,'supabase/journal_low_egress_migration.sql'));
  assert.deepEqual((await one('select jsonb_agg(to_jsonb(t) order by id) data from public.trades t')).data,saved);
  for(const table of JOURNAL_TABLES)assert.equal(await userIndexes(table),counts[table]);
  await become(bob);const initial=await sync({});noChanges(await sync(journalManifest(mergeJournalDelta({},initial))));
 });
}finally{await db.close();}

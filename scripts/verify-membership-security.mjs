import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Install @electric-sql/pglite separately and supply its entry point as argv[2].
const { PGlite } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : '@electric-sql/pglite');
const db = new PGlite();
const sql = (statement, args) => db.query(statement, args);
const apply = async (file, transform = value => value) => {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  try { await db.exec(transform(source).replace(/^create extension if not exists pgcrypto;/gim, '')); }
  catch (error) { throw new Error(`${file}: ${error.message}`); }
};
const id = number => `10000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const [owner, free, admin, otherAdmin, restricted] = [1, 2, 3, 4, 5].map(id);
const become = async (user, role = 'authenticated') => {
  await db.exec('reset role');
  await sql("select set_config('request.jwt.claim.sub', $1, false)", [user || '']);
  if (role) await db.exec(`set role ${role}`);
};
const one = async (statement, args) => (await sql(statement, args)).rows[0];
const denial = (fn, code = '42501') => assert.rejects(fn, error => error.code === code);
const assignment = (target, from, oldFlag, to, flag) => one('select * from public.tj_change_membership($1,$2,$3,$4,$5)', [target, from, oldFlag, to, flag]);
const data = { name:'Sample test', instrument:'EUR/USD', startingBalance:10000, tradeTarget:10, currency:'USD', riskPct:1 };
const saveRun = (runId, updatedAt, settings = data, remove = false) =>
  sql('select public.tj_save_backtest_run($1,$2,$3,$4) as saved', [runId, updatedAt, settings, remove]);
const saveLibrary = (revision, library) => one('select * from public.tj_save_profile_case_study_library($1,$2)', [revision, library]);
const image = user => `${user}/sample.png`;

try {
  await apply('scripts/membership-security-fixture.sql');
  await apply('supabase/schema.sql');
  await db.exec('alter table public.profiles add column cloud_sync_enabled boolean not null default false');
  for (const file of [
    'challenge_migration.sql', 'finance_migration.sql', 'multi_balance_workspaces_migration.sql', 'backtest_accounts.sql',
    'profile_case_study_library_concurrency_install.sql', 'case_study_evidence_storage.sql',
    'membership_authorization_foundation.sql', 'case_study_evidence_owner_upload_activation.sql',
    'membership_entitlements_preview.sql', 'membership_administration.sql',
  ]) await apply(`supabase/${file}`);

  for (const [index, user] of [owner, free, admin, otherAdmin, restricted].entries()) {
    await sql('insert into auth.users(id,email) values ($1,$2)', [user, `synthetic-${index}@example.test`]);
  }
  await sql('insert into public.tj_memberships(user_id,membership) values ($1,\'owner\'),($2,\'owner\')', [owner, restricted]);
  await sql('update public.profiles set cloud_sync_enabled=true where id in ($1,$2)', [owner, free]);
  await sql('insert into tj_administration.administrators(user_id) values ($1),($2)', [admin, otherAdmin]);
  const flags = async user => { await become(user); return one('select * from public.tj_current_entitlements()'); };
  assert.deepEqual(await flags(owner), { membership:'owner', cloud_writes_allowed:true });
  assert.deepEqual(await flags(free), { membership:'free', cloud_writes_allowed:false });
  assert.deepEqual(await flags(restricted), { membership:'owner', cloud_writes_allowed:false });
  assert.deepEqual(await flags(admin), { membership:'free', cloud_writes_allowed:false });

  await become(free);
  await sql('insert into public.accounts(id,user_id,name) values ($1,$2,$3)', [id(20), free, 'Existing Free journal']);
  const freeRun = (await saveRun(id(21), null)).rows[0].saved;
  await sql('select public.tj_save_backtest_trade($1,$2,$3,$4,$5)', [
    id(25), id(21), null, {asset:'EUR/USD'}, {entry:[{src:'data:image/png;base64,AA=='}]},
  ]);
  await saveLibrary(null, { version:1, evidence:[{ id:'legacy' }] });
  await become(owner);
  await sql("insert into storage.objects(bucket_id,name) values ('case-study-evidence',$1)", [image(owner)]);
  await become(null, null);
  await sql("insert into storage.objects(bucket_id,name) values ('case-study-evidence',$1)", [image(free)]);

  await apply('supabase/membership_cloud_write_enforcement.sql');
  await apply('supabase/membership_journal_promotion.sql');
  const publish = (rows, library, preview) => one(
    'select public.tj_publish_device_journal($1,$2,$3) as result',[rows,library,preview]);
  const promoted = {accounts:[{id:id(80),name:'Device journal'}],
    workspace_balances:[{id:id(81),workspace_id:id(80),name:'Main'}],
    backtest_runs:[{id:id(82),settings:data}],
    backtest_trades:[{id:id(83),run_id:id(82),trade_data:{asset:'EUR/USD'},screenshots:{entry:[{src:'private-media'}]}}],
    user_settings:[{user_id:owner,custom_type_tags:['Momentum'],custom_mistake_tags:[],
      custom_confluence_sessions:['London'],custom_instruments:['EUR/USD']}]};
  await become(free);
  await denial(() => publish(promoted,null,true));
  await denial(() => publish(promoted,null,false));
  await become(restricted);
  await denial(() => publish(promoted,null,false));
  await become(owner);
  assert.deepEqual((await publish(promoted,null,true)).result.conflicts,[]);
  assert.equal((await one('select count(*)::integer as count from public.accounts where id=$1',[id(80)])).count,0);
  await publish(promoted,null,false);
  await publish(promoted,null,false);
  await denial(() => publish({rules:[{id:id(85),account_id:id(20),rule_text:'Foreign parent'}]},null,false),'23503');
  assert.equal((await one('select count(*)::integer as count from public.accounts where id=$1',[id(80)])).count,1);
  assert.deepEqual((await one('select custom_confluence_sessions from public.user_settings')).custom_confluence_sessions,['London']);
  const collision = {accounts:[{id:id(84),name:'Must roll back'},{id:id(80),name:'Changed elsewhere'}]};
  assert.equal((await publish(collision,null,true)).result.conflicts[0].table,'accounts');
  await denial(() => publish(collision,null,false),'PT409');
  assert.equal((await one('select count(*)::integer as count from public.accounts where id=$1',[id(84)])).count,0);
  const draftLibrary = {version:1,studies:[{id:'device-study',title:'A device study'}]};
  await publish({},draftLibrary,false);
  await publish({},draftLibrary,false);
  assert.equal((await publish({}, {version:1}, true)).result.conflicts[0].revision,1);
  await denial(() => publish({}, {version:1}, false),'PT409');
  await become(null,null);
  await apply('supabase/membership_journal_promotion_rollback.sql');

  const guardedTables = (await sql(`select tablename from pg_policies where schemaname='public'
    and policyname in ('tj_cloud_insert','tj_cloud_update','tj_cloud_delete','tj_anon_insert','tj_anon_update','tj_anon_delete')
    group by tablename having count(*)=6 order by tablename`)).rows.map(row => row.tablename);
  assert.deepEqual(guardedTables, [
    'accounts','backtest_runs','backtest_trades','balance_challenge_progress','challenge_progress','finance_movements',
    'finance_settings','journal_entries','period_reviews','premarket_markups','profile_case_study_libraries',
    'rules','savings_accounts','trade_balance_results','trade_reviews','trades','user_settings','workspace_balances',
  ]);
  // Simulate a permissive future Storage policy to prove the restrictive
  // guard still composes with it.
  await db.exec(`create policy fixture_storage_update on storage.objects for update to authenticated
    using ((storage.foldername(name))[1] = auth.uid()::text)
    with check ((storage.foldername(name))[1] = auth.uid()::text)`);
  await become(null, 'anon');
  await denial(() => sql('select public.tj_current_entitlements()'));
  await denial(() => sql('select public.tj_list_membership_accounts()'));
  await denial(() => sql('insert into public.accounts(user_id,name) values ($1,$2)', [free, 'Denied']));
  await become(free);
  assert.equal((await one('select name from public.accounts where id=$1', [id(20)])).name, 'Existing Free journal');
  await denial(() => sql('insert into public.accounts(user_id,name) values ($1,$2)', [free, 'Denied']));
  await denial(() => sql('insert into public.accounts(id,user_id,name) values ($1,$2,$3) on conflict(id) do update set name=excluded.name', [id(20), free, 'Denied']));
  assert.equal((await sql('update public.accounts set name=$1 where id=$2', ['Denied', id(20)])).affectedRows, 0);
  assert.equal((await sql('delete from public.accounts where id=$1', [id(20)])).affectedRows, 0);
  await denial(() => saveRun(id(22), null));
  await denial(() => sql('select public.tj_save_backtest_trade($1,$2,$3,$4,$5)', [
    id(26), id(21), null, {asset:'EUR/USD'}, {},
  ]), 'P0001');
  await denial(() => saveRun(id(21), freeRun.updatedAt, data, true), 'P0001');
  assert.equal((await one('select count(*)::integer as count from public.backtest_runs')).count, 1);
  assert.equal((await one('select count(*)::integer as count from public.backtest_trades')).count, 1);
  await denial(() => saveLibrary(1, {version:1, evidence:[]}));
  await denial(() => sql('select * from tj_write_control.tj_save_profile_case_study_library(1,\'{}\')'));
  assert.equal((await one('select revision from public.profile_case_study_libraries')).revision, 1);
  assert.equal((await one('select name from storage.objects')).name, image(free));
  assert.equal((await sql("update storage.objects set name=$1 where name=$2", [`${free}/new.png`, image(free)])).affectedRows, 0);
  await denial(() => sql("insert into storage.objects(bucket_id,name) values ('case-study-evidence',$1)", [`${free}/new.png`]));
  await denial(() => sql('update public.profiles set cloud_sync_enabled=false where id=$1', [free]));
  await denial(() => sql("update public.tj_memberships set membership='owner' where user_id=$1", [free]));
  await denial(() => assignment(free, 'free', true, 'owner', true));

  await become(restricted);
  await denial(() => sql('insert into public.accounts(user_id,name) values ($1,$2)', [restricted, 'Denied']));
  await denial(() => saveLibrary(null, {version:1}));
  await denial(() => sql("insert into storage.objects(bucket_id,name) values ('case-study-evidence',$1)", [image(restricted)]));

  await become(owner);
  assert.equal((await one('select public.tj_is_membership_admin() as authorized')).authorized, false);
  await denial(() => sql('select * from public.tj_list_membership_accounts()'));
  await denial(() => assignment(free, 'free', true, 'owner', true));
  await denial(() => sql('insert into public.accounts(user_id,name) values ($1,$2)', [free, 'Wrong account']));
  await sql('insert into public.accounts(user_id,name) values ($1,$2)', [owner, 'Owner journal']);
  assert.equal((await saveLibrary(1, {version:1})).outcome, 'saved');
  assert.equal((await saveLibrary(null, {version:1})).outcome, 'conflict');
  assert.equal((await saveRun(id(30), null)).rows[0].saved.id, id(30));
  await sql("insert into storage.objects(bucket_id,name) values ('case-study-evidence',$1)", [`${owner}/new.png`]);
  await denial(() => sql("insert into storage.objects(bucket_id,name) values ('case-study-evidence',$1)", [`${free}/wrong.png`]));

  await become(admin);
  const listed = await one("select * from public.tj_list_membership_accounts('SYNTHETIC-1', null, 1)");
  assert.equal(listed.user_id, free);
  assert.equal(listed.cloud_writes_allowed, false);
  assert.equal(listed.cloud_flag, true);
  assert.equal((await sql("select * from public.tj_list_membership_accounts('', $1, 2)", [owner])).rows.length, 2);
  await denial(() => assignment(admin, 'free', false, 'owner', true));
  await denial(() => assignment(free, 'free', true, 'free', true), '22023');
  await denial(() => sql('insert into tj_administration.administrators(user_id) values ($1)', [free]));
  assert.equal((await assignment(free, 'free', true, 'owner', true)).cloud_writes_allowed, true);
  await denial(() => assignment(free, 'free', true, 'owner', false), 'PT409');
  assert.equal((await assignment(free, 'owner', true, 'free', false)).cloud_writes_allowed, false);
  await become(null, null);
  const history = (await sql('select actor,target,old_membership,new_membership,old_cloud_flag,new_cloud_flag from tj_administration.membership_audit order by id')).rows;
  assert.deepEqual(history.map(row => [row.actor,row.target,row.old_membership,row.new_membership,row.old_cloud_flag,row.new_cloud_flag]), [
    [admin,free,'free','owner',true,true], [admin,free,'owner','free',true,false],
  ]);
  await denial(() => sql("update auth.users set raw_user_meta_data=jsonb_build_object('dailyRoutine',true) where id=$1", [free]));
  await sql("update auth.users set raw_user_meta_data=jsonb_build_object('dailyRoutine',true) where id=$1", [owner]);
  await sql("update auth.users set raw_user_meta_data=jsonb_build_object('theme','dark') where id=$1", [free]);
  await assert.rejects(() => sql('delete from auth.users where id=$1', [admin]), /foreign key constraint/);
  await sql('delete from tj_administration.administrators where user_id=$1', [otherAdmin]);
  await denial(() => sql('delete from tj_administration.administrators where user_id=$1', [admin]));
  await denial(() => sql('truncate tj_administration.administrators'));
  await sql('insert into tj_administration.administrators(user_id) values ($1)', [otherAdmin]);
  await denial(() => sql('delete from tj_administration.administrators'));
  assert.equal((await one('select count(*)::integer as count from tj_administration.administrators')).count, 2);

  await apply('supabase/membership_cloud_write_rollback.sql');
  await become(free);
  assert.equal((await one('select name from public.accounts where id=$1', [id(20)])).name, 'Existing Free journal');
  assert.equal((await one('select name from storage.objects')).name, image(free));
  assert.equal((await saveLibrary(1, {version:1, evidence:[{id:'legacy'}]})).outcome, 'saved');
  assert.equal((await saveRun(id(23), null)).rows[0].saved.id, id(23));
  await sql('insert into public.accounts(user_id,name) values ($1,$2)', [free, 'After rollback']);
  await become(null, null);
  assert.equal((await one('select count(*)::integer as count from tj_administration.membership_audit')).count, 2);
  assert.equal((await one("select count(*)::integer as count from storage.objects where bucket_id='case-study-evidence'")).count, 3);
  await apply('supabase/membership_cloud_write_enforcement.sql');
  await become(free);
  await denial(() => saveLibrary(2, {version:1}));
  await become(null, null);
  await apply('supabase/membership_cloud_write_rollback.sql');
  console.log('Passed PostgreSQL role, entitlement, write policy, admin, audit, and rollback checks.');
} finally {
  await db.close();
}

-- Separate approval required. Permission rollback only; NO data/image deletion.
-- Restores the audited pre-release Storage INSERT policy. Leaves grant/audit
-- evidence and all functions in place; restores neither memberships nor data.
begin;
do $$
declare t record;
begin
 for t in select n.nspname schema_name,c.relname table_name from pg_trigger g join pg_class c on c.oid=g.tgrelid join pg_namespace n on n.oid=c.relnamespace where g.tgname='tj_image_binary_guard' and g.tgfoid='tj_images.guard_binary_write()'::regprocedure
 loop execute format('drop trigger tj_image_binary_guard on %I.%I',t.schema_name,t.table_name);end loop;
end $$;
drop policy if exists "case study evidence upload own" on storage.objects;
create policy "case study evidence upload own" on storage.objects for insert to authenticated
with check(bucket_id='case-study-evidence' and (storage.foldername(name))[1]=auth.uid()::text and public.tj_is_current_owner());
commit;

-- Phase 3 activation only — DO NOT APPLY during Phase 2.
--
-- Apply this only when Free users have a fully tested local-only image path.
-- It preserves read access to every existing owner-scoped object and restricts
-- only NEW object INSERTs in the existing private bucket.

begin;

grant execute on function public.tj_is_current_owner() to authenticated;

drop policy if exists "case study evidence upload own" on storage.objects;
create policy "case study evidence upload own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'case-study-evidence'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.tj_is_current_owner()
);

commit;

-- Rollback before/after Phase 3 if required:
-- drop policy if exists "case study evidence upload own" on storage.objects;
-- create policy "case study evidence upload own"
-- on storage.objects for insert to authenticated
-- with check (bucket_id = 'case-study-evidence'
--   and (storage.foldername(name))[1] = auth.uid()::text);

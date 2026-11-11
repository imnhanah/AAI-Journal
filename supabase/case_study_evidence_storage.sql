-- Private Supabase Storage setup for synchronized Case Study evidence images.
-- Review and run manually in Supabase SQL Editor. This does not touch the
-- Case Study Library table or any existing JSON records.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('case-study-evidence', 'case-study-evidence', false, 3145728, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

drop policy if exists "case study evidence read own" on storage.objects;
create policy "case study evidence read own"
on storage.objects for select to authenticated
using (bucket_id = 'case-study-evidence' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "case study evidence upload own" on storage.objects;
create policy "case study evidence upload own"
on storage.objects for insert to authenticated
with check (bucket_id = 'case-study-evidence' and (storage.foldername(name))[1] = auth.uid()::text);

commit;

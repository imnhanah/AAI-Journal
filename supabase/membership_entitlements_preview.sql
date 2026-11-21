-- Staging preview. Apply after the membership foundation and the existing
-- profiles.cloud_sync_enabled column. This migration changes no write policy,
-- Storage permission, account assignment, or data.
begin;

create or replace function public.tj_current_entitlements()
returns table (membership text, cloud_writes_allowed boolean)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select coalesce(m.membership, 'free'),
         coalesce(m.membership = 'owner' and p.cloud_sync_enabled, false)
  from (select auth.uid() as id) as caller
  left join public.tj_memberships as m on m.user_id = caller.id
  left join public.profiles as p on p.id = caller.id
  where caller.id is not null;
$$;

revoke all on function public.tj_current_entitlements() from public, anon;
grant execute on function public.tj_current_entitlements() to authenticated;

commit;

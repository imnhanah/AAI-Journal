-- Phase 2: secure Owner / Free entitlement foundation.
--
-- REVIEW AND APPLY MANUALLY through a privileged Supabase migration process.
-- This file does not assign an Owner, alter existing data, or change Storage
-- policies. The sparse table holds explicit privileged assignments only; a
-- signed-in person without a row is effectively Free.

begin;

create table if not exists public.tj_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  membership text not null default 'free' check (membership in ('owner', 'free')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tj_memberships enable row level security;

-- No client policies are created. Browser users cannot enumerate, insert,
-- update, or delete membership rows. Assignment is SQL-admin only.
revoke all on table public.tj_memberships from public, anon, authenticated;

-- No argument is accepted, so a caller can only resolve their own effective
-- membership. SECURITY DEFINER is needed because table access is intentionally
-- denied to browser roles. The fixed path prevents search-path injection.
create or replace function public.tj_current_membership()
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  effective_membership text;
begin
  if caller_id is null then
    return null;
  end if;

  select m.membership
    into effective_membership
    from public.tj_memberships as m
   where m.user_id = caller_id;

  return coalesce(effective_membership, 'free');
end;
$$;

-- This boolean helper is for the Phase 3 Storage INSERT policy. It exposes no
-- membership list or user identifier, and it still evaluates only auth.uid().
create or replace function public.tj_is_current_owner()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce((
    select m.membership = 'owner'
      from public.tj_memberships as m
     where m.user_id = auth.uid()
  ), false);
$$;

revoke all on function public.tj_current_membership() from public, anon;
revoke all on function public.tj_is_current_owner() from public, anon;
grant execute on function public.tj_current_membership() to authenticated;
-- Do not grant the boolean helper yet. The Phase 3 Storage-policy activation
-- migration grants it immediately before creating the restrictive policy.
revoke all on function public.tj_is_current_owner() from authenticated;

comment on table public.tj_memberships is
  'Sparse privileged membership assignments. No row means effective Free membership.';

commit;

-- SECURE OWNER ASSIGNMENT (run separately, only after verifying the UUID in
-- Supabase Authentication / trusted admin tooling; do not put an email here):
--
-- insert into public.tj_memberships (user_id, membership)
-- values ('00000000-0000-0000-0000-000000000000'::uuid, 'owner')
-- on conflict (user_id) do update set membership = excluded.membership,
--   updated_at = now();
--
-- ROLLBACK OF ONE ASSIGNMENT (does not delete the account or its data):
-- delete from public.tj_memberships
-- where user_id = '00000000-0000-0000-0000-000000000000'::uuid
--   and membership = 'owner';

-- Requires membership_entitlements_preview.sql. Creates no administrators.
begin;

create schema tj_administration;
revoke all on schema tj_administration from public, anon, authenticated;

create table tj_administration.administrators (
  user_id uuid primary key references auth.users(id) on delete restrict,
  granted_at timestamptz not null default now()
);
create table tj_administration.admin_guard (
  singleton boolean primary key check (singleton),
  revision bigint not null default 0
);
insert into tj_administration.admin_guard(singleton) values (true);
create table tj_administration.membership_audit (
  id bigint generated always as identity primary key,
  actor uuid not null,
  target uuid not null,
  old_membership text not null,
  new_membership text not null,
  old_cloud_flag boolean not null,
  new_cloud_flag boolean not null,
  changed_at timestamptz not null default clock_timestamp()
);

alter table tj_administration.administrators enable row level security;
alter table tj_administration.admin_guard enable row level security;
alter table tj_administration.membership_audit enable row level security;
revoke all on all tables in schema tj_administration from public, anon, authenticated;

-- Serialize removals, including across transactions with repeatable snapshots.
create function tj_administration.guard_admin_removal()
returns trigger
language plpgsql security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'TRUNCATE' then
    raise exception 'Remove administrators individually.' using errcode = '42501';
  end if;
  update tj_administration.admin_guard set revision = revision + 1 where singleton;
  if not exists (select 1 from tj_administration.administrators where user_id <> old.user_id) then
    raise exception 'At least one administrator must remain.' using errcode = '42501';
  end if;
  return old;
end;
$$;
create trigger tj_guard_admin_removal before delete on tj_administration.administrators
for each row execute function tj_administration.guard_admin_removal();
create trigger tj_guard_admin_truncate before truncate on tj_administration.administrators
for each statement execute function tj_administration.guard_admin_removal();

create function tj_administration.guard_admin_identity()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'Grant the replacement administrator separately.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger tj_guard_admin_identity before update of user_id on tj_administration.administrators
for each row execute function tj_administration.guard_admin_identity();

create function public.tj_is_membership_admin()
returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$
  select exists(select 1 from tj_administration.administrators where user_id = auth.uid());
$$;

create function public.tj_list_membership_accounts(search_email text default '', after_user uuid default null, page_size integer default 25)
returns table(user_id uuid, email text, membership text, cloud_flag boolean, cloud_writes_allowed boolean)
language plpgsql stable security definer
set search_path = pg_catalog
as $$
begin
  if not public.tj_is_membership_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, coalesce(m.membership, 'free'), coalesce(p.cloud_sync_enabled, false),
           coalesce(m.membership = 'owner' and p.cloud_sync_enabled, false)
    from auth.users u
    left join public.tj_memberships m on m.user_id = u.id
    left join public.profiles p on p.id = u.id
    where (after_user is null or u.id > after_user)
      and strpos(lower(coalesce(u.email, '')), lower(left(trim(coalesce(search_email, '')), 254))) > 0
    order by u.id limit least(51, greatest(1, coalesce(page_size, 25)));
end;
$$;

create function public.tj_change_membership(
  target_user uuid, expected_membership text, expected_cloud_flag boolean,
  next_membership text, next_cloud_flag boolean
)
returns table(user_id uuid, email text, membership text, cloud_flag boolean, cloud_writes_allowed boolean)
language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  target_email text;
  previous_membership text;
  previous_flag boolean;
  effective_flag boolean;
begin
  -- The row lock makes revocation and this authorization check serialize.
  perform 1 from tj_administration.administrators a where a.user_id = actor_id for share;
  if not found then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  if target_user = actor_id then
    raise exception 'Another administrator must change your membership.' using errcode = '42501';
  end if;
  if next_membership is null or next_membership not in ('owner', 'free') or next_cloud_flag is null then
    raise exception 'Choose a valid membership and cloud setting.' using errcode = '22023';
  end if;
  if next_membership = 'free' and next_cloud_flag then
    raise exception 'Free accounts cannot enable cloud writes.' using errcode = '22023';
  end if;

  -- Lock the identity even when no sparse membership row exists yet.
  select u.email into target_email from auth.users u where u.id = target_user for update;
  if not found then raise exception 'Account unavailable.' using errcode = '22023'; end if;
  select p.cloud_sync_enabled into previous_flag from public.profiles p where p.id = target_user for update;
  if not found then raise exception 'The account profile is unavailable.' using errcode = '22023'; end if;
  select m.membership into previous_membership from public.tj_memberships m where m.user_id = target_user for update;
  previous_membership := coalesce(previous_membership, 'free');

  if previous_membership is distinct from expected_membership or previous_flag is distinct from expected_cloud_flag then
    raise exception 'Membership changed elsewhere. Refresh the list and try again.' using errcode = 'PT409';
  end if;
  -- Saving an already-Free account must not clear a legacy profile flag.
  effective_flag := case when previous_membership = 'free' and next_membership = 'free' then previous_flag else next_cloud_flag end;
  if previous_membership is distinct from next_membership or previous_flag is distinct from effective_flag then
    insert into public.tj_memberships as m(user_id, membership)
      values (target_user, next_membership)
      on conflict on constraint tj_memberships_pkey do update
        set membership = excluded.membership, updated_at = clock_timestamp();
    update public.profiles set cloud_sync_enabled = effective_flag where id = target_user;
    insert into tj_administration.membership_audit(actor, target, old_membership, new_membership, old_cloud_flag, new_cloud_flag)
      values (actor_id, target_user, previous_membership, next_membership, previous_flag, effective_flag);
  end if;
  return query select target_user, target_email, next_membership, effective_flag, next_membership = 'owner' and effective_flag;
end;
$$;

revoke all on function public.tj_is_membership_admin() from public, anon;
revoke all on function public.tj_list_membership_accounts(text, uuid, integer) from public, anon;
revoke all on function public.tj_change_membership(uuid, text, boolean, text, boolean) from public, anon;
grant execute on function public.tj_is_membership_admin() to authenticated;
grant execute on function public.tj_list_membership_accounts(text, uuid, integer) to authenticated;
grant execute on function public.tj_change_membership(uuid, text, boolean, text, boolean) to authenticated;
commit;

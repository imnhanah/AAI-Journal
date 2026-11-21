-- Existing installation upgrade only. No table, policy, permission or data changes.
-- Persistent stale-edit conflicts must not use serialization_failure (40001).
begin;
do $guard$
declare target oid := to_regprocedure('public.tj_change_membership(uuid,text,boolean,text,boolean)')::oid;
begin
 if target is null then raise exception 'Administrator function is not installed; review the target first.';end if;
 if (select md5(prosrc) from pg_proc where oid=target) not in ('07696163fa6d0954b1f87f0b3ca9af20','bca30d992836c090448d52550503bb73') then
  raise exception 'Administrator source differs from the reviewed version; stop and review before replacement.';
 end if;
 if not coalesce((select prosecdef and proconfig = array['search_path=pg_catalog'] from pg_proc where oid=target),false) then
  raise exception 'Administrator security configuration differs; stop and review.';
 end if;
end;
$guard$;
create or replace function public.tj_change_membership(
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
commit;

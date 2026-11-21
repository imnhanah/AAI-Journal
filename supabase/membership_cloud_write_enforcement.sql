-- Apply only after review and approval for the target environment.
-- Requires membership_entitlements_preview.sql.
begin;

create schema if not exists tj_write_control;
revoke all on schema tj_write_control from public, anon, authenticated;

create function public.tj_can_write_cloud()
returns boolean
language sql stable security invoker
set search_path = pg_catalog
as $$
  select coalesce((select cloud_writes_allowed from public.tj_current_entitlements()), false);
$$;
revoke all on function public.tj_can_write_cloud() from public, anon;
grant execute on function public.tj_can_write_cloud() to authenticated;

-- Restrictive policies compose with all existing ownership policies. SELECT
-- stays outside this guard, including reads by an account after downgrade.
do $$
declare
  relation text;
begin
  foreach relation in array array[
    'accounts', 'workspace_balances', 'trade_balance_results', 'trades',
    'rules', 'journal_entries', 'user_settings', 'premarket_markups',
    'trade_reviews', 'period_reviews', 'finance_settings', 'savings_accounts',
    'finance_movements', 'challenge_progress', 'balance_challenge_progress',
    'profile_case_study_libraries', 'backtest_runs', 'backtest_trades'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass(format('public.%I', relation)) and relrowsecurity
    ) then
      raise exception 'Expected RLS-enabled journal table public.%', relation;
    end if;
    execute format('create policy tj_cloud_insert on public.%I as restrictive for insert to authenticated with check (public.tj_can_write_cloud())', relation);
    execute format('create policy tj_cloud_update on public.%I as restrictive for update to authenticated using (public.tj_can_write_cloud()) with check (public.tj_can_write_cloud())', relation);
    execute format('create policy tj_cloud_delete on public.%I as restrictive for delete to authenticated using (public.tj_can_write_cloud())', relation);
    execute format('create policy tj_anon_insert on public.%I as restrictive for insert to anon with check (false)', relation);
    execute format('create policy tj_anon_update on public.%I as restrictive for update to anon using (false)', relation);
    execute format('create policy tj_anon_delete on public.%I as restrictive for delete to anon using (false)', relation);
  end loop;
end;
$$;

-- Reject unexpected deployed RPC definitions before enabling enforcement.
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_class
    where oid = 'storage.objects'::regclass and relrowsecurity
  ) then raise exception 'Expected RLS on storage.objects'; end if;
  if (select count(*) from pg_catalog.pg_proc
      where oid in (
        'public.tj_save_backtest_run(uuid,timestamptz,jsonb,boolean)'::regprocedure,
        'public.tj_save_backtest_trade(uuid,uuid,timestamptz,jsonb,jsonb,boolean)'::regprocedure
      ) and not prosecdef) <> 2 then
    raise exception 'Expected invoker Strategy Testing save functions';
  end if;
end;
$$;

-- The invoker Strategy Testing RPCs already run through table RLS.
-- The definer Case Study RPC needs a check before entering its existing CAS.
alter function public.tj_save_profile_case_study_library(bigint, jsonb) set schema tj_write_control;
revoke all on function tj_write_control.tj_save_profile_case_study_library(bigint, jsonb) from public, anon, authenticated;

create function public.tj_save_profile_case_study_library(expected_revision bigint, next_library jsonb)
returns table(outcome text, library jsonb, revision bigint, updated_at timestamptz)
language plpgsql security definer
set search_path = pg_catalog
as $$
begin
  if not public.tj_can_write_cloud() then
    raise exception 'Cloud write access is disabled.' using errcode = '42501';
  end if;
  return query select * from tj_write_control.tj_save_profile_case_study_library(expected_revision, next_library);
end;
$$;
revoke all on function public.tj_save_profile_case_study_library(bigint, jsonb) from public, anon;
grant execute on function public.tj_save_profile_case_study_library(bigint, jsonb) to authenticated;

-- The deployed app uses this private bucket for all shared-image writers.
-- The original owner/folder rules continue to apply. Check both sides of an
-- update to cover future upsert and object moves into or out of this bucket.
create policy tj_cloud_evidence_insert on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'case-study-evidence' or public.tj_can_write_cloud());
create policy tj_cloud_evidence_update on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'case-study-evidence' or public.tj_can_write_cloud())
  with check (bucket_id <> 'case-study-evidence' or public.tj_can_write_cloud());
create policy tj_cloud_evidence_delete on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'case-study-evidence' or public.tj_can_write_cloud());
create policy tj_anon_evidence_insert on storage.objects as restrictive for insert to anon
  with check (bucket_id <> 'case-study-evidence');
create policy tj_anon_evidence_update on storage.objects as restrictive for update to anon
  using (bucket_id <> 'case-study-evidence') with check (bucket_id <> 'case-study-evidence');
create policy tj_anon_evidence_delete on storage.objects as restrictive for delete to anon
  using (bucket_id <> 'case-study-evidence');

-- Protect the entitlement flag even if profile update RLS is expanded later.
create function tj_write_control.protect_profile_cloud_flag()
returns trigger
language plpgsql security invoker
set search_path = pg_catalog
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if (tg_op = 'INSERT' and new.cloud_sync_enabled)
      or (tg_op = 'UPDATE' and new.cloud_sync_enabled is distinct from old.cloud_sync_enabled) then
      raise exception 'Cloud permission is managed by an administrator.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger tj_protect_profile_cloud_flag
before insert or update of cloud_sync_enabled on public.profiles
for each row execute function tj_write_control.protect_profile_cloud_flag();

-- GoTrue writes Auth user metadata as its own database role. Check the
-- affected identity directly for the journal-specific Daily Routine field.
create function tj_write_control.protect_cloud_routine()
returns trigger
language plpgsql security definer
set search_path = pg_catalog
as $$
begin
  if (new.raw_user_meta_data -> 'dailyRoutine') is distinct from (old.raw_user_meta_data -> 'dailyRoutine')
    and not exists (
      select 1 from public.tj_memberships m
      join public.profiles p on p.id = m.user_id
      where m.user_id = old.id and m.membership = 'owner' and p.cloud_sync_enabled
    ) then
    raise exception 'Cloud write access is disabled for Daily Routine.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger tj_protect_cloud_routine
before update of raw_user_meta_data on auth.users
for each row execute function tj_write_control.protect_cloud_routine();

commit;

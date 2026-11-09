-- Case Study Library contract repair for an existing installation.
--
-- Review in the Supabase SQL Editor before running. This migration does not
-- read, replace, delete, or otherwise modify any Case Study JSON payload.
-- It restores the exact revisioned RPC contract required by caseStudyCloud.js.
-- Do not run this if the read-only verifier already reports the same contract.

begin;

do $$
begin
  if to_regclass('public.profile_case_study_libraries') is null then
    raise exception 'profile_case_study_libraries does not exist; use the approved initial installation instead.';
  end if;
end;
$$;

alter table public.profile_case_study_libraries enable row level security;

-- Browser clients may read only their own profile row. All mutations go
-- through the compare-and-swap RPC below.
drop policy if exists profile_case_study_libraries_owner on public.profile_case_study_libraries;
drop policy if exists profile_case_study_libraries_select_own on public.profile_case_study_libraries;
create policy profile_case_study_libraries_select_own
  on public.profile_case_study_libraries
  for select to authenticated
  using (user_id = auth.uid());

revoke all on table public.profile_case_study_libraries from public, anon, authenticated;
grant select on table public.profile_case_study_libraries to authenticated;

create or replace function public.tj_save_profile_case_study_library(
  expected_revision bigint,
  next_library jsonb
)
returns table(outcome text, library jsonb, revision bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  requesting_user uuid := auth.uid();
  current_library jsonb;
  current_revision bigint;
  current_updated_at timestamptz;
begin
  if requesting_user is null then
    raise exception using errcode = '28000', message = 'Authentication is required to save a Case Study Library.';
  end if;
  if next_library is null or jsonb_typeof(next_library) <> 'object' then
    raise exception using errcode = '22023', message = 'Case Study Library data must be a JSON object.';
  end if;

  select row.library, row.revision, row.updated_at
    into current_library, current_revision, current_updated_at
  from public.profile_case_study_libraries as row
  where row.user_id = requesting_user
  for update;

  if not found then
    if expected_revision is not null then
      return query select 'conflict'::text, null::jsonb, null::bigint, null::timestamptz;
      return;
    end if;
    insert into public.profile_case_study_libraries as row (user_id, library, revision)
      values (requesting_user, next_library, 1)
      on conflict (user_id) do nothing
      returning row.library, row.revision, row.updated_at into library, revision, updated_at;
    if found then outcome := 'saved'; return next; end if;
    select row.library, row.revision, row.updated_at
      into current_library, current_revision, current_updated_at
    from public.profile_case_study_libraries as row where row.user_id = requesting_user;
    return query select 'conflict'::text, current_library, current_revision, current_updated_at;
    return;
  end if;

  if expected_revision is distinct from current_revision then
    return query select 'conflict'::text, current_library, current_revision, current_updated_at;
    return;
  end if;

  update public.profile_case_study_libraries as row
    set library = next_library, revision = row.revision + 1
  where row.user_id = requesting_user and row.revision = expected_revision
  returning row.library, row.revision, row.updated_at into library, revision, updated_at;

  if not found then
    select row.library, row.revision, row.updated_at
      into current_library, current_revision, current_updated_at
    from public.profile_case_study_libraries as row where row.user_id = requesting_user;
    return query select 'conflict'::text, current_library, current_revision, current_updated_at;
    return;
  end if;

  outcome := 'saved';
  return next;
end;
$$;

revoke all on function public.tj_save_profile_case_study_library(bigint, jsonb) from public, anon;
grant execute on function public.tj_save_profile_case_study_library(bigint, jsonb) to authenticated;

commit;

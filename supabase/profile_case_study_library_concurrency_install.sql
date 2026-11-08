-- Proposed initial installation for the profile-wide Case Study Library.
--
-- Run this INSTEAD OF profile_case_study_library_migration.sql and
-- profile_case_study_sync_concurrency.sql when the table is absent. It creates
-- the complete revisioned contract in one transaction and deliberately does
-- not grant browser clients direct INSERT, UPDATE, or DELETE access.
--
-- Review and execute only after a separately approved backup and staging run.
begin;

create table if not exists public.profile_case_study_libraries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  library jsonb not null default '{"version":1}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default clock_timestamp()
);

-- The production finding for this installation is an absent table. The
-- following statements also make a pre-existing, older table safe to upgrade
-- without replacing its JSON payloads.
alter table public.profile_case_study_libraries
  add column if not exists revision bigint;
update public.profile_case_study_libraries
  set revision = 0
  where revision is null;
alter table public.profile_case_study_libraries
  alter column revision set default 0,
  alter column revision set not null;

alter table public.profile_case_study_libraries
  drop constraint if exists profile_case_study_libraries_revision_nonnegative;
alter table public.profile_case_study_libraries
  add constraint profile_case_study_libraries_revision_nonnegative check (revision >= 0);

create or replace function public.tj_profile_case_study_library_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists tj_profile_case_study_libraries_updated_at
  on public.profile_case_study_libraries;
create trigger tj_profile_case_study_libraries_updated_at
  before update on public.profile_case_study_libraries
  for each row execute function public.tj_profile_case_study_library_touch_updated_at();

alter table public.profile_case_study_libraries enable row level security;

-- The prior migration used this permissive ALL policy. Remove it by name when
-- upgrading, then expose reads only. Writes are performed exclusively by the
-- compare-and-swap RPC below.
drop policy if exists profile_case_study_libraries_owner
  on public.profile_case_study_libraries;
drop policy if exists profile_case_study_libraries_select_own
  on public.profile_case_study_libraries;
create policy profile_case_study_libraries_select_own
  on public.profile_case_study_libraries
  for select to authenticated
  using (user_id = auth.uid());

-- Table reads remain compatible with caseStudyCloud.js. Explicitly remove all
-- direct browser mutations so every cloud write passes through the revision
-- guard in tj_save_profile_case_study_library.
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
    raise exception using
      errcode = '28000',
      message = 'Authentication is required to save a Case Study Library.';
  end if;

  if next_library is null or jsonb_typeof(next_library) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'Case Study Library data must be a JSON object.';
  end if;

  if expected_revision is not null and expected_revision < 0 then
    raise exception using
      errcode = '22023',
      message = 'Expected Case Study Library revision cannot be negative.';
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
      returning row.library, row.revision, row.updated_at
      into library, revision, updated_at;

    if found then
      outcome := 'saved';
      return next;
    end if;

    select row.library, row.revision, row.updated_at
      into current_library, current_revision, current_updated_at
    from public.profile_case_study_libraries as row
    where row.user_id = requesting_user;
    return query select 'conflict'::text, current_library, current_revision, current_updated_at;
    return;
  end if;

  if expected_revision is distinct from current_revision then
    return query select 'conflict'::text, current_library, current_revision, current_updated_at;
    return;
  end if;

  update public.profile_case_study_libraries as row
    set library = next_library,
        revision = row.revision + 1
  where row.user_id = requesting_user
    and row.revision = expected_revision
  returning row.library, row.revision, row.updated_at
  into library, revision, updated_at;

  if not found then
    select row.library, row.revision, row.updated_at
      into current_library, current_revision, current_updated_at
    from public.profile_case_study_libraries as row
    where row.user_id = requesting_user;
    return query select 'conflict'::text, current_library, current_revision, current_updated_at;
    return;
  end if;

  outcome := 'saved';
  return next;
end;
$$;

-- SECURITY DEFINER is safe here only because the function derives the owner
-- from auth.uid(), never accepts a user ID argument, and uses a fixed search
-- path. Keep the owner as a trusted database migration role that owns the table.
revoke all on function public.tj_save_profile_case_study_library(bigint, jsonb)
  from public, anon;
grant execute on function public.tj_save_profile_case_study_library(bigint, jsonb)
  to authenticated;

revoke all on function public.tj_profile_case_study_library_touch_updated_at()
  from public, anon, authenticated;

commit;

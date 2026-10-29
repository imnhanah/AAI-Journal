-- Profile-owned Case Study Library. Existing account-embedded libraries are
-- retained as raw, account-labelled sources and consolidated client-side with
-- deterministic ID remapping; nothing is deleted from accounts.rating_style.
begin;
create table if not exists public.profile_case_study_libraries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  library jsonb not null default '{"version":1}'::jsonb,
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.profile_case_study_libraries enable row level security;
drop policy if exists profile_case_study_libraries_owner on public.profile_case_study_libraries;
create policy profile_case_study_libraries_owner on public.profile_case_study_libraries for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
grant select,insert,update,delete on public.profile_case_study_libraries to authenticated;
do $$ begin
  if to_regprocedure('public.tj_set_updated_at()') is not null then
    drop trigger if exists tj_profile_case_study_libraries_updated_at on public.profile_case_study_libraries;
    create trigger tj_profile_case_study_libraries_updated_at before update on public.profile_case_study_libraries for each row execute function public.tj_set_updated_at();
  elsif to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists tj_profile_case_study_libraries_updated_at on public.profile_case_study_libraries;
    create trigger tj_profile_case_study_libraries_updated_at before update on public.profile_case_study_libraries for each row execute function public.set_updated_at();
  end if;
end $$;
create or replace function public.tj_case_study_legacy_preferences(raw text) returns jsonb language plpgsql immutable as $$
begin
  if raw !~ '^\\s*\\{' then return null; end if;
  return raw::jsonb;
exception when others then return null;
end; $$;

-- Preserve an existing profile library verbatim and append only source
-- descriptors that have not already been captured or consolidated. The
-- application writes the completion marker atomically with its merged library.
create or replace function public.tj_merge_case_study_legacy_sources(existing_library jsonb, incoming_sources jsonb)
returns jsonb language plpgsql immutable as $$
declare
  library jsonb := case when jsonb_typeof(existing_library) = 'object' then existing_library else '{}'::jsonb end;
  sources jsonb := case when jsonb_typeof(existing_library->'legacyAccountLibraries') = 'array' then existing_library->'legacyAccountLibraries' else '[]'::jsonb end;
  completed jsonb := case when jsonb_typeof(existing_library #> '{migrationState,legacyProfileConsolidation,sourceAccountIds}') = 'array' then existing_library #> '{migrationState,legacyProfileConsolidation,sourceAccountIds}' else '[]'::jsonb end;
  merged jsonb := '[]'::jsonb;
  item jsonb;
  source_id text;
  known_ids text[] := '{}';
begin
  -- Keep one stable descriptor per account ID. Malformed descriptors are
  -- ignored rather than allowed to replace the profile library.
  for item in select value from jsonb_array_elements(sources) loop
    source_id := nullif(item->>'accountId','');
    if jsonb_typeof(item) <> 'object' or source_id is null or source_id = any(known_ids) then continue; end if;
    known_ids := array_append(known_ids, source_id);
    merged := merged || jsonb_build_array(item);
  end loop;
  for item in select value from jsonb_array_elements(case when jsonb_typeof(incoming_sources) = 'array' then incoming_sources else '[]'::jsonb end) loop
    source_id := nullif(item->>'accountId','');
    if jsonb_typeof(item) <> 'object' or source_id is null or source_id = any(known_ids) or completed ? source_id then continue; end if;
    known_ids := array_append(known_ids, source_id);
    merged := merged || jsonb_build_array(item);
  end loop;
  return jsonb_set(library, '{legacyAccountLibraries}', merged, true);
end; $$;

insert into public.profile_case_study_libraries(user_id,library)
select user_id,jsonb_build_object('version',1,'legacyAccountLibraries',jsonb_agg(jsonb_build_object('accountId',id,'workspace',workspace) order by id))
from (
  select user_id,id,(public.tj_case_study_legacy_preferences(rating_style))->'caseStudyWorkspace' as workspace
  from public.accounts
) legacy where workspace is not null and jsonb_typeof(workspace) = 'object'
group by user_id on conflict (user_id) do update
set library = public.tj_merge_case_study_legacy_sources(public.profile_case_study_libraries.library, excluded.library->'legacyAccountLibraries');
commit;

-- Pending staging migration: do not execute until separately approved.
-- Adds compare-and-swap persistence for profile Case Study libraries.
begin;
alter table public.profile_case_study_libraries add column if not exists revision bigint not null default 0;

create or replace function public.tj_save_profile_case_study_library(expected_revision bigint, next_library jsonb)
returns table(outcome text, library jsonb, revision bigint, updated_at timestamptz)
language plpgsql security invoker set search_path = public as $$
declare
  current_row public.profile_case_study_libraries%rowtype;
begin
  select * into current_row from public.profile_case_study_libraries where user_id=auth.uid() for update;
  if not found then
    if expected_revision is not null then
      return query select 'conflict'::text, null::jsonb, null::bigint, null::timestamptz; return;
    end if;
    insert into public.profile_case_study_libraries(user_id,library,revision)
      values(auth.uid(), coalesce(next_library,'{"version":1}'::jsonb), 1)
      on conflict (user_id) do nothing
      returning profile_case_study_libraries.library, profile_case_study_libraries.revision, profile_case_study_libraries.updated_at
      into library, revision, updated_at;
    if not found then
      select * into current_row from public.profile_case_study_libraries where user_id=auth.uid();
      return query select 'conflict'::text, current_row.library, current_row.revision, current_row.updated_at; return;
    end if;
    outcome := 'saved'; return next;
  end if;
  if expected_revision is distinct from current_row.revision then
    return query select 'conflict'::text, current_row.library, current_row.revision, current_row.updated_at; return;
  end if;
  update public.profile_case_study_libraries set library=coalesce(next_library,'{"version":1}'::jsonb), revision=current_row.revision+1
    where user_id=auth.uid() and revision=expected_revision
    returning profile_case_study_libraries.library, profile_case_study_libraries.revision, profile_case_study_libraries.updated_at
    into library, revision, updated_at;
  outcome := 'saved'; return next;
end; $$;
grant execute on function public.tj_save_profile_case_study_library(bigint,jsonb) to authenticated;
commit;

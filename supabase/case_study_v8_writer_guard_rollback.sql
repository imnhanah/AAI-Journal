-- Keep the writer guard in place when any V8 library exists. Roll back the UI
-- to the compatible reader build, which renders rich content read-only.
begin;
do $block$
begin
  if exists(select 1 from public.profile_case_study_libraries
      where public.tj_case_study_requires_v8(library)) then
    raise exception 'V8 libraries exist. Keep the writer guard and use the compatible reader build.';
  end if;
end;
$block$;
drop trigger if exists tj_case_study_v8_writer_guard on public.profile_case_study_libraries;
drop function if exists public.tj_guard_case_study_v8_writer();
drop function if exists public.tj_case_study_requires_v8(jsonb);
commit;

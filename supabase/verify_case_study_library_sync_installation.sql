-- Read-only verification for profile_case_study_library_concurrency_install.sql.
-- This queries only PostgreSQL catalogs and never reads Case Study JSON rows.
begin read only;

select
  'column' as check_type,
  column_name as object_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profile_case_study_libraries'
  and column_name in ('user_id', 'library', 'revision', 'updated_at')
order by column_name;

select
  'function' as check_type,
  p.oid::regprocedure as object_name,
  pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer,
  p.proconfig as function_settings,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'tj_save_profile_case_study_library';

select
  'rls' as check_type,
  c.relrowsecurity as enabled,
  c.relforcerowsecurity as forced
from pg_class c
where c.oid = 'public.profile_case_study_libraries'::regclass;

select
  'policy' as check_type,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'profile_case_study_libraries'
order by policyname;

select
  'table_grant' as check_type,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'profile_case_study_libraries'
order by grantee, privilege_type;

select
  'routine_grant' as check_type,
  grantee,
  privilege_type
from information_schema.role_routine_grants
where routine_schema = 'public'
  and routine_name = 'tj_save_profile_case_study_library'
order by grantee, privilege_type;

select
  'trigger' as check_type,
  t.tgname,
  pg_get_triggerdef(t.oid) as definition
from pg_trigger t
where t.tgrelid = 'public.profile_case_study_libraries'::regclass
  and not t.tgisinternal
order by t.tgname;

commit;

-- Restore the original write surface. Leaves entitlement changes and all
-- journal, Storage, and audit data intact.
begin;

drop trigger tj_protect_cloud_routine on auth.users;
drop function tj_write_control.protect_cloud_routine();

drop trigger tj_protect_profile_cloud_flag on public.profiles;
drop function tj_write_control.protect_profile_cloud_flag();
drop function public.tj_save_profile_case_study_library(bigint, jsonb);
alter function tj_write_control.tj_save_profile_case_study_library(bigint, jsonb) set schema public;
grant execute on function public.tj_save_profile_case_study_library(bigint, jsonb) to authenticated;

drop policy tj_cloud_evidence_insert on storage.objects;
drop policy tj_cloud_evidence_update on storage.objects;
drop policy tj_cloud_evidence_delete on storage.objects;
drop policy tj_anon_evidence_insert on storage.objects;
drop policy tj_anon_evidence_update on storage.objects;
drop policy tj_anon_evidence_delete on storage.objects;

do $$
declare
  relation text;
  policy_name text;
begin
  foreach relation in array array[
    'accounts', 'workspace_balances', 'trade_balance_results', 'trades',
    'rules', 'journal_entries', 'user_settings', 'premarket_markups',
    'trade_reviews', 'period_reviews', 'finance_settings', 'savings_accounts',
    'finance_movements', 'challenge_progress', 'balance_challenge_progress',
    'profile_case_study_libraries', 'backtest_runs', 'backtest_trades'
  ] loop
    foreach policy_name in array array[
      'tj_cloud_insert', 'tj_cloud_update', 'tj_cloud_delete',
      'tj_anon_insert', 'tj_anon_update', 'tj_anon_delete'
    ] loop
      execute format('drop policy %I on public.%I', policy_name, relation);
    end loop;
  end loop;
end;
$$;

drop function public.tj_can_write_cloud();
commit;

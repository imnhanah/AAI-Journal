-- AAICoreFx installation verification (read-only)
-- Run after the manifest. This queries only system catalogs; it never reads
-- journal rows and cannot create, alter, update, or delete anything.
begin read only;

with expected_tables(table_name) as (
  values ('profiles'), ('user_settings'), ('accounts'), ('trades'), ('rules'),
    ('journal_entries'), ('premarket_markups'), ('trade_reviews'),
    ('period_reviews'), ('finance_settings'), ('savings_accounts'),
    ('finance_movements'), ('workspace_balances'), ('trade_balance_results'),
    ('challenge_progress'), ('balance_challenge_progress'), ('backtest_runs'),
    ('backtest_trades'), ('economic_calendar_cache'), ('profile_case_study_libraries')
), expected_columns(table_name, column_name) as (
  values
    ('accounts','workspace_type'), ('accounts','base_currency'),
    ('trades','close_date'), ('trades','close_time'), ('trades','gross_pnl'),
    ('trades','net_pnl'), ('trades','risk_method'), ('trades','planned_rr'),
    ('savings_accounts','balance_id'), ('savings_accounts','reminder_minutes'),
    ('finance_movements','balance_id'), ('workspace_balances','workspace_id'),
    ('trade_balance_results','balance_id'), ('challenge_progress','automation'),
    ('balance_challenge_progress','automation')
), expected_functions(function_name, argument_types) as (
  values
    ('tj_sync_journal', array['jsonb']::text[]),
    ('tj_journal_image', array['text','uuid','text[]','text']::text[]),
    ('tj_image_references', array['jsonb','uuid','text','text','text','text[]']::text[]),
    ('tj_bootstrap_metadata', array['jsonb','uuid','text','text']::text[]),
    ('tj_sync_backtests', array['jsonb']::text[]),
    ('tj_save_backtest_run', array['uuid','timestamp with time zone','jsonb','boolean']::text[]),
    ('tj_save_backtest_trade', array['uuid','uuid','timestamp with time zone','jsonb','jsonb','boolean']::text[]),
    ('tj_backtest_media', array['uuid','timestamp with time zone']::text[])
), expected_rls(table_name, policy_required) as (
  values
    ('profiles', true), ('user_settings', true), ('accounts', true), ('trades', true),
    ('rules', true), ('journal_entries', true), ('premarket_markups', true),
    ('trade_reviews', true), ('period_reviews', true), ('finance_settings', true),
    ('savings_accounts', true), ('finance_movements', true), ('workspace_balances', true),
    ('trade_balance_results', true), ('challenge_progress', true),
    ('balance_challenge_progress', true), ('backtest_runs', true), ('backtest_trades', true), ('profile_case_study_libraries', true),
    -- The cache is intentionally private to the service-role Edge Function.
    ('economic_calendar_cache', false)
), actual_functions as (
  select p.proname as function_name,
    array_agg(format_type(argument_type, null) order by position) as argument_types
  from pg_proc p
  cross join lateral unnest(p.proargtypes::oid[]) with ordinality as args(argument_type, position)
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
  group by p.oid, p.proname
)
select 'table' as check_type, e.table_name as object_name,
  case when c.oid is null then 'MISSING' else 'OK' end as status,
  'required by the fresh-install manifest' as detail
from expected_tables e
left join pg_class c on c.relname = e.table_name and c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p')
union all
select 'column', e.table_name || '.' || e.column_name,
  case when c.column_name is null then 'MISSING' else 'OK' end,
  'required application column'
from expected_columns e
left join information_schema.columns c on c.table_schema = 'public' and c.table_name = e.table_name and c.column_name = e.column_name
union all
select 'rpc', e.function_name || '(' || array_to_string(e.argument_types, ', ') || ')',
  case when a.function_name is null then 'MISSING' when a.argument_types <> e.argument_types then 'SIGNATURE MISMATCH' else 'OK' end,
  coalesce('actual: ' || array_to_string(a.argument_types, ', '), 'not installed')
from expected_functions e
left join actual_functions a on a.function_name = e.function_name
union all
select 'rls', e.table_name,
  case when c.relrowsecurity and (not e.policy_required or exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = e.table_name)) then 'OK' else 'MISSING OR DISABLED' end,
  case when e.policy_required then 'RLS enabled with at least one policy' else 'RLS enabled; intentionally no browser policy' end
from expected_rls e
left join pg_class c on c.relname = e.table_name and c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p')
order by check_type, object_name;

commit;

-- Additive hardening. Apply AFTER journal_low_egress_migration.sql.
-- Existing rows/media remain in place. No RLS policies or Auth settings change.
begin;
create or replace function public.tj_bootstrap_metadata(row_data jsonb, owner_id uuid, table_name text, record_id text)
returns jsonb language plpgsql immutable security invoker set search_path = '' as $$
declare fields text; result jsonb; scopes jsonb;
begin
  fields := case table_name
    when 'accounts' then 'id,user_id,name,icon,balance,breakeven_cap,rating_style,theme,default_commission,monthly_goal_pct,yearly_goal_pct,daily_loss_limit_pct,monthly_loss_limit_pct,position_size_enabled,base_currency,default_risk_pct,default_stop_loss_pips,workspace_type,created_at,updated_at'
    when 'trades' then 'id,user_id,account_id,trade_date,trade_time,close_date,close_time,asset,direction,entry_price,exit_price,risk_method,risk_preset,stop_loss_pips,take_profit_pips,exit_pips,stop_loss_price,take_profit_price,planned_rr,realized_rr,gross_pnl,commission,swap,net_pnl,pnl,rr,session,entry_session,entry_type,rating,types,mistakes,mood_before,mood_after,context,confluence_session,premarket_markup_id,rule_evaluations,created_at,updated_at'
    when 'premarket_markups' then 'id,user_id,account_id,markup_date,markup_time,market,instrument,bias,status,levels,market_structure,notes,created_at,updated_at'
    when 'trade_reviews' then 'id,user_id,account_id,trade_id,review_date,review_time,done_well,went_wrong,execution_review,rule_adherence,psychology,lessons,action_items,notes,created_at,updated_at'
    when 'period_reviews' then 'id,user_id,account_id,period_type,period_key,completed,created_at,updated_at'
    when 'rules' then 'id,user_id,account_id,rule_text,active,created_at,updated_at'
    when 'journal_entries' then 'id,user_id,account_id,rule_id,entry_date,checked,created_at,updated_at'
    when 'user_settings' then 'user_id,custom_type_tags,custom_mistake_tags,custom_confluence_sessions,custom_instruments,migrated_local_data,created_at,updated_at'
    when 'finance_settings' then 'account_id,user_id,enabled,trading_target,created_at,updated_at'
    when 'savings_accounts' then 'id,user_id,account_id,balance_id,name,target,allocation_pct,transfer_interval,reminder_minutes,created_at,updated_at'
    when 'finance_movements' then 'id,user_id,account_id,balance_id,movement_type,amount,movement_date,note,source,savings_account_id,created_at,updated_at'
    when 'workspace_balances' then 'id,user_id,workspace_id,name,starting_balance,base_currency,goals,risk_settings,guardrails,challenge_enabled,challenge_starting_balance,challenge_mode,is_active,created_at,updated_at'
    when 'trade_balance_results' then 'id,user_id,trade_id,balance_id,risk_pct,position_size,entry_price,exit_price,gross_pnl,commission,swap,net_pnl,close_date,close_time,status,created_at,updated_at'
    else ''
  end;
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into result
    from jsonb_each(row_data) where key = any(string_to_array(fields,','));
  if table_name = any(array['trades','premarket_markups','trade_reviews']) then
    result := result || jsonb_build_object('screenshots',public.tj_image_references(coalesce(row_data -> 'screenshots','null'::jsonb),owner_id,table_name,record_id,md5(coalesce(row_data -> 'screenshots','null'::jsonb)::text)));
  elsif table_name = 'period_reviews' then
    select coalesce(jsonb_object_agg(key,jsonb_build_object('completed',value -> 'completed')),'{}'::jsonb) into scopes
      from jsonb_each(case when jsonb_typeof(row_data #> '{content,accountScopes}') = 'object' then row_data #> '{content,accountScopes}' else '{}'::jsonb end);
    result := result || jsonb_build_object('content',jsonb_build_object('accountScopes',scopes),'content_loaded',false);
  end if;
  return result;
end;
$$;
create or replace function public.tj_sync_journal(known jsonb default '{}')
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid(); table_name text; key_column text;
  changed jsonb; removed jsonb; result jsonb := '{}'; table_known jsonb;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  foreach table_name in array array[
    'accounts','trades','rules','journal_entries','user_settings',
    'premarket_markups','trade_reviews','period_reviews','finance_settings',
    'savings_accounts','finance_movements','workspace_balances','trade_balance_results'
  ] loop
    if to_regclass('public.' || table_name) is null then
      if table_name = any(array['accounts','trades','rules','journal_entries','user_settings','premarket_markups','trade_reviews']) then
        raise exception 'Required journal table missing: %', table_name;
      end if;
      result := result || jsonb_build_object(table_name,jsonb_build_object('rows','[]'::jsonb,'deleted','[]'::jsonb,'available',false));
      continue;
    end if;
    key_column := case table_name when 'user_settings' then 'user_id' when 'finance_settings' then 'account_id' else 'id' end;
    -- Refresh older cached rows once so newly included savings fields are loaded.
    table_known := case when known ->> '_protocol' = '3' then coalesce(known -> table_name,'{}'::jsonb) else '{}'::jsonb end;
    execute format($query$
      with current_rows as materialized (
        select to_jsonb(t) as row, t.%I::text as key from public.%I t where t.user_id = $1
      )
      select
        coalesce((select jsonb_agg(public.tj_bootstrap_metadata(row,$1,$3,key) order by key)
          from current_rows where ($2 ->> key) is distinct from (row ->> 'updated_at')), '[]'::jsonb),
        coalesce((select jsonb_agg(k) from jsonb_object_keys($2) k where not exists(select 1 from current_rows c where c.key = k)), '[]'::jsonb)
    $query$,key_column,table_name) into changed, removed using owner_id, table_known, table_name;
    result := result || jsonb_build_object(table_name,jsonb_build_object('rows',changed,'deleted',removed,'available',true));
  end loop;
  return jsonb_build_object('tables',result,'protocol',3);
end;
$$;
revoke all on function public.tj_bootstrap_metadata(jsonb,uuid,text,text) from public, anon;
grant execute on function public.tj_bootstrap_metadata(jsonb,uuid,text,text) to authenticated;
-- Existing tj_sync_journal grants remain authenticated-only.
commit;

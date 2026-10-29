-- Planned and realized R calculations for trades. Existing trade rows remain unchanged.
alter table public.trades add column if not exists risk_method text;
alter table public.trades add column if not exists risk_preset text;
alter table public.trades add column if not exists stop_loss_pips numeric;
alter table public.trades add column if not exists take_profit_pips numeric;
alter table public.trades add column if not exists exit_pips numeric;
alter table public.trades add column if not exists stop_loss_price numeric;
alter table public.trades add column if not exists take_profit_price numeric;
alter table public.trades add column if not exists planned_rr numeric;
alter table public.trades add column if not exists realized_rr numeric;

-- If low-egress sync hardening is enabled, expose the new columns to its
-- metadata payload as well. This replaces only the allow-list, not any data.
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
revoke all on function public.tj_bootstrap_metadata(jsonb,uuid,text,text) from public, anon;
grant execute on function public.tj_bootstrap_metadata(jsonb,uuid,text,text) to authenticated;

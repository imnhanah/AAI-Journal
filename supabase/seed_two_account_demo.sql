-- Rebuild the requested multi-account Demo workspace for the two existing
-- journal users. This intentionally removes only the named Demo/Main Account
-- workspaces before creating the new synthetic educational dataset.
begin;

do $$
declare
  demo_users uuid[] := array[
    'aae44aaf-41cf-442a-80f3-a2034da7e7f7'::uuid,
    'bc2c5574-acd2-405a-8f9c-ee67fb08dd83'::uuid
  ];
  demo_user uuid; workspace_id uuid; balance_one_id uuid; balance_two_id uuid; savings_id uuid;
  rule_ids uuid[]; trade_id uuid; markup_id uuid; sequence integer; slot integer;
  account_one_count integer := 0; account_two_count integer := 0; remaining_index integer;
  trade_day date; open_at time; close_at time; instrument text; direction text; session_name text;
  entry_model text; markup_bias text; has_one boolean; has_two boolean; win_one boolean; win_two boolean;
  risk_one numeric; risk_two numeric; gross_one numeric; gross_two numeric; parent_gross numeric; parent_rr numeric;
  excluded_one uuid[] := '{}'; excluded_two uuid[] := '{}'; status_one jsonb; status_two jsonb;
  risk_ladder numeric[] := array[4.5,6,8,10,14,18,22,28,38,48,64,82,108,140,182,236,308,400,520,674,878,1140,1482,1928,2506,3256,4234,5504,7156,9302];
  profit_ladder numeric[] := array[6,8,10,14,18,22,28,38,48,64,82,108,140,182,236,308,400,520,674,878,1140,1482,1928,2506,3256,4234,5504,7156,9302,12092];
  instruments text[] := array['EUR/USD','GBP/USD','USD/JPY','USD/CHF','AUD/USD','USD/CAD','NZD/USD','XAU/USD','XAG/USD','US30','US100','US500','BTC/USD','ETH/USD'];
  confluences text[] := array['Trend','Liquidity','Breakout','Structure','PDH','PDL','FVG','Order Block'];
begin
  -- Delete only the two workspaces explicitly requested by name.
  delete from public.accounts
  where (user_id = demo_users[1] and name = 'Demo')
     or (user_id = demo_users[2] and name = 'Main Account');

  foreach demo_user in array demo_users loop
    account_one_count := 0; account_two_count := 0; excluded_one := '{}'; excluded_two := '{}';
    insert into public.accounts (user_id, name, icon, balance, breakeven_cap, rating_style, theme, monthly_goal_pct, yearly_goal_pct, daily_loss_limit_pct, monthly_loss_limit_pct, position_size_enabled, base_currency, default_risk_pct, default_stop_loss_pips, workspace_type)
    values (demo_user, 'Demo', 'USD', 70, 0, 'stars', 'dark', 0, 0, 0, 0, true, 'USD', 1, 20, 'multi_balance') returning id into workspace_id;

    insert into public.workspace_balances (workspace_id, user_id, name, starting_balance, base_currency, goals, risk_settings, guardrails, challenge_enabled, challenge_starting_balance, challenge_mode, is_active)
    values (workspace_id, demo_user, 'Account 1', 50, 'USD', '{}'::jsonb, jsonb_build_object('defaultRiskPct', 1, 'defaultStopLossPips', 20), '{}'::jsonb, true, 50, 'risk', true) returning id into balance_one_id;
    insert into public.workspace_balances (workspace_id, user_id, name, starting_balance, base_currency, goals, risk_settings, guardrails, challenge_enabled, challenge_starting_balance, challenge_mode, is_active)
    values (workspace_id, demo_user, 'Account 2', 20, 'USD', '{}'::jsonb, jsonb_build_object('defaultRiskPct', 1, 'defaultStopLossPips', 20), '{}'::jsonb, true, 20, 'streak', true) returning id into balance_two_id;

    with added_rules as (
      insert into public.rules (user_id, account_id, rule_text, active) values
        (demo_user, workspace_id, 'Higher-timeframe bias confirmed', true),
        (demo_user, workspace_id, 'Liquidity target identified', true),
        (demo_user, workspace_id, 'Session confirmation completed', true),
        (demo_user, workspace_id, 'Risk and invalidation defined', true),
        (demo_user, workspace_id, 'Entry model matched the plan', true)
      returning id, rule_text
    )
    select array_agg(id order by case rule_text
      when 'Higher-timeframe bias confirmed' then 1
      when 'Liquidity target identified' then 2
      when 'Session confirmation completed' then 3
      when 'Risk and invalidation defined' then 4
      else 5 end)
    into rule_ids from added_rules;
    insert into public.finance_settings (account_id, user_id, enabled, trading_target) values (workspace_id, demo_user, true, 0);
    insert into public.savings_accounts (account_id, user_id, name, target, allocation_pct, transfer_interval) values (workspace_id, demo_user, 'Demo Savings', 5000, 10, 'Weekly') returning id into savings_id;

    -- Every 25-trade block has six shared days, ten Account 1-only days, and
    -- nine Account 2-only days: 160 and 150 executions, both exactly 60% wins.
    for sequence in 1..250 loop
      slot := ((sequence - 1) % 25) + 1; has_one := slot <= 16; has_two := slot <= 6 or slot >= 17;
      trade_day := date '2020-01-02' + floor((sequence - 1) * (date '2026-09-30' - date '2020-01-02') / 249.0)::integer;
      if extract(isodow from trade_day) = 6 then trade_day := trade_day + 2; end if;
      if extract(isodow from trade_day) = 7 then trade_day := trade_day + 1; end if;
      session_name := case when sequence % 3 = 0 then 'NY AM' when sequence % 3 = 1 then 'London' else 'NY PM' end;
      open_at := case session_name when 'London' then '08:45'::time when 'NY AM' then '13:40'::time else '18:10'::time end;
      close_at := open_at + ((45 + (sequence % 75)) || ' minutes')::interval;
      instrument := instruments[((sequence * 7) % array_length(instruments, 1)) + 1]; direction := case when sequence % 2 = 0 then 'BUY' else 'SELL' end;
      entry_model := case when sequence % 2 = 0 then 'EM1 — Trend Pullback' else 'EM2 — Breakout Retest' end;
      markup_bias := case when sequence % 4 = 0 then case when direction = 'BUY' then 'Bearish' else 'Bullish' end else case when direction = 'BUY' then 'Bullish' else 'Bearish' end end;

      insert into public.premarket_markups (user_id, account_id, markup_date, markup_time, market, instrument, bias, status, levels, market_structure, notes, screenshots, created_at, updated_at)
      values (demo_user, workspace_id, trade_day, open_at - interval '30 minutes', session_name, instrument, markup_bias, 'Executed', 'Session range · liquidity pool · execution zone', case when markup_bias = 'Bullish' then 'Bullish structure with a demand reaction at the marked level.' else 'Bearish structure with a supply reaction at the marked level.' end, 'Synthetic demo markup. The trade review records whether execution matched this directional idea.', jsonb_build_object('sessionReview', jsonb_build_object('marketOutcome','Logged for review','waitedForConditions','Waited for confirmation at the marked zone.','outsidePlanReason','No discretionary trade outside the planned setup.')), (trade_day + (open_at - interval '30 minutes')) at time zone 'UTC', (trade_day + (open_at - interval '30 minutes')) at time zone 'UTC') returning id into markup_id;

      gross_one := 0; gross_two := 0; risk_one := null; risk_two := null;
      if has_one then
        account_one_count := account_one_count + 1; risk_one := risk_ladder[((account_one_count - 1) % 30) + 1];
        if account_one_count <= 18 then win_one := true; gross_one := profit_ladder[account_one_count];
        else remaining_index := account_one_count - 18; win_one := floor(remaining_index * 78.0 / 142.0) > floor((remaining_index - 1) * 78.0 / 142.0); gross_one := case when win_one then profit_ladder[((account_one_count - 1) % 30) + 1] else -risk_one end; excluded_one := array_append(excluded_one, gen_random_uuid()); end if;
      end if;
      if has_two then
        account_two_count := account_two_count + 1; risk_two := risk_ladder[((account_two_count - 1) % 30) + 1];
        if account_two_count <= 24 then win_two := true; gross_two := round(risk_two * 3.1, 2);
        else remaining_index := account_two_count - 24; win_two := floor(remaining_index * 66.0 / 126.0) > floor((remaining_index - 1) * 66.0 / 126.0); gross_two := case when win_two then round(risk_two * 3.1, 2) else -risk_two end; excluded_two := array_append(excluded_two, gen_random_uuid()); end if;
      end if;
      parent_gross := gross_one + gross_two; parent_rr := case when parent_gross < 0 then -1 else 3.1 end;

      insert into public.trades (user_id, account_id, trade_date, trade_time, close_date, close_time, asset, direction, entry_price, exit_price, pnl, gross_pnl, net_pnl, commission, swap, rr, session, entry_session, entry_type, confluence_session, premarket_markup_id, rating, types, mistakes, mood_before, mood_after, context, screenshots, rule_evaluations, created_at, updated_at)
      values (demo_user, workspace_id, trade_day, open_at, trade_day, close_at, instrument, direction, round((100 + sequence * 1.137)::numeric, 5), round((100 + sequence * 1.137 + case when parent_gross >= 0 then 0.004 else -0.003 end)::numeric, 5), parent_gross, parent_gross, parent_gross, 0, 0, parent_rr, session_name, session_name, entry_model, entry_model, markup_id, case when parent_gross > 0 then 5 else 4 end, to_jsonb(array[confluences[((sequence - 1) % 8) + 1], confluences[((sequence + 2) % 8) + 1], confluences[((sequence + 4) % 8) + 1]]), case when sequence % 9 = 0 then jsonb_build_array('Early Exit') else '[]'::jsonb end, 'Focused', case when parent_gross >= 0 then 'Disciplined' else 'Calm' end, format('Synthetic two-account demo trade %s. %s execution, three confluences, planned risk, and a completed close.', sequence, entry_model), '[]'::jsonb, jsonb_build_array(jsonb_build_object('ruleId', rule_ids[1], 'name','Higher-timeframe bias confirmed','checked',true),jsonb_build_object('ruleId', rule_ids[2], 'name','Liquidity target identified','checked',true),jsonb_build_object('ruleId', rule_ids[3], 'name','Session confirmation completed','checked',true),jsonb_build_object('ruleId', rule_ids[4], 'name','Risk and invalidation defined','checked',true),jsonb_build_object('ruleId', rule_ids[5], 'name','Entry model matched the plan','checked',true)), (trade_day + open_at) at time zone 'UTC', (trade_day + close_at) at time zone 'UTC') returning id into trade_id;

      if has_one then
        insert into public.trade_balance_results (user_id, trade_id, balance_id, risk_pct, position_size, entry_price, exit_price, gross_pnl, commission, swap, net_pnl, close_date, close_time, status, created_at, updated_at)
        values (demo_user, trade_id, balance_one_id, round(risk_one / 50 * 100, 2), round(risk_one / 200, 2), round((100 + sequence * 1.137)::numeric, 5), round((100 + sequence * 1.137 + case when gross_one >= 0 then 0.004 else -0.003 end)::numeric, 5), gross_one, 0, 0, gross_one, trade_day, close_at, 'closed', (trade_day + open_at) at time zone 'UTC', (trade_day + close_at) at time zone 'UTC');
        if account_one_count > 18 then excluded_one[array_length(excluded_one, 1)] := trade_id; end if;
      end if;
      if has_two then
        insert into public.trade_balance_results (user_id, trade_id, balance_id, risk_pct, position_size, entry_price, exit_price, gross_pnl, commission, swap, net_pnl, close_date, close_time, status, created_at, updated_at)
        values (demo_user, trade_id, balance_two_id, round(risk_two / 20 * 100, 2), round(risk_two / 200, 2), round((100 + sequence * 1.137)::numeric, 5), round((100 + sequence * 1.137 + case when gross_two >= 0 then 0.004 else -0.003 end)::numeric, 5), gross_two, 0, 0, gross_two, trade_day, close_at, 'closed', (trade_day + open_at) at time zone 'UTC', (trade_day + close_at) at time zone 'UTC');
        if account_two_count > 24 then excluded_two[array_length(excluded_two, 1)] := trade_id; end if;
      end if;
      insert into public.trade_reviews (user_id, account_id, trade_id, review_date, review_time, done_well, went_wrong, execution_review, rule_adherence, psychology, lessons, action_items, notes, screenshots, created_at, updated_at)
      values (demo_user, workspace_id, trade_id, trade_day, '18:30', 'Followed the written session plan, checked every rule, and completed the trade review.', case when parent_gross < 0 then 'The planned invalidation was reached; the loss stayed inside the selected account risk.' else 'No material execution error; continue to protect the process.' end, format('%s %s closed at %sR with a combined result of $%s.', instrument, direction, parent_rr, to_char(parent_gross, 'FM999999990.00')), 'All five trading rules were checked before execution.', 'Focused at entry and calm after the result.', case when parent_gross >= 0 then 'Let valid executions complete at the planned target.' else 'A planned loss is acceptable when risk remains defined.' end, 'Keep using the two listed entry models and complete the next review.', 'Synthetic educational review linked to the saved markup and closed trade.', '[]'::jsonb, (trade_day + close_at + interval '2 hours') at time zone 'UTC', (trade_day + close_at + interval '2 hours') at time zone 'UTC');
    end loop;

    for sequence in 1..18 loop
      insert into public.finance_movements (user_id, account_id, balance_id, movement_type, amount, movement_date, note, source, savings_account_id)
      values (demo_user, workspace_id, case when sequence % 2 = 0 then balance_one_id else balance_two_id end, 'transfer', round((20 + sequence * 5) * .10, 2), date '2020-02-03' + (sequence * 105), '10% profit allocation to Demo Savings', 'trading', savings_id);
    end loop;
    for sequence in 1..5 loop
      insert into public.finance_movements (user_id, account_id, movement_type, amount, movement_date, note, source, savings_account_id)
      values (demo_user, workspace_id, 'withdrawal', 8 + sequence * 3, date '2022-03-14' + (sequence * 175), 'Random planned withdrawal from Demo Savings', 'savings', savings_id);
    end loop;
    select jsonb_object_agg(level::text, case when level < 19 then 'Pass' else 'In progress' end) into status_one from generate_series(1, 19) level;
    select jsonb_object_agg(level::text, case when level < 25 then 'Pass' else 'In progress' end) into status_two from generate_series(1, 25) level;
    insert into public.balance_challenge_progress (balance_id, user_id, active_level, statuses, notes, automation)
    values (balance_one_id, demo_user, 19, status_one, jsonb_build_object('19','Mode 1 active level after 18 completed planned targets.'), jsonb_build_object('mode','risk','startedAt','2019-12-31T00:00:00.000Z','version',2,'excludedIds',to_jsonb(excluded_one),'includedIds','[]'::jsonb));
    insert into public.balance_challenge_progress (balance_id, user_id, active_level, statuses, notes, automation)
    values (balance_two_id, demo_user, 25, status_two, jsonb_build_object('25','Mode 2 active level after 24 completed planned targets.'), jsonb_build_object('mode','streak','startedAt','2019-12-31T00:00:00.000Z','version',2,'excludedIds',to_jsonb(excluded_two),'includedIds','[]'::jsonb));
  end loop;
end $$;

commit;

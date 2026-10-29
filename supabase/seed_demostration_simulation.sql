-- Demostration workspace: repeatable 2025–2026 training simulation
--
-- This script only removes/recreates an account named "Demostration". It
-- never touches any other workspace, account, trade, markup, or review.
-- It runs once for every existing profile so each profile gets an isolated
-- simulation workspace with the same deterministic 200-trade dataset.
--
-- Run after schema.sql and multi_balance_workspaces_migration.sql.
-- Screenshot URLs point to the app's public/simulation-charts assets. They are
-- stable deployment paths, never temporary Mac paths.

begin;

do $$
declare
  p record;
  workspace_id uuid;
  balance_id uuid;
  rule_ids uuid[];
  markup_id uuid;
  trade_id uuid;
  i integer;
  pair_no integer;
  month_index integer;
  trade_day date;
  open_at time;
  close_at time;
  session_name text;
  direction_name text;
  model_name text;
  bias_name text;
  is_win boolean;
  realized_r numeric;
  planned_r numeric;
  opening_balance numeric := 10000.00;
  risk_amount numeric;
  gross_amount numeric;
  commission_amount numeric;
  net_amount numeric;
  entry numeric;
  exit numeric;
  stop_price numeric;
  target_price numeric;
  stop_pips numeric;
  rule_checks jsonb;
  confluences text[];
  mistake_list jsonb;
  monthly_total integer;
  winner_total integer;
  markup_total integer;
  review_total integer;
begin
  for p in select id from public.profiles order by created_at loop
    -- Re-running refreshes only this profile's previous simulation workspace.
    delete from public.accounts
    where user_id = p.id and name = 'Demostration';

    insert into public.accounts (
      user_id, name, icon, balance, base_currency, default_risk_pct,
      default_stop_loss_pips, default_commission, position_size_enabled,
      workspace_type, rating_style, theme
    ) values (
      p.id, 'Demostration', 'USD', 10000, 'USD', 1, 20, 2.75, true,
      'multi_balance', 'stars', 'dark'
    ) returning id into workspace_id;

    insert into public.workspace_balances (
      workspace_id, user_id, name, starting_balance, base_currency,
      risk_settings, goals, guardrails, challenge_enabled, is_active
    ) values (
      workspace_id, p.id, 'Simulation balance', 10000, 'USD',
      jsonb_build_object('defaultRiskPct', 1, 'defaultStopLossPips', 20),
      '{}'::jsonb, '{}'::jsonb, false, true
    ) returning id into balance_id;

    with created_rules as (
      insert into public.rules (user_id, account_id, rule_text, active) values
        (p.id, workspace_id, 'Higher-timeframe bias confirmed', true),
        (p.id, workspace_id, 'Liquidity target identified', true),
        (p.id, workspace_id, 'Session confirmation completed', true),
        (p.id, workspace_id, 'Risk and invalidation defined', true),
        (p.id, workspace_id, 'Entry model matched the plan', true)
      returning id, rule_text
    )
    select array_agg(id order by case rule_text
      when 'Higher-timeframe bias confirmed' then 1
      when 'Liquidity target identified' then 2
      when 'Session confirmation completed' then 3
      when 'Risk and invalidation defined' then 4
      else 5 end)
    into rule_ids from created_rules;

    opening_balance := 10000.00;

    -- 100 markups, exactly two linked trades per markup. Pair dates are
    -- spread across all 24 months and shifted off weekends.
    for pair_no in 1..100 loop
      month_index := floor((pair_no - 1) * 24.0 / 100.0)::integer;
      trade_day := (date '2025-01-01' + (month_index || ' months')::interval)::date
        + (1 + ((pair_no * 3) % 19));
      if extract(isodow from trade_day) = 6 then trade_day := trade_day + 2; end if;
      if extract(isodow from trade_day) = 7 then trade_day := trade_day + 1; end if;

      session_name := case pair_no % 3 when 0 then 'London' when 1 then 'NY AM' else 'NY PM' end;
      model_name := case pair_no % 3
        when 0 then 'Liquidity Sweep Reversal'
        when 1 then 'London Breakout Retest'
        else 'New York Continuation' end;
      direction_name := case when pair_no % 2 = 0 then 'BUY' else 'SELL' end;
      bias_name := case when direction_name = 'BUY' then 'Bullish' else 'Bearish' end;

      insert into public.premarket_markups (
        user_id, account_id, markup_date, markup_time, market, instrument,
        bias, status, levels, market_structure, notes, screenshots
      ) values (
        p.id, workspace_id, trade_day, '06:45'::time, session_name, 'EUR/USD',
        bias_name, 'Executed',
        'Prior day high/low · session range · liquidity pool · execution zone',
        format('%s structure: wait for displacement, a retest, and confirmation before execution.', bias_name),
        format('Pre-session plan %s: %s with HTF bias, liquidity, market structure, and fair-value-gap confluence. Execute only after the planned confirmation.', pair_no, model_name),
        jsonb_build_object(
          'preHTF', jsonb_build_array('/simulation-charts/markup-structure.png'),
          'preH4', jsonb_build_array('/simulation-charts/markup-levels.png'),
          'preM15', jsonb_build_array('/simulation-charts/markup-structure.png'),
          'postH4', jsonb_build_array('/simulation-charts/markup-levels.png'),
          'postM15', jsonb_build_array('/simulation-charts/markup-structure.png'),
          'sessionReview', jsonb_build_object(
            'marketOutcome', format('%s session followed the planned %s narrative.', session_name, bias_name),
            'waitedForConditions', 'Yes — entry was taken after structure and liquidity confirmation.',
            'outsidePlanReason', 'No discretionary trade outside the written plan.'
          )
        )
      ) returning id into markup_id;

      for i in 1..2 loop
        -- Multiplying by 37 permutes 0..199, giving exactly 120 winners and
        -- 80 losers throughout the chronological sequence rather than blocks.
        is_win := ((pair_no - 1) * 2 + i) * 37 % 200 < 120;
        direction_name := case when ((pair_no - 1) * 2 + i) % 2 = 0 then 'BUY' else 'SELL' end;
        model_name := case ((pair_no - 1) * 2 + i) % 3
          when 0 then 'Liquidity Sweep Reversal'
          when 1 then 'London Breakout Retest'
          else 'New York Continuation' end;
        open_at := case i when 1 then '07:15'::time else '13:30'::time end;
        close_at := open_at + ((75 + (((pair_no * 2 + i) * 17) % 195)) || ' minutes')::interval;
        risk_amount := round(opening_balance * .01, 2);
        realized_r := case when is_win then round((2 + (((pair_no * 2 + i) * 13) % 16) / 10.0)::numeric, 2) else -1 end;
        planned_r := case when is_win then realized_r else round((2.2 + (((pair_no + i) * 3) % 10) / 10.0)::numeric, 2) end;
        commission_amount := round((2.15 + (((pair_no * 2 + i) * 11) % 20) * .17)::numeric, 2);
        gross_amount := round(risk_amount * realized_r, 2);
        net_amount := round(gross_amount - commission_amount, 2);
        entry := round((1.07500 + (((pair_no * 2 + i) * 37) % 850) / 100000.0)::numeric, 5);
        stop_pips := 15 + (((pair_no * 2 + i) * 7) % 10);
        if direction_name = 'BUY' then
          stop_price := round(entry - stop_pips / 10000.0, 5);
          target_price := round(entry + (stop_pips / 10000.0) * planned_r, 5);
          exit := round(entry + (stop_pips / 10000.0) * realized_r, 5);
        else
          stop_price := round(entry + stop_pips / 10000.0, 5);
          target_price := round(entry - (stop_pips / 10000.0) * planned_r, 5);
          exit := round(entry - (stop_pips / 10000.0) * realized_r, 5);
        end if;

        confluences := case (pair_no * 2 + i) % 4
          when 0 then array['HTF Bias','Liquidity Sweep']
          when 1 then array['Liquidity Sweep','Market Structure Shift','Fair Value Gap']
          when 2 then array['HTF Bias','Market Structure Shift']
          else array['HTF Bias','Liquidity Sweep','Fair Value Gap'] end;
        mistake_list := case
          when is_win and (pair_no + i) % 11 = 0 then jsonb_build_array('Early Exit')
          when not is_win and (pair_no + i) % 7 = 0 then jsonb_build_array('Chasing Entry')
          when not is_win and (pair_no + i) % 9 = 0 then jsonb_build_array('Missed Confirmation')
          else '[]'::jsonb end;
        rule_checks := jsonb_build_array(
          jsonb_build_object('ruleId',rule_ids[1],'name','Higher-timeframe bias confirmed','checked',true),
          jsonb_build_object('ruleId',rule_ids[2],'name','Liquidity target identified','checked',true),
          jsonb_build_object('ruleId',rule_ids[3],'name','Session confirmation completed','checked',true),
          jsonb_build_object('ruleId',rule_ids[4],'name','Risk and invalidation defined','checked',true),
          jsonb_build_object('ruleId',rule_ids[5],'name','Entry model matched the plan','checked',is_win or (pair_no + i) % 5 <> 0)
        );

        insert into public.trades (
          user_id, account_id, trade_date, trade_time, close_date, close_time,
          asset, direction, entry_price, exit_price, stop_loss_price,
          take_profit_price, stop_loss_pips, take_profit_pips, exit_pips,
          pnl, gross_pnl, net_pnl, commission, swap, rr, planned_rr, realized_rr,
          session, entry_session, entry_type, confluence_session, premarket_markup_id,
          rating, types, mistakes, mood_before, mood_after, context, screenshots,
          rule_evaluations
        ) values (
          p.id, workspace_id, trade_day, open_at, trade_day, close_at,
          'EUR/USD', direction_name, entry, exit, stop_price, target_price,
          stop_pips, round(stop_pips * planned_r, 2), round(stop_pips * realized_r, 2),
          net_amount, gross_amount, net_amount, commission_amount, 0, realized_r,
          planned_r, realized_r, session_name, session_name, model_name, model_name,
          markup_id, case when is_win then 5 else 3 end, to_jsonb(confluences),
          mistake_list,
          case (pair_no + i) % 4 when 0 then 'Focused' when 1 then 'Calm' when 2 then 'Neutral' else 'Patient' end,
          case when is_win then 'Disciplined' else 'Reflective' end,
          format('%s %s trade using %s. Risk was fixed at 1%% of the immediately prior closing balance ($%s). %s',
            direction_name, 'EUR/USD', model_name, to_char(risk_amount,'FM999999990.00'),
            case when is_win then 'The planned target was reached after confirmation.' else 'The planned invalidation was reached and the loss stayed contained.' end),
          jsonb_build_object(
            'entry', jsonb_build_array(case
              when direction_name = 'BUY' and is_win then '/simulation-charts/buy-profit-entry.png'
              when direction_name = 'BUY' then '/simulation-charts/buy-loss-entry.png'
              when is_win then '/simulation-charts/sell-profit-entry.png'
              else '/simulation-charts/sell-loss-entry.png' end),
            'exit', jsonb_build_array(case
              when direction_name = 'BUY' and is_win then '/simulation-charts/buy-profit-exit.png'
              when direction_name = 'BUY' then '/simulation-charts/buy-loss-exit.png'
              when is_win then '/simulation-charts/sell-profit-exit.png'
              else '/simulation-charts/sell-loss-exit.png' end)
          ), rule_checks
        ) returning id into trade_id;

        insert into public.trade_balance_results (
          user_id, trade_id, balance_id, risk_pct, position_size, entry_price,
          exit_price, gross_pnl, commission, swap, net_pnl, close_date, close_time, status
        ) values (
          p.id, trade_id, balance_id, 1, round(risk_amount / (stop_pips * 10), 2),
          entry, exit, gross_amount, commission_amount, 0, net_amount, trade_day, close_at, 'closed'
        );

        insert into public.trade_reviews (
          user_id, account_id, trade_id, review_date, review_time, done_well,
          went_wrong, execution_review, rule_adherence, psychology, lessons,
          action_items, notes, screenshots
        ) values (
          p.id, workspace_id, trade_id, trade_day, close_at,
          'Prepared the session plan, used fixed compounding risk, and completed the review.',
          case when is_win then 'No material process error; protect the repeatable behaviour.' else 'The planned invalidation was reached; no risk rule was breached.' end,
          format('%s %s closed at %sR. Gross P&L was $%s and commission was $%s.', 'EUR/USD', direction_name, realized_r, to_char(gross_amount,'FM999999990.00'), to_char(commission_amount,'FM999999990.00')),
          'Four to five rules were checked before execution; any missed item is retained for learning.',
          case when is_win then 'Calm and patient through the planned target.' else 'Accepted the planned loss without trying to recover immediately.' end,
          case when is_win then 'Let validated setups reach the planned target.' else 'A correctly sized losing trade is a valid part of the process.' end,
          'Repeat the preparation checklist at the next eligible session.',
          'Simulation review linked to the paired markup.', '[]'::jsonb
        );
        opening_balance := round(opening_balance + net_amount, 2);
      end loop;
    end loop;

    update public.accounts set balance = opening_balance where id = workspace_id;

    -- Complete 24 monthly, 8 quarterly, and 2 annual reviews.
    for i in 0..23 loop
      insert into public.period_reviews (user_id, account_id, period_type, period_key, content, completed)
      values (p.id, workspace_id, 'monthly', to_char(date '2025-01-01' + (i || ' months')::interval, 'YYYY-MM'),
        jsonb_build_object('summary','Monthly simulation review completed. Review trade selection, rule adherence, and risk execution before the next month.','focus','Maintain 1% compounding risk and take only confirmed setups.','reviewedTrades',8 + case when i < 8 then 1 else 0 end), true);
    end loop;
    for i in 1..8 loop
      insert into public.period_reviews (user_id, account_id, period_type, period_key, content, completed)
      values (p.id, workspace_id, 'quarterly', format('%s-Q%s', 2025 + ((i - 1) / 4)::integer, ((i - 1) % 4) + 1),
        jsonb_build_object('summary','Quarterly simulation review completed. Compare execution quality across all sessions.','focus','Keep risk fixed and preserve high-quality entry selection.'), true);
    end loop;
    for i in 2025..2026 loop
      insert into public.period_reviews (user_id, account_id, period_type, period_key, content, completed)
      values (p.id, workspace_id, 'annual', i::text,
        jsonb_build_object('summary','Annual simulation review completed. Consolidate lessons and refine the next-year process.','focus','Consistency, compounding discipline, and review quality.'), true);
    end loop;

    select count(*), count(*) filter (where net_pnl > 0)
      into monthly_total, winner_total from public.trades where account_id = workspace_id;
    select count(*) into markup_total from public.premarket_markups where account_id = workspace_id;
    select count(*) into review_total from public.trade_reviews where account_id = workspace_id;
    if monthly_total <> 200 or winner_total <> 120 or markup_total <> 100 or review_total <> 200 then
      raise exception 'Simulation verification failed for profile %: trades %, winners %, markups %, reviews %', p.id, monthly_total, winner_total, markup_total, review_total;
    end if;
  end loop;
end $$;

-- Verification output (one row for each simulated profile).
select
  a.user_id, a.name,
  (select count(*) from public.trades t where t.account_id = a.id) as trades,
  (select count(*) from public.trades t where t.account_id = a.id and t.net_pnl > 0) as winners,
  (select count(*) from public.trades t where t.account_id = a.id and t.net_pnl < 0) as losers,
  (select round(100.0 * count(*) filter (where t.net_pnl > 0) / nullif(count(*),0), 2) from public.trades t where t.account_id = a.id) as win_rate,
  (select count(*) from public.premarket_markups m where m.account_id = a.id) as markups,
  (select count(*) from public.trade_reviews r where r.account_id = a.id) as trade_reviews,
  a.balance as ending_balance
from public.accounts a
where a.name = 'Demostration'
order by a.user_id;

commit;

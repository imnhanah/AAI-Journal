-- Independent simulations. No live-account foreign keys or live-trade writes.
begin;
create table if not exists public.backtest_runs (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 settings jsonb not null, updated_at timestamptz not null default clock_timestamp()
);
create table if not exists public.backtest_trades (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 run_id uuid not null references public.backtest_runs(id) on delete cascade,
 trade_data jsonb not null, screenshots jsonb not null default '{}', updated_at timestamptz not null default clock_timestamp()
);
create index if not exists backtest_runs_owner on public.backtest_runs(user_id,id);
create index if not exists backtest_trades_owner on public.backtest_trades(user_id,run_id,id);
alter table public.backtest_runs enable row level security;
alter table public.backtest_trades enable row level security;
drop policy if exists backtest_owner on public.backtest_runs;
create policy backtest_owner on public.backtest_runs for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists backtest_owner on public.backtest_trades;
create policy backtest_owner on public.backtest_trades for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from public.backtest_runs r where r.id=run_id and r.user_id=auth.uid()));
grant select,insert,update,delete on public.backtest_runs,public.backtest_trades to authenticated;
create or replace function public.tj_sync_backtests(known jsonb default '{}') returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object(
 'runVersions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'updatedAt',updated_at) order by id) from backtest_runs where user_id=auth.uid()),'[]'),
 'tradeVersions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'updatedAt',updated_at) order by id) from backtest_trades where user_id=auth.uid()),'[]'),
 'runs',coalesce((select jsonb_agg(settings||jsonb_build_object('id',id,'updatedAt',updated_at) order by id) from backtest_runs r where user_id=auth.uid() and not exists(select 1 from jsonb_array_elements(coalesce(known->'runs','[]')) k where k->>'id'=r.id::text and (k->>'updatedAt')::timestamptz=r.updated_at)),'[]'),
 'trades',coalesce((select jsonb_agg((trade_data-'screenshots')||jsonb_build_object('id',id,'runId',run_id,'updatedAt',updated_at,'screenshotCount',(select coalesce(sum(jsonb_array_length(value)),0) from jsonb_each(case when jsonb_typeof(screenshots)='object' then screenshots else '{}' end) where jsonb_typeof(value)='array')) order by id) from backtest_trades t where user_id=auth.uid() and not exists(select 1 from jsonb_array_elements(coalesce(known->'trades','[]')) k where k->>'id'=t.id::text and (k->>'updatedAt')::timestamptz=t.updated_at)),'[]'));
$$;
create or replace function public.tj_save_backtest_run(row_id uuid,expected_version timestamptz,settings jsonb,remove_row boolean default false) returns jsonb language plpgsql security invoker set search_path=public as $$
declare current_row backtest_runs; result backtest_runs;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into current_row from backtest_runs where id=row_id and user_id=auth.uid() for update;
 if current_row.id is not null and current_row.updated_at is distinct from expected_version then raise exception 'Backtest changed elsewhere. Refresh before saving.'; end if;
 if current_row.id is null and expected_version is not null then raise exception 'Backtest was deleted. Refresh before saving.'; end if;
 if remove_row then delete from backtest_runs where id=row_id and user_id=auth.uid();return jsonb_build_object('deleted',row_id);end if;
 if coalesce(trim(settings->>'name'),'')='' or coalesce(trim(settings->>'instrument'),'')='' or coalesce((settings->>'startingBalance')::numeric,0)<=0 or coalesce((settings->>'tradeTarget')::integer,0)<=0 then raise exception 'Name, instrument, positive balance and trade target are required'; end if;
 if coalesce(settings->>'currency','') not in ('USD','EUR','GBP','JPY','AUD','CAD','CHF','NZD','GHS') or coalesce((settings->>'riskPct')::numeric,-1)<0 or (settings->>'riskPct')::numeric>100 then raise exception 'Choose a supported currency and risk percentage between 0 and 100';end if;
 if current_row.id is not null and current_row.settings->>'instrument' is distinct from settings->>'instrument' and exists(select 1 from backtest_trades where run_id=row_id) then raise exception 'Instrument is locked once trades are logged';end if;
 insert into backtest_runs(id,user_id,settings) values(row_id,auth.uid(),settings-'id'-'updatedAt') on conflict(id) do update set settings=excluded.settings,updated_at=clock_timestamp() returning * into result;
 return result.settings||jsonb_build_object('id',result.id,'updatedAt',result.updated_at);
end;$$;
create or replace function public.tj_save_backtest_trade(row_id uuid,run_id uuid,expected_version timestamptz,trade_data jsonb,media jsonb default null,remove_row boolean default false) returns jsonb language plpgsql security invoker set search_path=public as $$
declare current_row backtest_trades; r backtest_runs; result backtest_trades;
begin
 select * into r from backtest_runs where id=run_id and user_id=auth.uid() for update;
 if r.id is null then raise exception 'Backtest unavailable';end if;
 select * into current_row from backtest_trades where id=row_id and user_id=auth.uid() for update;
 if current_row.id is not null and (current_row.updated_at is distinct from expected_version or current_row.run_id<>run_id) then raise exception 'Trade changed elsewhere. Refresh before saving.';end if;
 if current_row.id is null and expected_version is not null then raise exception 'Trade was deleted. Refresh before saving.';end if;
 if remove_row then delete from backtest_trades where id=row_id and user_id=auth.uid();return jsonb_build_object('deleted',row_id);end if;
 if trade_data->>'asset' is distinct from r.settings->>'instrument' then raise exception 'Trade instrument must match this backtest';end if;
 insert into backtest_trades(id,user_id,run_id,trade_data,screenshots) values(row_id,auth.uid(),run_id,trade_data-'screenshots'-'updatedAt'-'screenshotCount',coalesce(media,'{}')) on conflict(id) do update set trade_data=excluded.trade_data,screenshots=coalesce(media,backtest_trades.screenshots),updated_at=clock_timestamp() returning * into result;
 return (result.trade_data-'screenshots')||jsonb_build_object('id',result.id,'runId',result.run_id,'updatedAt',result.updated_at);
end;$$;
create or replace function public.tj_backtest_media(row_id uuid,media_version timestamptz) returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare media jsonb;begin
 select screenshots into media from backtest_trades where id=row_id and user_id=auth.uid() and updated_at=media_version;
 if not found then raise exception 'Screenshot version changed or trade unavailable. Refresh and reopen.';end if;
 return media;end;$$;
revoke all on function public.tj_sync_backtests(jsonb),public.tj_save_backtest_run(uuid,timestamptz,jsonb,boolean),public.tj_save_backtest_trade(uuid,uuid,timestamptz,jsonb,jsonb,boolean),public.tj_backtest_media(uuid,timestamptz) from public,anon;
grant execute on function public.tj_sync_backtests(jsonb),public.tj_save_backtest_run(uuid,timestamptz,jsonb,boolean),public.tj_save_backtest_trade(uuid,uuid,timestamptz,jsonb,jsonb,boolean),public.tj_backtest_media(uuid,timestamptz) to authenticated;
commit;

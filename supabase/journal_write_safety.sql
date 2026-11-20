-- Candidate only. Install and rehearse on staging; production activation is separate.
-- Existing tables, RLS, Office permissions, and stored records are retained.
begin;
set local lock_timeout='5s';
create table public.tj_write_receipts (
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_key text not null check(operation_key ~ '^[0-9a-f]{64}$'),
 intent jsonb not null, response jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(user_id,operation_key)
);
alter table public.tj_write_receipts enable row level security;
create policy own_write_receipts on public.tj_write_receipts for select to authenticated
 using(user_id=auth.uid() and public.tj_office_read_allowed());
revoke all on public.tj_write_receipts from public,anon,authenticated;
grant select on public.tj_write_receipts to authenticated;

create function public.tj_write_claim(operation_key text,intent jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare receipt public.tj_write_receipts;
begin
 if current_setting('request.path',true) not in ('/rpc/tj_replace_savings','/rpc/tj_save_progress','/rpc/tj_save_backtest_trade_v2') or current_setting('request.path',true) is null then raise exception 'Internal receipt operation' using errcode='42501';end if;
 if auth.uid() is null or operation_key is null or operation_key !~ '^[0-9a-f]{64}$' or intent is null then
  raise exception 'Invalid write receipt' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||operation_key,74231));
 select * into receipt from public.tj_write_receipts r where r.user_id=auth.uid() and r.operation_key=tj_write_claim.operation_key;
 if found then
  if receipt.intent is distinct from intent then raise exception 'Write receipt does not match this request' using errcode='22023';end if;
  return receipt.response;
 end if;
 return null;
end;$$;
create function public.tj_write_finish(operation_key text,intent jsonb,response jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null or current_setting('request.path',true) not in ('/rpc/tj_replace_savings','/rpc/tj_save_progress','/rpc/tj_save_backtest_trade_v2') or current_setting('request.path',true) is null then raise exception 'Internal receipt operation' using errcode='42501';end if;
 insert into public.tj_write_receipts values(auth.uid(),operation_key,intent,response,clock_timestamp());return response;
end;$$;
-- Receipt helpers cannot be called as public endpoints. Wrapper functions are
-- invokers and need execute; direct calls cannot grant access to business data.
revoke all on function public.tj_write_claim(text,jsonb),public.tj_write_finish(text,jsonb,jsonb) from public,anon;
grant execute on function public.tj_write_claim(text,jsonb),public.tj_write_finish(text,jsonb,jsonb) to authenticated;

create function public.tj_require_write_protocol(protocol text) returns void
language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if protocol is distinct from 'journal-write-v1' then raise sqlstate 'PT409' using message='client_update_required';end if;
 perform public.tj_broker_import_lock();
end;$$;
revoke all on function public.tj_require_write_protocol(text) from public,anon;
grant execute on function public.tj_require_write_protocol(text) to authenticated;

create function public.tj_replace_savings(workspace_id uuid,expected_rows jsonb,items jsonb,operation_key text,protocol text,finance_patch jsonb default null,expected_finance jsonb default null) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare previous jsonb; item jsonb; row_id uuid; result jsonb; request jsonb; seen uuid[] := '{}';
begin
 perform public.tj_require_write_protocol(protocol);
 if public.my_access()->'features'->'finance' is distinct from 'true'::jsonb then raise exception 'Finance changes unavailable' using errcode='42501';end if;
 perform 1 from public.accounts where id=workspace_id and user_id=auth.uid() for update;
 if not found then raise exception 'Workspace unavailable' using errcode='42501';end if;
 request:=jsonb_build_object('kind','savings','workspace',workspace_id,'base',expected_rows,'items',items,'finance',finance_patch,'financeBase',expected_finance);
 previous:=public.tj_write_claim(operation_key,request);if previous is not null then return previous;end if;
 if jsonb_typeof(items) is distinct from 'array' or jsonb_typeof(expected_rows) is distinct from 'array' then raise exception 'Invalid savings request' using errcode='22023';end if;
 if finance_patch is not null then
  perform 1 from public.finance_settings where account_id=workspace_id and user_id=auth.uid() for update;
  if (select jsonb_build_object('enabled',f.enabled,'tradingTarget',f.trading_target,'updatedAt',f.updated_at) from public.finance_settings f where account_id=workspace_id and user_id=auth.uid()) is distinct from expected_finance then raise sqlstate 'PT409' using message='Finance settings changed elsewhere. Keep your draft and reload.';end if;
  if jsonb_typeof(finance_patch->'enabled') is distinct from 'boolean' or jsonb_typeof(finance_patch->'tradingTarget') is distinct from 'number' or (finance_patch->>'tradingTarget')::numeric<0 then raise exception 'Invalid finance settings' using errcode='22023';end if;
  insert into public.finance_settings(account_id,user_id,enabled,trading_target) values(workspace_id,auth.uid(),(finance_patch->>'enabled')::boolean,(finance_patch->>'tradingTarget')::numeric)
   on conflict(account_id) do update set enabled=excluded.enabled,trading_target=excluded.trading_target;
 end if;
 -- Parent lock serializes replacement and the existing member locks serialize
 -- revocation. Row locks also coordinate with supported individual writers.
 perform 1 from public.savings_accounts where account_id=workspace_id and user_id=auth.uid() order by id for update;
 if (select count(*) from jsonb_array_elements(expected_rows)) <> (select count(*) from public.savings_accounts where account_id=workspace_id and user_id=auth.uid())
  or exists(select 1 from jsonb_array_elements(expected_rows) e group by e->>'id' having count(*)>1)
  or exists(select 1 from jsonb_array_elements(expected_rows) e left join public.savings_accounts s on s.id=(e->>'id')::uuid and s.account_id=workspace_id and s.user_id=auth.uid()
    where s.id is null or s.updated_at is distinct from (e->>'updatedAt')::timestamptz) then
  raise sqlstate 'PT409' using message='Savings changed elsewhere. Keep your draft and reload.';end if;
 for item in select * from jsonb_array_elements(items) loop
  if jsonb_typeof(item) is distinct from 'object' or nullif(trim(item->>'name'),'') is null
   or (item->>'target')::numeric < 0 or (item->>'allocationPct')::numeric not between 0 and 100
   or (item->>'reminderMinutes')::numeric not between 1 and 10080
   or (item->>'reminderMinutes')::numeric <> trunc((item->>'reminderMinutes')::numeric)
   or jsonb_typeof(item->'target') is distinct from 'number' or jsonb_typeof(item->'allocationPct') is distinct from 'number' or jsonb_typeof(item->'reminderMinutes') is distinct from 'number'
   or not item ?& array['id','target','allocationPct','reminderMinutes'] then raise exception 'Invalid savings values' using errcode='22023';end if;
  if coalesce(item->>'id','') like 'draft-%' then row_id:=gen_random_uuid();else row_id:=(item->>'id')::uuid;end if;
  if row_id is null or row_id=any(seen) then raise exception 'Duplicate savings identity' using errcode='22023';end if;seen:=array_append(seen,row_id);
  if item->>'balanceId' is not null and not exists(select 1 from public.workspace_balances b where b.id=(item->>'balanceId')::uuid and b.workspace_id=tj_replace_savings.workspace_id and b.user_id=auth.uid()) then raise exception 'Balance unavailable' using errcode='42501';end if;
  if exists(select 1 from public.savings_accounts s where s.id=row_id and s.account_id<>workspace_id) then raise exception 'Savings unavailable' using errcode='42501';end if;
  insert into public.savings_accounts(id,user_id,account_id,balance_id,name,target,allocation_pct,transfer_interval,reminder_minutes)
   values(row_id,auth.uid(),workspace_id,(item->>'balanceId')::uuid,trim(item->>'name'),(item->>'target')::numeric,(item->>'allocationPct')::numeric,coalesce(item->>'interval','Manual'),(item->>'reminderMinutes')::integer)
   on conflict(id) do update set name=excluded.name,target=excluded.target,allocation_pct=excluded.allocation_pct,balance_id=excluded.balance_id,transfer_interval=excluded.transfer_interval,reminder_minutes=excluded.reminder_minutes
   where savings_accounts.account_id=workspace_id and savings_accounts.user_id=auth.uid();
  if not found then raise exception 'Savings unavailable' using errcode='42501';end if;
 end loop;
 delete from public.savings_accounts where account_id=workspace_id and user_id=auth.uid() and not(id=any(seen));
 select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at,s.id),'[]') into result from public.savings_accounts s where s.account_id=workspace_id and s.user_id=auth.uid();
 if finance_patch is not null then result:=jsonb_build_object('savings',result,'finance',(select to_jsonb(f) from public.finance_settings f where account_id=workspace_id and user_id=auth.uid()));end if;
 return public.tj_write_finish(operation_key,request,result);
end;$$;
revoke all on function public.tj_replace_savings(uuid,jsonb,jsonb,text,text,jsonb,jsonb) from public,anon;
grant execute on function public.tj_replace_savings(uuid,jsonb,jsonb,text,text,jsonb,jsonb) to authenticated;

create function public.tj_save_progress(kind text,target_id uuid,expected_version timestamptz,value jsonb,operation_key text,protocol text) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare prior jsonb; current_row jsonb; request jsonb; result jsonb; row_id uuid; parent uuid;
begin
 perform public.tj_require_write_protocol(protocol);
 if kind is null or kind not in ('challenge','balance-challenge','period-review') then raise exception 'Unsupported progress kind' using errcode='22023';end if;
 if public.my_access()->'features'->(case when kind='period-review' then 'trade_logs' else 'challenge' end) is distinct from 'true'::jsonb then raise exception 'Feature unavailable' using errcode='42501';end if;
 parent:=target_id;
 if kind='balance-challenge' then select workspace_id into parent from public.workspace_balances where id=target_id and user_id=auth.uid() for update;end if;
 perform 1 from public.accounts where id=parent and user_id=auth.uid() for update;
 if not found then raise exception 'Workspace unavailable' using errcode='42501';end if;
 request:=jsonb_build_object('kind',kind,'target',target_id,'base',expected_version,'value',value);
 prior:=public.tj_write_claim(operation_key,request);if prior is not null then return prior;end if;
 if kind='period-review' then
  select to_jsonb(p) into current_row from public.period_reviews p where p.account_id=target_id and p.user_id=auth.uid() and p.period_type=value->>'type' and p.period_key=value->>'key' for update;
 elsif kind='challenge' then select to_jsonb(p) into current_row from public.challenge_progress p where p.account_id=target_id and p.user_id=auth.uid() for update;
 else select to_jsonb(p) into current_row from public.balance_challenge_progress p where p.balance_id=target_id and p.user_id=auth.uid() for update;end if;
 if current_row->>'updated_at' is null and expected_version is not null or current_row->>'updated_at' is not null and (current_row->>'updated_at')::timestamptz is distinct from expected_version then raise sqlstate 'PT409' using message='Progress changed elsewhere. Keep your draft and reload.';end if;
 if value->'remove'='true'::jsonb then
  if kind='period-review' then raise exception 'Unsupported deletion' using errcode='22023';end if;
  if kind='challenge' then
   update public.accounts set rating_style=jsonb_set(case when rating_style is null or rating_style='stars' then '{}'::jsonb else rating_style::jsonb end,'{challengeEnabled}','false')::text where id=target_id and user_id=auth.uid();
   delete from public.challenge_progress where account_id=target_id and user_id=auth.uid();
  else
   update public.workspace_balances set challenge_enabled=false where id=target_id and user_id=auth.uid();
   delete from public.balance_challenge_progress where balance_id=target_id and user_id=auth.uid();
  end if;
  return public.tj_write_finish(operation_key,request,jsonb_build_object('deleted',target_id));
 end if;
 if kind='period-review' then
  row_id:=coalesce((current_row->>'id')::uuid,gen_random_uuid());
  insert into public.period_reviews(id,user_id,account_id,period_type,period_key,content,completed) values(row_id,auth.uid(),target_id,value->>'type',value->>'key',coalesce(value->'content','{}'),coalesce((value->>'completed')::boolean,false))
   on conflict(account_id,period_type,period_key) do update set content=excluded.content,completed=excluded.completed,updated_at=clock_timestamp() returning to_jsonb(period_reviews.*) into result;
 elsif kind='challenge' then
  insert into public.challenge_progress(account_id,user_id,active_level,statuses,notes,automation,updated_at) values(target_id,auth.uid(),(value->>'active_level')::integer,coalesce(value->'statuses','{}'),coalesce(value->'notes','{}'),value->'automation',clock_timestamp())
   on conflict(account_id) do update set active_level=excluded.active_level,statuses=excluded.statuses,notes=excluded.notes,automation=excluded.automation,updated_at=clock_timestamp() returning to_jsonb(challenge_progress.*) into result;
 else
  insert into public.balance_challenge_progress(balance_id,user_id,active_level,statuses,notes,automation,updated_at) values(target_id,auth.uid(),(value->>'active_level')::integer,coalesce(value->'statuses','{}'),coalesce(value->'notes','{}'),value->'automation',clock_timestamp())
   on conflict(balance_id) do update set active_level=excluded.active_level,statuses=excluded.statuses,notes=excluded.notes,automation=excluded.automation,updated_at=clock_timestamp() returning to_jsonb(balance_challenge_progress.*) into result;
 end if;
 return public.tj_write_finish(operation_key,request,result);
end;$$;
revoke all on function public.tj_save_progress(text,uuid,timestamptz,jsonb,text,text) from public,anon;
grant execute on function public.tj_save_progress(text,uuid,timestamptz,jsonb,text,text) to authenticated;
notify pgrst,'reload schema';
commit;

begin;
set local lock_timeout='5s';
create function tj_office.guard_backtest_model_reference() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare ref jsonb; previous jsonb; previous_stamp timestamptz; workspace public.accounts; item jsonb; path text; headers jsonb;
begin
 if auth.uid() is null then return new;end if;
 path:=current_setting('request.path',true);
 headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
 ref:=new.trade_data->'entryModelRef';
 if tg_op='UPDATE' then previous:=old.trade_data->'entryModelRef';previous_stamp:=old.updated_at;
 else select trade_data->'entryModelRef',updated_at into previous,previous_stamp from public.backtest_trades where id=new.id and user_id=auth.uid();end if;
 if previous_stamp is not null and coalesce(path,'') not in ('/rpc/tj_save_backtest_trade','/rpc/tj_save_backtest_trade_v2')
  and (nullif(substring(coalesce(headers->>'x-client-info','') from 'aai-record-revision:([^[:space:]]+)'),'')::timestamptz is distinct from previous_stamp) then raise sqlstate 'PT409' using message='client_update_required';end if;
 if previous is not null and previous<>'null'::jsonb and not(new.trade_data ? 'entryModelRef') then raise sqlstate 'PT409' using message='client_update_required',hint='Keep your draft and refresh before saving this linked trade.';end if;
 if coalesce(ref,'null'::jsonb)<>'null'::jsonb and (new.trade_data->>'strategy' is distinct from ref->>'labelAtSelection' or new.trade_data->>'entryType' is distinct from ref->>'labelAtSelection') then raise sqlstate 'PT409' using message='client_update_required',hint='Keep the original model reference and select a current model explicitly.';end if;
 if ref is not distinct from previous then return new;end if;
 if coalesce(ref,'null'::jsonb)='null'::jsonb and coalesce(previous,'null'::jsonb)='null'::jsonb then return new;end if;
 path:=current_setting('request.path',true);
 headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
 if path is distinct from '/rpc/tj_save_backtest_trade_v2' or coalesce(headers->>'x-client-info','') !~ '(^|[[:space:]])backtest-model-v1($|[[:space:]])' then raise sqlstate 'PT409' using message='client_update_required';end if;
 if ref='null'::jsonb then return new;end if;
 if jsonb_typeof(ref) is distinct from 'object' or ref->'version' is distinct from '1'::jsonb
  or nullif(ref->>'workspaceId','') is null or nullif(ref->>'entryTypeId','') is null or nullif(ref->>'labelAtSelection','') is null
  or (ref - array['version','workspaceId','entryTypeId','labelAtSelection'])<>'{}'::jsonb then raise exception 'Invalid model reference' using errcode='22023';end if;
 select * into workspace from public.accounts where id=(ref->>'workspaceId')::uuid and user_id=auth.uid() for share;
 if not found then raise exception 'Model workspace unavailable' using errcode='42501';end if;
 select it into item from jsonb_array_elements(coalesce(workspace.classification->'entryTypes'->'items','[]')) it where it->>'id'=ref->>'entryTypeId';
 if item is null and workspace.classification->'entryTypes' is null and exists(select 1 from jsonb_array_elements_text(coalesce(workspace.rating_style::jsonb->'confluenceSessions','[]')) label where label=ref->>'entryTypeId') then
  item:=jsonb_build_object('name',ref->>'entryTypeId','archived',false);
 end if;
 if item is null or item->'archived' is distinct from 'false'::jsonb or item->>'name' is distinct from ref->>'labelAtSelection'
  or new.trade_data->>'entryType' is distinct from ref->>'labelAtSelection' or new.trade_data->>'strategy' is distinct from ref->>'labelAtSelection' then raise exception 'Select an available Entry Model from this workspace' using errcode='22023';end if;
 return new;
end;$$;
revoke all on function tj_office.guard_backtest_model_reference() from public,anon,authenticated;
create trigger tj_backtest_model_reference before insert or update on public.backtest_trades for each row execute function tj_office.guard_backtest_model_reference();

create function public.tj_save_backtest_trade_v2(row_id uuid,run_id uuid,expected_version timestamptz,trade_data jsonb,media jsonb,remove_row boolean,operation_key text,protocol text) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare request jsonb; prior jsonb; result jsonb;
begin
 perform public.tj_require_write_protocol(protocol);
 if public.my_access()->'features'->'strategy_testing' is distinct from 'true'::jsonb then raise exception 'Strategy Testing changes unavailable' using errcode='42501';end if;
 perform 1 from public.backtest_runs where id=run_id and user_id=auth.uid() for update;
 if not found then raise exception 'Backtest unavailable' using errcode='42501';end if;
 request:=jsonb_build_object('kind','backtest','id',row_id,'run',run_id,'base',expected_version,'data',trade_data,'media',media,'remove',remove_row);
 prior:=public.tj_write_claim(operation_key,request);if prior is not null then return prior;end if;
 result:=public.tj_save_backtest_trade(row_id,run_id,expected_version,trade_data,media,remove_row);
 return public.tj_write_finish(operation_key,request,result);
end;$$;
revoke all on function public.tj_save_backtest_trade_v2(uuid,uuid,timestamptz,jsonb,jsonb,boolean,text,text) from public,anon;
grant execute on function public.tj_save_backtest_trade_v2(uuid,uuid,timestamptz,jsonb,jsonb,boolean,text,text) to authenticated;
notify pgrst,'reload schema';
commit;

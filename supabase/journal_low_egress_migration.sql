-- Run once in Supabase SQL Editor. No rows, screenshots or buckets are deleted.
-- RPCs run as the signed-in user and preserve existing row-level security.
begin;

create or replace function public.tj_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'accounts','trades','rules','journal_entries','user_settings',
    'premarket_markups','trade_reviews','period_reviews','finance_settings',
    'savings_accounts','finance_movements','workspace_balances','trade_balance_results'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I add column if not exists updated_at timestamptz not null default clock_timestamp()', table_name);
      execute format('drop trigger if exists %I on public.%I', 'tj_' || table_name || '_updated_at', table_name);
      execute format('create trigger %I before update on public.%I for each row execute function public.tj_set_updated_at()', 'tj_' || table_name || '_updated_at', table_name);
      execute format('create index if not exists %I on public.%I (user_id)', 'tj_' || table_name || '_sync_user', table_name);
    end if;
  end loop;
end;
$$;

-- Replace inline image bytes with revisioned references; preserve array shape,
-- captions and sessionReview so counts and journal metrics remain accurate.
create or replace function public.tj_image_references(value jsonb, owner_id uuid, table_name text, record_id text, revision text, image_path text[] default '{}')
returns jsonb language plpgsql immutable set search_path = '' as $$
declare result jsonb; item record;
begin
  if jsonb_typeof(value) = 'string' and (value #>> '{}') like 'data:image/%' then
    return to_jsonb('tj-image:' || jsonb_build_object('user',owner_id,'table',table_name,'id',record_id,'version',revision,'path',image_path)::text);
  elsif jsonb_typeof(value) = 'array' then
    result := '[]'::jsonb;
    for item in select v, n from jsonb_array_elements(value) with ordinality as a(v,n) loop
      result := result || jsonb_build_array(public.tj_image_references(item.v,owner_id,table_name,record_id,revision,image_path || (item.n - 1)::text));
    end loop;
    return result;
  elsif jsonb_typeof(value) = 'object' then
    result := '{}'::jsonb;
    for item in select key, v from jsonb_each(value) as a(key,v) loop
      result := result || jsonb_build_object(item.key,public.tj_image_references(item.v,owner_id,table_name,record_id,revision,image_path || item.key));
    end loop;
    return result;
  end if;
  return value;
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
    table_known := coalesce(known -> table_name,'{}'::jsonb);
    execute format($query$
      with current_rows as materialized (
        select to_jsonb(t) as row, t.%I::text as key from public.%I t where t.user_id = $1
      )
      select
        coalesce((select jsonb_agg(case when $3 = any(array['trades','premarket_markups','trade_reviews']) then
          jsonb_set(row,'{screenshots}',public.tj_image_references(coalesce(row -> 'screenshots','null'::jsonb),$1,$3,key,md5(coalesce(row -> 'screenshots','null'::jsonb)::text)))
          else row end)
          from current_rows where ($2 ->> key) is distinct from (row ->> 'updated_at')), '[]'::jsonb),
        coalesce((select jsonb_agg(k) from jsonb_object_keys($2) k where not exists(select 1 from current_rows c where c.key = k)), '[]'::jsonb)
    $query$,key_column,table_name) into changed, removed using owner_id, table_known, table_name;
    result := result || jsonb_build_object(table_name,jsonb_build_object('rows',changed,'deleted',removed,'available',true));
  end loop;
  return jsonb_build_object('tables',result);
end;
$$;

-- Fetch only the requested screenshot, not its entire trade/markup/review.
create or replace function public.tj_journal_image(source_table text, row_id uuid, image_path text[], image_version text)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare image jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if source_table <> all(array['trades','premarket_markups','trade_reviews']) then raise exception 'Invalid screenshot table'; end if;
  execute format('select screenshots #> $3 from public.%I where id = $1 and user_id = $2 and md5(screenshots::text) = $4', source_table)
    into image using row_id, auth.uid(), image_path, image_version;
  return image;
end;
$$;

revoke all on function public.tj_sync_journal(jsonb) from public, anon;
revoke all on function public.tj_journal_image(text,uuid,text[],text) from public, anon;
revoke all on function public.tj_image_references(jsonb,uuid,text,text,text,text[]) from public, anon;
grant execute on function public.tj_sync_journal(jsonb) to authenticated;
grant execute on function public.tj_journal_image(text,uuid,text[],text) to authenticated;
grant execute on function public.tj_image_references(jsonb,uuid,text,text,text,text[]) to authenticated;
commit;

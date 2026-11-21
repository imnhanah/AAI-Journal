-- Requires entitlement preview, journal tables/RLS and the Case Study CAS RPC.
-- May be tested independently of cloud-write enforcement. This endpoint always
-- checks effective entitlement; it does not install or alter a write policy.
-- Persistent review conflicts use PT409 (HTTP 409). Do not use 40001 here:
-- PostgREST 14 retries serialization failures, so a persistent conflict loops.
begin;
create function public.tj_publish_device_journal(rows_by_table jsonb, device_library jsonb, preview boolean)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
  relation text;
  key_name text;
  item jsonb;
  current_row jsonb;
  expected_row jsonb;
  columns text;
  selected_columns text;
  inserted integer;
  conflicts jsonb := '[]';
  cloud_library jsonb;
  cloud_revision bigint;
  outcome text;
  parent_table text;
  parent_key text;
  parent_found boolean;
begin
  if caller is null or not coalesce((select cloud_writes_allowed from public.tj_current_entitlements()), false) then
    raise exception 'Cloud write access is required.' using errcode = '42501';
  end if;
  if jsonb_typeof(rows_by_table) is distinct from 'object' or preview is null
     or (device_library is not null and jsonb_typeof(device_library) <> 'object') then
    raise exception 'Invalid device journal.' using errcode = '22023';
  end if;
  if device_library is not null then
    select l.library, l.revision into cloud_library, cloud_revision
    from public.profile_case_study_libraries l where l.user_id = caller;
    if cloud_library is distinct from device_library and cloud_revision is not null then
      conflicts := conflicts || jsonb_build_array(jsonb_build_object('table', 'Case Studies', 'revision', cloud_revision));
    end if;
  end if;
  if not preview and jsonb_array_length(conflicts) > 0 then
    raise exception 'The cloud Case Study Library differs. Review the two libraries before publishing.' using errcode = 'PT409';
  end if;
  for relation, key_name in values
    ('accounts','id'), ('workspace_balances','id'), ('rules','id'),
    ('premarket_markups','id'), ('trades','id'), ('trade_balance_results','id'),
    ('journal_entries','id'), ('trade_reviews','id'), ('period_reviews','id'),
    ('finance_settings','account_id'), ('savings_accounts','id'), ('finance_movements','id'),
    ('challenge_progress','account_id'), ('balance_challenge_progress','balance_id'),
    ('backtest_runs','id'), ('backtest_trades','id'), ('user_settings','user_id')
  loop
    for item in select value from jsonb_array_elements(coalesce(rows_by_table -> relation, '[]'))
    loop
      item := (item - 'updated_at' - 'created_at' - 'user_id') || jsonb_build_object('user_id', caller);
      if item ->> key_name is null then
        raise exception 'A device record is missing its identifier.' using errcode = '22023';
      end if;

      if not preview then
        for parent_key, parent_table in values
          ('account_id','accounts'), ('workspace_id','accounts'), ('rule_id','rules'),
          ('premarket_markup_id','premarket_markups'), ('trade_id','trades'),
          ('balance_id','workspace_balances'), ('savings_account_id','savings_accounts'),
          ('run_id','backtest_runs')
        loop
          if item ->> parent_key is null then continue; end if;
          execute format('select exists (select 1 from public.%I where id = $1 and user_id = $2)', parent_table)
            into parent_found using (item ->> parent_key)::uuid, caller;
          if not parent_found then
            raise exception 'A device record references an unavailable parent.' using errcode = '23503';
          end if;
        end loop;
      end if;
      select string_agg(format('%I', a.attname), ','),
             string_agg(format('r.%I', a.attname), ',')
        into columns, selected_columns
      from pg_attribute a
      where a.attrelid = format('public.%I', relation)::regclass and a.attnum > 0
        and not a.attisdropped and a.attgenerated = '' and item ? a.attname;
      execute format('select to_jsonb(r) from jsonb_populate_record(null::public.%I, $1) r', relation)
        into expected_row using item;
      select jsonb_object_agg(e.key, e.value) into expected_row
      from jsonb_each(expected_row) e where item ? e.key;
      execute format('select to_jsonb(r) from public.%I r where %I = $1 and user_id = $2', relation, key_name)
        into current_row using (item ->> key_name)::uuid, caller;

      if current_row = ((current_row - array(select jsonb_object_keys(expected_row))) || expected_row) then continue; end if;

      -- These tables have a second unique key. Report a collision in the
      -- preview rather than discovering it after uploading images.
      if current_row is null and preview then
        case relation
          when 'workspace_balances' then
            select to_jsonb(r) into current_row from public.workspace_balances r
            where r.user_id = caller and r.workspace_id = (item->>'workspace_id')::uuid and r.name = item->>'name';
          when 'trade_balance_results' then
            select to_jsonb(r) into current_row from public.trade_balance_results r
            where r.user_id = caller and r.trade_id = (item->>'trade_id')::uuid and r.balance_id = (item->>'balance_id')::uuid;
          when 'journal_entries' then
            select to_jsonb(r) into current_row from public.journal_entries r
            where r.user_id = caller and r.account_id = (item->>'account_id')::uuid
              and r.rule_id = (item->>'rule_id')::uuid and r.entry_date = (item->>'entry_date')::date;
          when 'period_reviews' then
            select to_jsonb(r) into current_row from public.period_reviews r
            where r.user_id = caller and r.account_id = (item->>'account_id')::uuid
              and r.period_type = item->>'period_type' and r.period_key = item->>'period_key';
          else null;
        end case;
      end if;

      -- Signup provisions an empty preferences row. Initialize lists only
      -- while the exact row still matches the version just read.
      if relation = 'user_settings' and current_row is not null
        and current_row @> '{"custom_type_tags":[],"custom_mistake_tags":[],"custom_confluence_sessions":[],"custom_instruments":[]}' then
        if not preview then
          update public.user_settings r
          set custom_type_tags = item->'custom_type_tags',
              custom_mistake_tags = item->'custom_mistake_tags',
              custom_confluence_sessions = item->'custom_confluence_sessions',
              custom_instruments = item->'custom_instruments'
          where r.user_id = caller and to_jsonb(r) = current_row;
          if not found then raise exception 'Cloud settings changed. Preview again.' using errcode = 'PT409'; end if;
        end if;
        continue;
      end if;
      if current_row is not null then
        if not preview then raise exception 'A cloud record differs. Preview again.' using errcode = 'PT409'; end if;
        conflicts := conflicts || jsonb_build_array(jsonb_build_object(
          'table', relation, 'recordId', current_row->>key_name, 'revision', current_row->>'updated_at'));
      elsif not preview then
        execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) r on conflict do nothing',
                       relation, columns, selected_columns, relation) using item;
        get diagnostics inserted = row_count;
        if inserted = 0 then
          execute format('select to_jsonb(r) from public.%I r where %I = $1 and user_id = $2', relation, key_name)
            into current_row using (item ->> key_name)::uuid, caller;
          if current_row is distinct from ((current_row - array(select jsonb_object_keys(expected_row))) || expected_row)
             or current_row is null then
            raise exception 'A cloud record already uses this identifier. Preview again.' using errcode = 'PT409';
          end if;
        end if;
      end if;
    end loop;
  end loop;

  if not preview and device_library is not null and cloud_revision is null then
    select r.outcome into outcome from public.tj_save_profile_case_study_library(null, device_library) r;
    if outcome is distinct from 'saved' then
      raise exception 'A cloud Case Study Library appeared. Preview again.' using errcode = 'PT409';
    end if;
  end if;
  return jsonb_build_object('conflicts', conflicts, 'caseStudyRevision', cloud_revision);
end;
$$;
revoke all on function public.tj_publish_device_journal(jsonb, jsonb, boolean) from public, anon;
grant execute on function public.tj_publish_device_journal(jsonb, jsonb, boolean) to authenticated;
commit;

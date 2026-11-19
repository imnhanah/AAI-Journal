-- Apply after the journal delta and Owner Office write guards. No existing row is updated.
begin;
set local lock_timeout = '5s';
alter table public.accounts add column if not exists classification jsonb;
alter table public.accounts add constraint tj_classification_object
  check (classification is null or (jsonb_typeof(classification) = 'object' and octet_length(classification::text) <= 262144));

-- Extend only the accounts projection of the installed delta helper.
do $projection$
declare definition text;
  needle constant text := $literal$when 'accounts' then 'id,user_id,$literal$;
begin
  select pg_get_functiondef('public.tj_bootstrap_metadata(jsonb,uuid,text,text)'::regprocedure) into definition;
  if strpos(definition,needle) = 0
     or length(definition)-length(replace(definition,needle,'')) <> length(needle)
     or definition !~ 'rating_style' or definition !~ 'updated_at' then
    raise exception 'Unexpected journal bootstrap accounts projection';
  end if;
  execute replace(definition,needle,$literal$when 'accounts' then 'classification,id,user_id,$literal$);
end
$projection$;

create function tj_office.classification_protocol() returns boolean
language sql stable set search_path = pg_catalog as $$
  select coalesce('workspace-classification-v1' = any(string_to_array(nullif(current_setting('request.headers',true),'')::jsonb ->> 'x-client-info',' ')),false);
$$;
revoke all on function tj_office.classification_protocol() from public,anon,authenticated;

-- This trigger is invoker-mode so ordinary account UPDATE cannot pretend to
-- be the narrowly scoped SECURITY DEFINER configuration save.
create function public.tj_guard_workspace_classification() returns trigger
language plpgsql set search_path = pg_catalog as $$
declare old_settings jsonb; new_settings jsonb; trusted boolean;
begin
  if auth.uid() is null then return new; end if;
  select current_user = pg_get_userbyid(relowner) into trusted from pg_class where oid=tg_relid;
  if tg_op='INSERT' then
    if new.classification is not null and current_setting('request.path',true) is distinct from '/rpc/tj_publish_device_journal' then
      raise exception 'Restore workspace configurations using device journal promotion' using errcode='42501';
    end if;
    -- Existing owner-checked journal promotion can restore a new workspace.
    -- Old inserts omit the field and remain valid.
    if new.classification is not null and not coalesce('workspace-classification-v1' = any(string_to_array(nullif(current_setting('request.headers',true),'')::jsonb ->> 'x-client-info',' ')),false) then
      raise sqlstate 'PT409' using message='client_update_required';
    end if;
    return new;
  end if;
  if new.classification is distinct from old.classification and not trusted then
    raise exception 'Use the workspace classification save operation' using errcode='42501';
  end if;
  if old.classification is null or new.rating_style is not distinct from old.rating_style then return new; end if;
  begin old_settings := old.rating_style::jsonb; exception when invalid_text_representation then old_settings := '{}'; end;
  begin new_settings := new.rating_style::jsonb; exception when invalid_text_representation then new_settings := '{}'; end;
  if (old.classification ? 'entryTypes' and coalesce(new_settings->'confluenceSessions','[]') is distinct from coalesce(old_settings->'confluenceSessions','[]'))
    or (old.classification ? 'confluences' and coalesce(new_settings->'typeTags','[]') is distinct from coalesce(old_settings->'typeTags','[]')) then
    raise sqlstate 'PT409' using message='client_update_required';
  end if;
  return new;
end $$;
revoke all on function public.tj_guard_workspace_classification() from public,anon,authenticated;
create trigger tj_workspace_classification_settings before insert or update of rating_style,classification on public.accounts
  for each row execute function public.tj_guard_workspace_classification();

create function tj_office.classification_items(section text, value jsonb) returns setof jsonb
language sql immutable set search_path = pg_catalog as $$
  select item from jsonb_array_elements(case when section='entryTypes' then coalesce(value->'items','[]') else '[]' end) item
  union all
  select tag from jsonb_array_elements(case when section='confluences' then coalesce(value->'categories','[]') else '[]' end) category
  cross join lateral jsonb_array_elements(category->'tags') tag;
$$;
revoke all on function tj_office.classification_items(text,jsonb) from public,anon,authenticated;

create function public.tj_validate_workspace_classification_restore() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare part record;
begin
  if new.classification is null then return new; end if;
  if jsonb_typeof(new.classification) is distinct from 'object' then
    raise exception 'Invalid workspace classifications' using errcode='22023';
  end if;
  for part in select * from jsonb_each(new.classification) loop
    if part.key not in ('entryTypes','confluences','ruleOrder')
      or jsonb_typeof(part.value->'revision') is distinct from 'number'
      or coalesce(part.value->>'revision','') !~ '^[1-9][0-9]{0,8}$'
      or jsonb_typeof(part.value->(case part.key when 'entryTypes' then 'items' when 'confluences' then 'categories' else 'ids' end)) is distinct from 'array' then
      raise exception 'Invalid workspace classification section' using errcode='22023';
    end if;
    if part.key='confluences' and exists(select 1 from jsonb_array_elements(part.value->'categories') category
      where jsonb_typeof(category->'tags') is distinct from 'array' or jsonb_typeof(category->'archived') is distinct from 'boolean'
        or nullif(btrim(category->>'id'),'') is null or nullif(btrim(category->>'name'),'') is null
        or coalesce(category->>'mode','') not in ('single','multi')) then
      raise exception 'Invalid restored Confluence category' using errcode='22023';
    end if;
    if exists(select 1 from tj_office.classification_items(part.key,part.value) item
      where nullif(btrim(item->>'id'),'') is null or nullif(btrim(item->>'name'),'') is null
        or jsonb_typeof(item->'description') is distinct from 'string' or jsonb_typeof(item->'archived') is distinct from 'boolean')
      or exists(select 1 from tj_office.classification_items(part.key,part.value) item group by item->>'id' having count(*)>1) then
      raise exception 'Invalid restored classification items' using errcode='22023';
    end if;
  end loop;
  return new;
end $$;
revoke all on function public.tj_validate_workspace_classification_restore() from public,anon,authenticated;
create trigger tj_workspace_classification_restore before insert on public.accounts
  for each row when (new.classification is not null) execute function public.tj_validate_workspace_classification_restore();

create function public.tj_save_workspace_classification(workspace_id uuid, section text, expected_revision bigint, expected_legacy jsonb, value jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
#variable_conflict use_variable
declare
  actor uuid := auth.uid();
  workspace public.accounts%rowtype;
  old_section jsonb;
  prefs jsonb;
  source_list jsonb;
  rule_ids jsonb;
  new_catalog jsonb;
  revision bigint;
  item jsonb;
  allowed_ids text[];
begin
  if actor is null or not tj_office.classification_protocol() then
    raise exception 'Compatible signed-in journal required' using errcode='42501';
  end if;
  if section not in ('entryTypes','confluences','ruleOrder') or section is null
    or jsonb_typeof(value) is distinct from 'object' or octet_length(value::text)>200000 then
    raise exception 'Invalid workspace classification request' using errcode='22023';
  end if;
  perform 1 from public.tj_member_access where user_id=actor for share;
  perform 1 from public.profiles where id=actor for share;
  if not tj_office.write_allowed(actor,'trade_logs') then
    raise exception 'Workspace classifications are read-only' using errcode='42501';
  end if;
  select * into workspace from public.accounts where id=workspace_id and user_id=actor for update;
  if not found then raise exception 'Workspace unavailable' using errcode='42501'; end if;
  old_section := workspace.classification->section;
  revision := coalesce((old_section->>'revision')::bigint,0);
  if revision is distinct from expected_revision then
    raise sqlstate 'PT409' using message='Journal Setup changed on another device. Reload, then retry your edit.';
  end if;

  if section='ruleOrder' then
    -- The account row lock also serializes new rules via their account FK.
    -- Holding existing rules prevents a concurrent removal during validation.
    perform 1 from public.rules where account_id=workspace.id and user_id=actor order by id for share;
    select coalesce(jsonb_agg(id order by id),'[]') into rule_ids from public.rules where account_id=workspace.id and user_id=actor;
    if jsonb_typeof(expected_legacy) is distinct from 'array'
      or (select coalesce(jsonb_agg(id order by id),'[]') from jsonb_array_elements_text(expected_legacy) id) <> rule_ids then
      raise sqlstate 'PT409' using message='Trading Rules changed on another device. Reload, then retry your reorder.';
    end if;
    if jsonb_typeof(value->'ids') is distinct from 'array'
      or (select coalesce(jsonb_agg(id order by id),'[]') from jsonb_array_elements_text(value->'ids') id) <> rule_ids then
      raise exception 'Rule order must contain each workspace rule exactly once' using errcode='22023';
    end if;
    value := jsonb_build_object('ids',value->'ids');
  else
    if section='entryTypes' and jsonb_typeof(value->'items') is distinct from 'array' then
      raise exception 'Invalid Entry Types' using errcode='22023';
    end if;
    if section='confluences' then
      if jsonb_typeof(value->'categories') is distinct from 'array' then raise exception 'Invalid categories' using errcode='22023'; end if;
      if exists(select 1 from jsonb_array_elements(value->'categories') c
        where nullif(btrim(c->>'id'),'') is null or nullif(btrim(c->>'name'),'') is null
          or coalesce(c->>'mode','') not in ('single','multi') or jsonb_typeof(c->'tags') is distinct from 'array'
          or jsonb_typeof(c->'archived') is distinct from 'boolean') then
        raise exception 'Invalid category fields' using errcode='22023';
      end if;
      if exists(select 1 from jsonb_array_elements(value->'categories') c group by c->>'id' having count(*)>1)
        or exists(select 1 from jsonb_array_elements(value->'categories') c
          where c->'archived'='false' group by lower(btrim(c->>'name')) having count(*)>1) then
        raise exception 'Duplicate category' using errcode='22023';
      end if;
      if exists(select 1 from jsonb_array_elements(coalesce(old_section->'categories','[]')) c
        where not exists(select 1 from jsonb_array_elements(value->'categories') n where c->>'id'=n->>'id')) then
        raise exception 'Archive existing categories to preserve their identities' using errcode='22023';
      end if;
    end if;

    if revision=0 then
      begin prefs := workspace.rating_style::jsonb; exception when invalid_text_representation then prefs := '{}'; end;
      source_list := coalesce(prefs->(case when section='entryTypes' then 'confluenceSessions' else 'typeTags' end),'[]');
      if source_list is distinct from expected_legacy then
        raise sqlstate 'PT409' using message='The older workspace list changed. Reload Journal Setup, then retry.';
      end if;
      select array_agg(id) into allowed_ids from jsonb_array_elements_text(source_list) id where length(btrim(id))>0;
    else
      select array_agg(it->>'id') into allowed_ids from tj_office.classification_items(section,old_section) it;
    end if;

    if exists(select 1 from tj_office.classification_items(section,value) it
      where nullif(btrim(it->>'id'),'') is null or nullif(btrim(it->>'name'),'') is null
        or jsonb_typeof(it->'name') is distinct from 'string' or jsonb_typeof(it->'description') is distinct from 'string'
        or jsonb_typeof(it->'archived') is distinct from 'boolean') then
      raise exception 'Invalid classification item' using errcode='22023';
    end if;
    if exists(select 1 from tj_office.classification_items(section,value) it group by it->>'id' having count(*)>1) then
      raise exception 'Duplicate classification identity' using errcode='22023';
    end if;
    if exists(select 1 from unnest(allowed_ids) legacy_id
      where not exists(select 1 from tj_office.classification_items(section,value) it where it->>'id'=legacy_id)) then
      raise exception 'Archive existing items to preserve their identities' using errcode='22023';
    end if;
    for item in select * from tj_office.classification_items(section,value) loop
      if not (coalesce((item->>'id')=any(allowed_ids),false))
        and (item->>'id') !~ ((case when section='entryTypes' then '^aai-entry:' else '^aai-tag:' end) || '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
        raise exception 'New classifications require an independent identifier' using errcode='22023';
      end if;
    end loop;
    value := case when section='entryTypes' then jsonb_build_object('items',value->'items') else jsonb_build_object('categories',value->'categories') end;
  end if;

  new_catalog := jsonb_set(coalesce(workspace.classification,'{}'),array[section],
    value || jsonb_build_object('revision',revision+1));
  update public.accounts set classification=new_catalog where id=workspace.id and user_id=actor;
  return new_catalog;
end $$;
revoke all on function public.tj_save_workspace_classification(uuid,text,bigint,jsonb,jsonb) from public,anon;
grant execute on function public.tj_save_workspace_classification(uuid,text,bigint,jsonb,jsonb) to authenticated;

create function public.tj_guard_trade_classification() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare
  config jsonb;
  expected_trade_stamp timestamptz;
  restoring_new_workspace boolean;
  entry_changed boolean;
  tags_changed boolean;
  previous_entry text;
  previous_tags jsonb := '[]';
  next_entry text;
  next_tags jsonb;
  key text;
  category jsonb;
  category_ids text[];
  prior_count integer;
  next_count integer;
begin
  if auth.uid() is null then return new; end if;
  if tg_op='UPDATE' then
    previous_entry := coalesce(nullif(old.entry_type,''),nullif(old.confluence_session,''));
    previous_tags := coalesce(old.types,'[]');
    entry_changed := coalesce(nullif(new.entry_type,''),nullif(new.confluence_session,'')) is distinct from previous_entry;
    tags_changed := coalesce(new.types,'[]') is distinct from previous_tags;
    -- Older clients mirror the effective legacy value into both fields.
    -- Keep the original corresponding storage fields on unrelated edits.
    if not entry_changed then
      new.entry_type := old.entry_type;
      new.confluence_session := old.confluence_session;
    end if;
    if not tags_changed then new.types := old.types; end if;
    if not (entry_changed or tags_changed) then return new; end if;
  else
    entry_changed := coalesce(nullif(new.entry_type,''),nullif(new.confluence_session,'')) is not null;
    tags_changed := coalesce(new.types,'[]') <> '[]';
  end if;
  select a.classification, a.xmin = pg_current_xact_id_if_assigned()::xid
    into config, restoring_new_workspace from public.accounts a
    where a.id=new.account_id and a.user_id=auth.uid() for share;
  if not coalesce((config ? 'entryTypes' and entry_changed) or (config ? 'confluences' and tags_changed),false) then return new; end if;
  if not tj_office.classification_protocol() then
    raise sqlstate 'PT409' using message='client_update_required';
  end if;
  if tg_op='UPDATE' then
    begin
      expected_trade_stamp := substring(nullif(current_setting('request.headers',true),'')::jsonb->>'x-client-info'
        from 'aai-trade-revision:([^[:space:]]+)')::timestamptz;
    exception when invalid_datetime_format or datetime_field_overflow then expected_trade_stamp := null;
    end;
    if expected_trade_stamp is distinct from old.updated_at or expected_trade_stamp is null then
      raise sqlstate 'PT409' using message='classification_conflict';
    end if;
  end if;
  -- A verified importer can restore historic selections on an account row
  -- inserted in its own transaction. Later writes use the normal rules.
  if tg_op='INSERT' and restoring_new_workspace
     and current_setting('request.path',true) = '/rpc/tj_publish_device_journal' then return new; end if;
  next_entry := coalesce(nullif(new.entry_type,''),nullif(new.confluence_session,''));
  next_tags := coalesce(new.types,'[]');
  if config ? 'entryTypes' and entry_changed and next_entry is distinct from previous_entry and next_entry is not null
    and not exists(select 1 from tj_office.classification_items('entryTypes',config->'entryTypes') it
      where it->>'id'=next_entry and it->'archived'='false') then
    raise sqlstate 'PT409' using message='classification_unavailable';
  end if;
  if config ? 'confluences' and tags_changed then
    if jsonb_typeof(next_tags) <> 'array' then raise exception 'Invalid Confluence selection' using errcode='22023'; end if;
    if (select count(*) from jsonb_array_elements_text(next_tags)) <>
       (select count(distinct k) from jsonb_array_elements_text(next_tags) k) then
      raise exception 'Duplicate Confluence selection' using errcode='22023';
    end if;
    for key in select * from jsonb_array_elements_text(next_tags) loop
      if not (previous_tags ? key) and not exists(select 1 from jsonb_array_elements(config #> '{confluences,categories}') c
        cross join lateral jsonb_array_elements(c->'tags') tag where c->'archived'='false' and tag->'archived'='false' and tag->>'id'=key) then
        raise sqlstate 'PT409' using message='classification_unavailable';
      end if;
    end loop;
    for category in select * from jsonb_array_elements(config #> '{confluences,categories}') c where c->>'mode'='single' loop
      select array_agg(tag->>'id') into category_ids from jsonb_array_elements(category->'tags') tag;
      select count(*) into prior_count from jsonb_array_elements_text(previous_tags) t where t=any(category_ids);
      select count(*) into next_count from jsonb_array_elements_text(next_tags) t where t=any(category_ids);
      if next_count>1 and (next_count<>prior_count or exists(select 1 from jsonb_array_elements_text(next_tags) t
        where t=any(category_ids) and not (previous_tags ? t))) then
        raise sqlstate 'PT409' using message='confluence_selection_limit';
      end if;
    end loop;
  end if;
  return new;
end $$;
revoke all on function public.tj_guard_trade_classification() from public,anon,authenticated;
create trigger tj_workspace_classification_trade before insert or update of entry_type,confluence_session,types on public.trades
  for each row execute function public.tj_guard_trade_classification();

notify pgrst,'reload schema';
commit;

begin;
create or replace function public.tj_guard_workspace_classification() returns trigger
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
  if old.classification ? 'legacyCatalogSource' and not trusted and new_settings->'entryConfluenceLibrary' is distinct from old_settings->'entryConfluenceLibrary' then raise sqlstate 'PT409' using message='client_update_required';end if;
  if (old.classification ? 'entryTypes' and coalesce(new_settings->'confluenceSessions','[]') is distinct from coalesce(old_settings->'confluenceSessions','[]'))
    or (old.classification ? 'confluences' and coalesce(new_settings->'typeTags','[]') is distinct from coalesce(old_settings->'typeTags','[]')) then
    raise sqlstate 'PT409' using message='client_update_required';
  end if;
  return new;
end $$;
create or replace function public.tj_validate_workspace_classification_restore() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare part record;
begin
  if new.classification is null then return new; end if;
  if jsonb_typeof(new.classification) is distinct from 'object' then
    raise exception 'Invalid workspace classifications' using errcode='22023';
  end if;
  for part in select * from jsonb_each(new.classification) loop
    if part.key='legacyCatalogSource' then
      if part.value->'version' is distinct from '1'::jsonb or jsonb_typeof(part.value->'entries') is distinct from 'array' or jsonb_typeof(part.value->'categories') is distinct from 'array' then raise exception 'Invalid original catalog' using errcode='22023';end if;
      continue;
    end if;
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
create function public.tj_convert_legacy_catalog(workspace_id uuid,expected_catalog jsonb,expected_classification jsonb,protocol text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare workspace public.accounts; prefs jsonb; source jsonb; e jsonb; c jsonb; a text; label text;
 entries jsonb:='[]';categories jsonb:='[]';tags jsonb;all_tags text[]:='{}';entry_names text[]:='{}';category_ids text[]:='{}';result jsonb;
begin
 perform public.tj_require_write_protocol(protocol);
 if not tj_office.classification_protocol() or not tj_office.write_allowed(auth.uid(),'trade_logs') then raise exception 'Workspace classifications are read-only' using errcode='42501';end if;
 select * into workspace from public.accounts where id=workspace_id and user_id=auth.uid() for update;
 if not found then raise exception 'Workspace unavailable' using errcode='42501';end if;
 prefs:=workspace.rating_style::jsonb;source:=prefs->'entryConfluenceLibrary';
 if source is distinct from expected_catalog or workspace.classification is distinct from expected_classification then raise sqlstate 'PT409' using message='The catalog changed. Keep the original and review again.';end if;
 if workspace.classification is not null then raise exception 'Both catalog versions exist; review their differences before conversion' using errcode='22023';end if;
 if source->'version' is distinct from '1'::jsonb or jsonb_typeof(source->'entries') is distinct from 'array' or jsonb_typeof(source->'categories') is distinct from 'array' then raise exception 'Unknown legacy catalog' using errcode='22023';end if;
 for e in select * from jsonb_array_elements(source->'entries') loop
  label:=e->>'label';
  if nullif(trim(label),'') is null or jsonb_typeof(e->'description') is distinct from 'string' or jsonb_typeof(e->'archived') is distinct from 'boolean' or label=any(entry_names) then raise exception 'Invalid or ambiguous legacy definition' using errcode='22023';end if;
  entry_names:=array_append(entry_names,label);
  for a in select * from jsonb_array_elements_text(coalesce(e->'aliases','[]')) loop
   if a<>label and (coalesce(prefs->'confluenceSessions','[]') ? a or exists(select 1 from public.trades t where t.account_id=workspace_id and t.user_id=auth.uid() and (t.entry_type=a or t.confluence_session=a))) then raise exception 'Historical alias needs an explicit mapping' using errcode='22023';end if;
  end loop;
  entries:=entries||jsonb_build_array(jsonb_build_object('id',label,'name',label,'description',e->>'description','archived',e->'archived'));
 end loop;
 -- Unknown historical values remain available as archived definitions. Their
 -- trade associations stay text-for-text identical; no trade row is updated.
 for label in select distinct v from (select jsonb_array_elements_text(coalesce(prefs->'confluenceSessions','[]')) v union all select coalesce(nullif(t.entry_type,''),t.confluence_session) from public.trades t where t.account_id=workspace_id and t.user_id=auth.uid()) x where nullif(v,'') is not null loop
  if not(label=any(entry_names)) then entry_names:=array_append(entry_names,label);entries:=entries||jsonb_build_array(jsonb_build_object('id',label,'name',label,'description','','archived',true));end if;
 end loop;
 for c in select * from jsonb_array_elements(source->'categories') loop
  if nullif(c->>'id','') is null or c->>'id'=any(category_ids) or nullif(trim(c->>'label'),'') is null or c->>'mode' not in ('single','multi') or jsonb_typeof(c->'tags') is distinct from 'array' then raise exception 'Invalid legacy category' using errcode='22023';end if;
  category_ids:=array_append(category_ids,c->>'id');tags:='[]';
  for e in select * from jsonb_array_elements(c->'tags') loop
   label:=e->>'label';
   if nullif(trim(label),'') is null or label=any(all_tags) or jsonb_typeof(e->'description') is distinct from 'string' or jsonb_typeof(e->'archived') is distinct from 'boolean' then raise exception 'Ambiguous duplicate or invalid legacy tag' using errcode='22023';end if;
   all_tags:=array_append(all_tags,label);
   for a in select * from jsonb_array_elements_text(coalesce(e->'aliases','[]')) loop
    if a<>label and (coalesce(prefs->'typeTags','[]') ? a or exists(select 1 from public.trades t where t.account_id=workspace_id and t.user_id=auth.uid() and coalesce(t.types,'[]') ? a)) then raise exception 'Historical alias needs an explicit mapping' using errcode='22023';end if;
   end loop;
   tags:=tags||jsonb_build_array(jsonb_build_object('id',label,'name',label,'description',e->>'description','archived',e->'archived'));
  end loop;
  categories:=categories||jsonb_build_array(jsonb_build_object('id',c->>'id','name',c->>'label','description',coalesce(c->>'description',''),'archived',coalesce((c->>'archived')::boolean,false),'mode',c->>'mode','tags',tags));
 end loop;
 tags:='[]';
 for label in select distinct v from (select jsonb_array_elements_text(coalesce(prefs->'typeTags','[]')) v union all select jsonb_array_elements_text(coalesce(t.types,'[]')) from public.trades t where t.account_id=workspace_id and t.user_id=auth.uid()) x where nullif(v,'') is not null loop
  if not(label=any(all_tags)) then all_tags:=array_append(all_tags,label);tags:=tags||jsonb_build_array(jsonb_build_object('id',label,'name',label,'description','','archived',true));end if;
 end loop;
 if tags<>'[]'::jsonb then
  if 'category:ungrouped'=any(category_ids) then
   select jsonb_agg(case when cat->>'id'='category:ungrouped' then jsonb_set(cat,'{tags}',cat->'tags'||tags) else cat end) into categories from jsonb_array_elements(categories) cat;
  else categories:=categories||jsonb_build_array(jsonb_build_object('id','category:ungrouped','name','Ungrouped','description','','archived',false,'mode','multi','tags',tags));end if;
 end if;
 result:=jsonb_build_object('entryTypes',jsonb_build_object('revision',1,'items',entries),'confluences',jsonb_build_object('revision',1,'categories',categories),'legacyCatalogSource',source);
 update public.accounts set classification=result where id=workspace_id and user_id=auth.uid();
 return result;
end;$$;
revoke all on function public.tj_convert_legacy_catalog(uuid,jsonb,jsonb,text) from public,anon;
grant execute on function public.tj_convert_legacy_catalog(uuid,jsonb,jsonb,text) to authenticated;
notify pgrst,'reload schema';
commit;

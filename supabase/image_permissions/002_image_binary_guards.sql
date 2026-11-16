-- No journal-write restriction: only NEW image binary occurrences are guarded.
-- Existing binary values and their permitted counts remain readable/editable.
begin;
create or replace function tj_images.binary_sources(value jsonb,depth integer default 0) returns setof text
language plpgsql immutable set search_path=pg_catalog as $fn$
declare child jsonb;scalar text;parsed jsonb;image_match text[];
begin
 if depth>32 then raise exception 'Image metadata nesting exceeds the supported safe depth'; end if;
 if jsonb_typeof(value) in ('array','object') then
  for child in select v from jsonb_path_query(value,'$.*') v where jsonb_typeof(value)='object'
    union all select v from jsonb_array_elements(case when jsonb_typeof(value)='array' then value else '[]'::jsonb end) v
  loop return query select * from tj_images.binary_sources(child,depth+1);end loop;
 elsif jsonb_typeof(value)='string' then
  scalar:=value#>>'{}';
  if scalar ~* '^data:image/' then return next scalar;return;end if;
  if left(ltrim(scalar),1) in ('{','[') then
   begin parsed:=scalar::jsonb;exception when invalid_text_representation then parsed:=null;end;
   if parsed is not null then return query select * from tj_images.binary_sources(parsed,depth+1);return;end if;
  end if;
  -- Quoted HTML/legacy text must include whitespace inside the URI: a
  -- changed base64 continuation must never match only an unchanged prefix.
  for image_match in select regexp_matches(scalar,'"(data:image/[^"]*)"|''(data:image/[^'']*)''','gi')
  loop return next coalesce(image_match[1],image_match[2]);end loop;
  scalar:=regexp_replace(scalar,'"(data:image/[^"]*)"|''(data:image/[^'']*)''','','gi');
  for image_match in select regexp_matches(scalar,'(data:image/[a-zA-Z0-9.+-]+(?:;[a-zA-Z0-9=.+-]+)*,[^[:space:]"''<>]*)','gi')
  loop return next image_match[1];end loop;
 end if;
end $fn$;
revoke all on function tj_images.binary_sources(jsonb,integer) from public,anon,authenticated;
create or replace function tj_images.guard_binary_write() returns trigger
language plpgsql security definer set search_path=pg_catalog as $fn$
declare next_row jsonb:=to_jsonb(new);previous_row jsonb;owner_id uuid;can_upload boolean;image_record record;byte_count bigint;
begin
 if tg_op='UPDATE' then previous_row:=to_jsonb(old);else previous_row:='{}'::jsonb;end if;
 owner_id:=case when tg_table_schema='auth' or tg_table_name='profiles' then (next_row->>'id')::uuid else (next_row->>'user_id')::uuid end;
 select coalesce((select enabled from tj_images.grants where user_id=owner_id),false) into can_upload;
 for image_record in
  with next_images as(select image,count(*) n from tj_images.binary_sources(next_row) image group by image),
       old_images as(select image,count(*) n from tj_images.binary_sources(previous_row) image group by image)
  select n.image,n.n from next_images n left join old_images o using(image) where n.n>coalesce(o.n,0)
 loop
  if auth.uid() is not null and auth.uid() is distinct from owner_id then raise exception 'Cross-account image writes are forbidden' using errcode='42501';end if;
  if not can_upload then raise exception 'New images must remain in persistent device storage' using errcode='42501';end if;
  if image_record.image ~* ';base64,' then
   begin byte_count:=octet_length(decode(split_part(image_record.image,',',2),'base64'));
   exception when others then raise exception 'Invalid new image encoding' using errcode='22023';end;
  else byte_count:=octet_length(split_part(image_record.image,',',2));end if;
  if byte_count>3145728 then raise exception 'New images must be 3 MiB or smaller' using errcode='22023';end if;
 end loop;
 return new;
end $fn$;
revoke all on function tj_images.guard_binary_write() from public,anon,authenticated;
-- Cover every current owned public relation, including nested JSON, textual
-- settings, snapshots and RPC writes. Missing feature tables are not created.
do $$
declare relation record;
begin
 if exists(select 1 from pg_trigger where tgname='tj_image_binary_guard' and tgfoid<>'tj_images.guard_binary_write()'::regprocedure) then raise exception 'Unexpected image guard trigger identity';end if;
 for relation in select n.nspname schema_name,c.relname table_name from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind='r' and (n.nspname='public' and (exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='user_id' and not a.attisdropped) or c.relname='profiles') or n.nspname='auth' and c.relname='users')
 loop
  execute format('drop trigger if exists tj_image_binary_guard on %I.%I',relation.schema_name,relation.table_name);
  execute format('create trigger tj_image_binary_guard before insert or update on %I.%I for each row execute function tj_images.guard_binary_write()',relation.schema_name,relation.table_name);
 end loop;
end $$;
commit;

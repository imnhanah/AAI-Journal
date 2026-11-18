-- Candidate only. Install before enabling V8 cloud writes.
-- The protocol marker declares format compatibility. Existing Auth, RLS,
-- memberships and revision comparison remain the authorization controls.
begin;

create or replace function public.tj_case_study_requires_v8(value jsonb)
returns boolean
language sql immutable parallel safe
set search_path = pg_catalog
as $function$
  select coalesce(
    jsonb_path_exists(value, '$.** ? (@.type == "table" || @.type == "tableRow" || @.type == "tableHeader" || @.type == "tableCell" || @.type == "taskList" || @.type == "taskItem" || @.type == "caseStudyObject" || @.type == "highlight" || @.type == "textStyle")')
    or jsonb_path_exists(value, '$.**.attrs ? (@.rotation != 0 || @.flipX == true || @.flipY == true || @.wrap == true || @.textAlign != null)')
    or jsonb_path_exists(value, '$.** ? (@.version > 1 && @.content.type == "doc")')
    or coalesce(value->>'caseStudyDocumentProtocol' = 'v8', false),
    false);
$function$;

create or replace function public.tj_guard_case_study_v8_writer()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  protected_library boolean;
  client_info text;
begin
  protected_library := public.tj_case_study_requires_v8(new.library);
  if tg_op = 'UPDATE' then
    protected_library := protected_library or public.tj_case_study_requires_v8(old.library);
  end if;
  if protected_library then
    client_info := coalesce(
      nullif(current_setting('request.headers', true), '')::jsonb->>'x-client-info', '');
    if not ('case-study-v8/1' = any(regexp_split_to_array(client_info, '\s+'))) then
      raise exception using errcode='PT409',
        message='client_update_required',
        detail='Refresh to a compatible Case Study editor. The existing library was preserved.';
    end if;
    -- Sticky after activation. Removing the last table must not permit a
    -- cached writer with an older snapshot to replace the newer library.
    new.library := jsonb_set(new.library, '{caseStudyDocumentProtocol}', '"v8"'::jsonb, true);
  end if;
  return new;
end;
$function$;

revoke all on function public.tj_guard_case_study_v8_writer() from public;
drop trigger if exists tj_case_study_v8_writer_guard on public.profile_case_study_libraries;
create trigger tj_case_study_v8_writer_guard
before insert or update of library on public.profile_case_study_libraries
for each row execute function public.tj_guard_case_study_v8_writer();

commit;

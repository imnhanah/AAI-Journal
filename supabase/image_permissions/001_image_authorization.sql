-- REVIEWED LOCAL CANDIDATE. Do not apply without separate hosted approval.
-- Dependency: existing membership administration and private evidence bucket.
begin;
set local search_path=pg_catalog,public;
create schema if not exists tj_images;
revoke all on schema tj_images from public,anon,authenticated;
create table if not exists tj_images.grants (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default false,
 protected_owner boolean not null default false,
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
create table if not exists tj_images.audit (
 id bigint generated always as identity primary key,actor uuid,target uuid not null,
 old_enabled boolean,new_enabled boolean not null,action text not null,changed_at timestamptz not null default now()
);
create table if not exists tj_images.installation (id integer primary key check(id=1),installed_at timestamptz not null default now());
alter table tj_images.grants enable row level security;
alter table tj_images.audit enable row level security;
alter table tj_images.installation enable row level security;
revoke all on all tables in schema tj_images from public,anon,authenticated;
-- Run only once. Preserve both current Owners; do not re-grant on reapply or
-- automatically grant to future Owners. No memberships/cloud flags are edited.
do $$
begin
 if to_regprocedure('public.tj_is_membership_admin()') is null then raise exception 'Administration dependency missing'; end if;
 if not exists(select 1 from tj_images.installation where id=1) then
  if exists(select 1 from tj_images.grants) or exists(select 1 from tj_images.audit) then raise exception 'Unexpected image grant state before bootstrap';end if;
  if array(select user_id from public.tj_memberships where membership='owner' order by user_id) is distinct from array['8d31de8b-1e1d-4e93-9b61-ba6782ef11f8'::uuid,'bc2c5574-acd2-405a-8f9c-ee67fb08dd83'::uuid] then raise exception 'Approved Owner identities changed; stop for review'; end if;
  insert into tj_images.grants(user_id,enabled,protected_owner) select user_id,true,true from public.tj_memberships where membership='owner';
  insert into tj_images.audit(target,new_enabled,action) select user_id,true,'initial-owner-preservation' from tj_images.grants where protected_owner;
  insert into tj_images.installation(id) values(1);
 end if;
end $$;
create or replace function public.tj_can_upload_images() returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select coalesce((select enabled from tj_images.grants where user_id=auth.uid()),false);
$$;
revoke all on function public.tj_can_upload_images() from public,anon;
grant execute on function public.tj_can_upload_images() to authenticated;
create or replace function public.tj_list_image_access(target_users uuid[])
returns table(user_id uuid,enabled boolean,protected_owner boolean,revision bigint)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null or not public.tj_is_membership_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 if cardinality(target_users)>100 then raise exception 'Too many users'; end if;
 return query select u.id,coalesce(g.enabled,false),coalesce(g.protected_owner,false),coalesce(g.revision,0)
 from auth.users u left join tj_images.grants g on g.user_id=u.id where u.id=any(target_users);
end $$;
revoke all on function public.tj_list_image_access(uuid[]) from public,anon;
grant execute on function public.tj_list_image_access(uuid[]) to authenticated;
create or replace function public.tj_set_image_access(target_user uuid,expected_revision bigint,next_enabled boolean)
returns table(user_id uuid,enabled boolean,protected_owner boolean,revision bigint)
language plpgsql security definer set search_path=pg_catalog as $$
declare old_row tj_images.grants%rowtype;
begin
 if auth.uid() is null or not public.tj_is_membership_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 if next_enabled is null then raise exception 'A Boolean permission is required'; end if;
 -- Serialize first-grant races as well as updates. Does not lock unrelated users.
 perform pg_advisory_xact_lock(hashtextextended(target_user::text,78123));
 if not exists(select 1 from auth.users where id=target_user) then raise exception 'Account unavailable'; end if;
 select * into old_row from tj_images.grants g where g.user_id=target_user for update;
 if coalesce(old_row.revision,0) is distinct from expected_revision then raise sqlstate 'PT409' using message='Image permission changed; reload'; end if;
 if old_row.protected_owner and not next_enabled then raise exception 'Approved Owner image access is protected' using errcode='42501'; end if;
 insert into tj_images.grants as g(user_id,enabled) values(target_user,next_enabled)
 on conflict on constraint grants_pkey do update set enabled=excluded.enabled,revision=g.revision+1,updated_at=now();
 insert into tj_images.audit(actor,target,old_enabled,new_enabled,action) values(auth.uid(),target_user,old_row.enabled,next_enabled,'administrator-image-grant');
 return query select g.user_id,g.enabled,g.protected_owner,g.revision from tj_images.grants g where g.user_id=target_user;
end $$;
revoke all on function public.tj_set_image_access(uuid,bigint,boolean) from public,anon;
grant execute on function public.tj_set_image_access(uuid,bigint,boolean) to authenticated;
-- Preserve all existing read policies. Refuse another permissive INSERT/ALL
-- policy that could OR around the new authorization predicate.
do $$
begin
 if exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and cmd in ('INSERT','ALL') and policyname<>'case study evidence upload own') then raise exception 'Unexpected Storage write policy; review before proceeding'; end if;
 if exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='case study evidence upload own' and (cmd<>'INSERT' or permissive<>'PERMISSIVE' or roles<>array['authenticated']::name[] or with_check not in ('((bucket_id = ''case-study-evidence''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND tj_is_current_owner())','((bucket_id = ''case-study-evidence''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND tj_can_upload_images())'))) then raise exception 'Storage upload policy changed; stop for review';end if;
 if not exists(select 1 from storage.buckets where id='case-study-evidence' and not public and file_size_limit=3145728) then raise exception 'Expected private 3 MiB evidence bucket'; end if;
end $$;
drop policy if exists "case study evidence upload own" on storage.objects;
create policy "case study evidence upload own" on storage.objects for insert to authenticated
with check(bucket_id='case-study-evidence' and (storage.foldername(name))[1]=auth.uid()::text and public.tj_can_upload_images());
commit;

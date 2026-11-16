-- Synthetic Auth and Storage boundary for the isolated PostgreSQL verifier.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create schema storage;
grant usage on schema auth, storage to anon, authenticated;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'
);
create function auth.uid() returns uuid language sql stable
set search_path = pg_catalog
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets,
  name text not null,
  unique(bucket_id, name)
);
create function storage.foldername(name text) returns text[] language sql immutable
set search_path = pg_catalog
as $$ select string_to_array(name, '/') $$;
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated, anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated, anon;

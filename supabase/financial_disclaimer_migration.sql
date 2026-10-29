-- Financial disclaimer acknowledgements
-- Run once in the Supabase SQL Editor before deploying this release.

create table if not exists public.financial_disclaimer_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  disclaimer_version text not null,
  accepted_at timestamptz not null default now(),
  unique (user_id, disclaimer_version)
);

alter table public.financial_disclaimer_acceptances enable row level security;

drop policy if exists "financial_disclaimer_acceptances_select_own" on public.financial_disclaimer_acceptances;
create policy "financial_disclaimer_acceptances_select_own"
  on public.financial_disclaimer_acceptances
  for select using (user_id = auth.uid());

-- The browser never writes the acceptance row directly. This function uses the
-- authenticated user's ID and the database clock, so acknowledgement time is
-- recorded consistently and cannot be supplied by the client.
create or replace function public.acknowledge_financial_disclaimer(p_version text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  recorded_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to acknowledge the financial disclaimer';
  end if;
  if coalesce(trim(p_version), '') = '' then
    raise exception 'A financial disclaimer version is required';
  end if;

  insert into public.financial_disclaimer_acceptances (user_id, disclaimer_version)
  values (auth.uid(), trim(p_version))
  on conflict (user_id, disclaimer_version) do nothing
  returning accepted_at into recorded_at;

  if recorded_at is null then
    select accepted_at into recorded_at
    from public.financial_disclaimer_acceptances
    where user_id = auth.uid() and disclaimer_version = trim(p_version);
  end if;
  return recorded_at;
end;
$$;

revoke all on function public.acknowledge_financial_disclaimer(text) from public;
grant execute on function public.acknowledge_financial_disclaimer(text) to authenticated;

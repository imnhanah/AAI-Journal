-- Multi-balance workspaces (additive migration)
--
-- Run this after the existing journal migrations. It preserves every current
-- account and trade: existing accounts stay "standard" and receive one
-- default balance that mirrors their current starting balance.

create extension if not exists pgcrypto;

alter table public.accounts
  add column if not exists workspace_type text not null default 'standard'
  check (workspace_type in ('standard', 'multi_balance'));

-- Any journal workspace can independently use multiple balances. Drop the
-- former per-user uniqueness constraint in case this migration was run before.
drop index if exists public.accounts_one_multi_balance_workspace_per_user;

create table if not exists public.workspace_balances (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  starting_balance numeric not null default 0 check (starting_balance >= 0),
  base_currency text not null default 'USD',
  goals jsonb not null default '{}'::jsonb check (jsonb_typeof(goals) = 'object'),
  risk_settings jsonb not null default '{}'::jsonb check (jsonb_typeof(risk_settings) = 'object'),
  guardrails jsonb not null default '{}'::jsonb check (jsonb_typeof(guardrails) = 'object'),
  challenge_enabled boolean not null default false,
  challenge_starting_balance numeric not null default 0 check (challenge_starting_balance >= 0),
  challenge_mode text check (challenge_mode in ('risk', 'streak', 'adaptive')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create index if not exists workspace_balances_workspace_id_idx
  on public.workspace_balances (workspace_id);
create index if not exists workspace_balances_user_id_idx
  on public.workspace_balances (user_id);

alter table public.workspace_balances enable row level security;
drop policy if exists workspace_balances_owner on public.workspace_balances;
create policy workspace_balances_owner on public.workspace_balances
  for all to authenticated
  using (user_id = auth.uid() and exists (
    select 1 from public.accounts a where a.id = workspace_id and a.user_id = auth.uid()
  ))
  with check (user_id = auth.uid() and exists (
    select 1 from public.accounts a where a.id = workspace_id and a.user_id = auth.uid()
  ));

-- Existing journals get one balance. Their legacy account-level calculations
-- remain valid until the UI starts reading the new balance record.
insert into public.workspace_balances (
  workspace_id, user_id, name, starting_balance, base_currency
)
select a.id, a.user_id, 'Primary balance', a.balance, coalesce(a.base_currency, a.icon, 'USD')
from public.accounts a
where not exists (
  select 1 from public.workspace_balances b where b.workspace_id = a.id
);

create table if not exists public.trade_balance_results (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  balance_id uuid not null references public.workspace_balances(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  risk_pct numeric,
  position_size numeric,
  entry_price numeric,
  exit_price numeric,
  gross_pnl numeric not null default 0,
  commission numeric not null default 0,
  swap numeric not null default 0,
  net_pnl numeric not null default 0,
  close_date date,
  close_time time,
  status text not null default 'closed' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trade_id, balance_id)
);

-- Existing early installs may have the id column but miss its UUID default.
-- Keep inserts safe whether rows come from the app or directly from SQL.
alter table public.trade_balance_results
  alter column id set default gen_random_uuid();

create index if not exists trade_balance_results_trade_id_idx
  on public.trade_balance_results (trade_id);
create index if not exists trade_balance_results_balance_id_idx
  on public.trade_balance_results (balance_id);
create index if not exists trade_balance_results_user_id_idx
  on public.trade_balance_results (user_id);

alter table public.trade_balance_results enable row level security;
drop policy if exists trade_balance_results_owner on public.trade_balance_results;
create policy trade_balance_results_owner on public.trade_balance_results
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- A challenge is isolated to a balance, not to the shared workspace.
create table if not exists public.balance_challenge_progress (
  balance_id uuid primary key references public.workspace_balances(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  active_level integer not null default 1 check (active_level between 1 and 31),
  statuses jsonb not null default '{}'::jsonb check (jsonb_typeof(statuses) = 'object'),
  notes jsonb not null default '{}'::jsonb check (jsonb_typeof(notes) = 'object'),
  automation jsonb,
  updated_at timestamptz not null default now()
);

alter table public.balance_challenge_progress enable row level security;
drop policy if exists balance_challenge_progress_owner on public.balance_challenge_progress;
create policy balance_challenge_progress_owner on public.balance_challenge_progress
  for all to authenticated
  using (user_id = auth.uid() and exists (
    select 1 from public.workspace_balances b where b.id = balance_id and b.user_id = auth.uid()
  ))
  with check (user_id = auth.uid() and exists (
    select 1 from public.workspace_balances b where b.id = balance_id and b.user_id = auth.uid()
  ));

-- Finance movements stay in one finance page but identify their balance.
alter table if exists public.finance_movements
  add column if not exists balance_id uuid references public.workspace_balances(id) on delete set null;
create index if not exists finance_movements_balance_id_idx
  on public.finance_movements (balance_id);

create or replace function public.set_workspace_balance_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists set_workspace_balance_updated_at on public.workspace_balances;
create trigger set_workspace_balance_updated_at
  before update on public.workspace_balances
  for each row execute function public.set_workspace_balance_updated_at();

drop trigger if exists set_trade_balance_result_updated_at on public.trade_balance_results;
create trigger set_trade_balance_result_updated_at
  before update on public.trade_balance_results
  for each row execute function public.set_workspace_balance_updated_at();

notify pgrst, 'reload schema';

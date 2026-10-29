-- Apply after multi_balance_workspaces_migration.sql. Existing unowned savings remain
-- assigned to the original account by the application's legacy fallback.
begin;

alter table public.savings_accounts
  add column if not exists balance_id uuid references public.workspace_balances(id);

alter table public.savings_accounts
  add column if not exists reminder_minutes integer not null default 30;

-- Replace the earlier preset-only check without rewriting existing settings.
alter table public.savings_accounts
  drop constraint if exists savings_accounts_reminder_minutes_check;
alter table public.savings_accounts
  add constraint savings_accounts_reminder_minutes_check
  check (reminder_minutes between 1 and 10080);

-- Ensure the savings owner belongs to the same journal as the savings plan.
create or replace function public.validate_savings_balance_owner()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.balance_id is not null and not exists (
    select 1 from public.workspace_balances
    where id = new.balance_id and workspace_id = new.account_id
  ) then
    raise exception 'Savings owner must belong to the same journal';
  end if;
  return new;
end;
$$;
drop trigger if exists savings_balance_owner_check on public.savings_accounts;
create trigger savings_balance_owner_check before insert or update
  on public.savings_accounts for each row execute function public.validate_savings_balance_owner();

-- Make the new column visible to the API immediately after this transaction.
notify pgrst, 'reload schema';

commit;

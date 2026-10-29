# AAICoreFx Supabase migration manifest

Version: **2026.10.29**

This manifest is the installation order for a **new, empty Supabase project**.
Run each item once, in order, from the Supabase SQL Editor or your normal
deployment pipeline. These files are deliberately retained under their
historical names; the numbers below are the supported version order.

| Version | File | Requires | Purpose |
| --- | --- | --- | --- |
| 001 | `schema.sql` | Supabase Auth schema | Base journal tables, RLS, policies, triggers, markups, reviews, and period reviews. |
| 002 | `trade_close_timing_migration.sql` | 001 / `public.trades` | Trade close date/time and its validation constraint. |
| 003 | `finance_migration.sql` | 001 / `accounts`, `set_updated_at()` | Finance settings, savings plans, cash movements, RLS, and indexes. |
| 004 | `multi_balance_workspaces_migration.sql` | 001; run after 003 for finance balance links | Workspace balances, balance-level trade results/challenges, and finance balance link. |
| 005 | `savings_account_scope_migration.sql` | 003 and 004 | Savings-plan balance owner, reminder interval, and owner-validation trigger. |
| 006 | `challenge_migration.sql` | 001 / `accounts` | Account-level challenge progress and RLS. |
| 007 | `challenge_modes_migration.sql` | 006 | Challenge automation checkpoint column. |
| 008 | `backtest_accounts.sql` | Supabase Auth schema | Isolated backtest tables, RLS, and backtest RPCs. |
| 009 | `economic_calendar_cache_migration.sql` | Supabase Auth / Edge Function deployment | Private economic-calendar cache for the Edge Function. |
| 010 | `journal_low_egress_migration.sql` | 001–009 | Updated-at triggers plus journal/image sync RPCs. Run after all journal tables exist. |
| 011 | `journal_egress_hardening.sql` | 010 | Replaces the journal sync RPC with the protocol-3 metadata projection. |
| 012 | `trade_risk_calculation_migration.sql` | 002, 010, 011 | Trade risk columns and the final metadata allow-list used by protocol 3. |
| 013 | `adaptive_balance_mode_migration.sql` | 004 | Allows `adaptive` as the Mode 3 value for workspace-balance challenges. |
| 014 | `profile_case_study_library_migration.sql` | 001, 010 preferred | Profile-owned Case Study Library, RLS, and safe legacy-source preservation. |

## Replaced, bundled, and non-install files

Do **not** add these to a new-install sequence:

- `journal_cache_sync_migration.sql` is superseded by version 010. It creates
  older timestamp triggers but does not install the current low-egress RPC
  protocol.
- `dashboard_settings_migration.sql`, `trade_prices_migration.sql`,
  `markups_status_migration.sql`, and `period_reviews_migration.sql` are
  already represented by `schema.sql` for a fresh project. They are retained
  only for historical, incremental upgrades.
- `seed_two_account_demo.sql` is **development-only**. It deletes/recreates
  Demo data and must never be run against production data.

`journal_egress_hardening.sql` and `trade_risk_calculation_migration.sql`
intentionally replace `tj_bootstrap_metadata`; this is not a conflict when
applied in the listed order. Version 012 must be last because it is the final
allow-list and calls helpers installed by version 010.

## Existing deployed projects

Do not re-run `schema.sql` as an upgrade procedure. It contains legacy
backfill `UPDATE` statements and trigger recreation, so it is a baseline for
an empty project, not a no-op deployment tool. Instead:

1. Take a database backup and inspect the current schema.
2. Run `npm run verify:supabase -- --db-url "$SUPABASE_DB_URL"` or execute
   `supabase/verify_installation.sql` in the SQL Editor. It is read-only.
3. Apply only the missing migrations, respecting the dependency column above.
4. Run the verifier again before deploying the associated frontend release.

The manifest does not create a migration-history table and does not apply SQL
to a project. Supabase CLI migrations may be introduced later, but should be
generated from this reviewed order rather than inferred from file names.

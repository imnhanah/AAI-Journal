-- Enable Mode 3 (Adaptive Balance) for existing multi-balance journals.
-- Safe to run more than once. Existing challenge records and trade history
-- are preserved; this only broadens the allowed challenge_mode values.

alter table public.workspace_balances
  drop constraint if exists workspace_balances_challenge_mode_check;

alter table public.workspace_balances
  add constraint workspace_balances_challenge_mode_check
  check (challenge_mode in ('risk', 'streak', 'adaptive'));

notify pgrst, 'reload schema';

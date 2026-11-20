-- Safe rollback: keep receipts and model-reference guard. Never reactivate an
-- unsafe old writer against linked trades. Disable affected writes instead.
begin;
revoke execute on function public.tj_replace_savings(uuid,jsonb,jsonb,text,text,jsonb,jsonb),public.tj_save_progress(text,uuid,timestamptz,jsonb,text,text),public.tj_save_backtest_trade_v2(uuid,uuid,timestamptz,jsonb,jsonb,boolean,text,text) from authenticated;
-- Restore the paired compatible client with the feature flag off only after
-- draining saves. Existing linked data stays guarded and readable.
commit;

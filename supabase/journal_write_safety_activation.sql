-- Compatibility cutover ONLY AFTER the paired client and all affected paths
-- pass staging. Production activation requires separate authorization.
begin;
create function tj_office.guard_revisioned_journal_write() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare path text; headers jsonb; stamp timestamptz;
begin
 if tj_office.request_role()<>'authenticated' then if tg_op='DELETE' then return old;end if;return new;end if;
 path:=current_setting('request.path',true);
 -- Existing broker transaction has its own locked snapshot and permissions.
 if path='/rpc/tj_commit_broker_import' then if tg_op='DELETE' then return old;end if;return new;end if;
 headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
 if coalesce(headers->>'x-client-info','') !~ '(^|[[:space:]])journal-write-v1($|[[:space:]])' then raise sqlstate 'PT409' using message='client_update_required',hint='Keep unsaved work and refresh this tab.';end if;
 -- Only database-triggered FK cleanup of the caller's own rows is exempt.
 -- The removed parent must actually be absent. Trigger depth alone is never
 -- authority, and the current-client marker above still applies.
 if pg_trigger_depth()>1 and (to_jsonb(old)->>'user_id')::uuid=auth.uid() then
  if tg_op='DELETE' and (
   (tg_table_name in ('trades','trade_reviews','premarket_markups','period_reviews','challenge_progress','savings_accounts')
    and not exists(select 1 from public.accounts a where a.id=(to_jsonb(old)->>'account_id')::uuid))
   or (tg_table_name='balance_challenge_progress' and not exists(select 1 from public.workspace_balances b where b.id=(to_jsonb(old)->>'balance_id')::uuid))
   or (tg_table_name='trade_reviews' and not exists(select 1 from public.trades t where t.id=(to_jsonb(old)->>'trade_id')::uuid))
  ) then return old;end if;
  -- ON DELETE SET NULL may change only the removed-parent reference and
  -- server-maintained timestamp, never trade values or other savings fields.
  if tg_op='UPDATE' and tg_table_name='trades'
   and (to_jsonb(old)->>'premarket_markup_id') is not null and (to_jsonb(new)->>'premarket_markup_id') is null
   and (to_jsonb(new)-array['premarket_markup_id','updated_at'])=(to_jsonb(old)-array['premarket_markup_id','updated_at'])
   and not exists(select 1 from public.premarket_markups m where m.id=(to_jsonb(old)->>'premarket_markup_id')::uuid)
   then return new;end if;
  if tg_op='UPDATE' and tg_table_name='savings_accounts'
   and (to_jsonb(old)->>'balance_id') is not null and (to_jsonb(new)->>'balance_id') is null
   and (to_jsonb(new)-array['balance_id','updated_at'])=(to_jsonb(old)-array['balance_id','updated_at'])
   and not exists(select 1 from public.workspace_balances b where b.id=(to_jsonb(old)->>'balance_id')::uuid)
   then return new;end if;
 end if;
 if tg_table_name in ('challenge_progress','balance_challenge_progress','period_reviews') and path is distinct from '/rpc/tj_save_progress' then raise sqlstate 'PT409' using message='Use the revision-checked progress save';end if;
 if tg_table_name in ('trades','trade_reviews','premarket_markups') and tg_op='UPDATE' then
  stamp:=nullif(substring(coalesce(headers->>'x-client-info','') from 'aai-record-revision:([^[:space:]]+)'),'')::timestamptz;
  if stamp is null or stamp is distinct from old.updated_at then raise sqlstate 'PT409' using message='Record changed elsewhere. Keep your draft and reload.';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end;$$;
revoke all on function tj_office.guard_revisioned_journal_write() from public,anon,authenticated;
do $$ declare relation text;begin
 foreach relation in array array['trades','trade_reviews','premarket_markups','period_reviews','challenge_progress','balance_challenge_progress','savings_accounts'] loop
 execute format('create trigger zzz_tj_revision_cutover before insert or update or delete on public.%I for each row execute function tj_office.guard_revisioned_journal_write()',relation);
 end loop;end;$$;
commit;

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

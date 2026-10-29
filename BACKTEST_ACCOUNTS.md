# Backtest accounts

## Activation

Run `supabase/backtest_accounts.sql` in the connected project's SQL Editor, then click Retry on the Backtest page. This creates new private tables/RPCs only; it does not move or delete existing media or alter live journal tables. The frontend checks for missing functions and preserves the local legacy data.

## Behavior

Each run has its own name, strategy, one instrument, timeframe, currency, starting balance, default risk, trade-count target, plan and conclusion. The instrument is locked after trades are logged. Trade tags and rule evaluations are retained with each trade; the initial rule list is copied from the selected account. Runs never contribute to live balances, finance, challenges, reviews, or analytics. Editing/deleting a simulated trade recomputes the run. Delete-run confirmation explicitly covers its simulated trade history.

Cards expose compact progress/stats and expandable analysis. Open test shows the complete equity curve, simulated trade log, and analysis toggle. Trade entry reuses the journal's existing screenshot upload/editing, active-uploader paste routing, theme controls, and validation. Position sizing uses only simulated starting balance plus closed simulated results. Missing R:R is not treated as zero. Closed records use close date/time with entry date/time fallback and a stable ID tie-breaker. The trade target counts closed trades; running positions do not affect results.

Legacy browser-only trades remain untouched. Import copies creates runs grouped by instrument with deterministic owner-scoped IDs, making retries idempotent. The default imported starting balance is 10,000 USD; adjust it to the original simulation's starting balance in setup. This is an explicit import, not an automatic media migration. Export downloads one run with all its screenshots as JSON.

## Cloud/cache

`tj_sync_backtests` returns all owned run/trade version IDs plus changed metadata, without screenshot bytes. Aggregation inside the RPC retains histories beyond PostgREST's 1,000-row cap. Manifest merges reject incomplete results instead of silently dropping history. Warm startup displays the IndexedDB cache while refreshing lightweight versions. Focus, visibility changes, manual refresh, and cross-tab mutation notices refresh this page; there is no realtime screenshot subscription or continuous polling.

Screenshot bodies are requested only for opening trade details, editing a trade, or exporting. They use the existing private IndexedDB cache keyed by authenticated user, entity, record ID and timestamp. Failed reads are not cached, stale requests are blocked by the shared generation barrier, user changes/logout clear private caches, and unchanged versions are reused. Mutation responses contain metadata only; text-only edits omit the media argument, and SQL preserves the screenshot column. Replacing unloaded existing media is rejected. Deletes and changes invalidate obsolete local media; no cloud media is deleted except explicit trade/run deletion.

RLS restricts both tables to auth.uid(). Functions are security invoker and callable only by authenticated users. There are no service-role keys, public screenshot buckets, signed URL identifiers, or weaker auth settings. Optimistic timestamps reject simultaneous edits instead of overwriting newer data. Saves require a connection: this is cache-first reading, not an offline edit queue. IndexedDB-disabled browsers fall back to session memory.

## Verification / limits

Automated tests cover calculations, unchanged live inputs, deterministic ordering, 1,201 records, incomplete deltas, missing R:R, unloaded-media safeguards, private cache isolation/version reuse/failures/logout, deterministic legacy IDs and the SQL security/query contract. Browser verification uses a temporary isolated fixture (no writes to real accounts) to check cards, analysis, fixed-instrument trade panel, theme pickers, and simulated lot sizing. Production cloud RPC execution and RLS integration still require applying the SQL and checking creation/editing/export across authenticated sessions. No exact egress saving has been measured. Existing build bundle-size warning remains.

There is no Storage migration. Any future thumbnail/Storage migration needs a separate backed-up, checksum-verified, reversible and resumable plan.

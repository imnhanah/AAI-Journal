# Supabase egress audit and implementation

Date: 2026-10-07. Application: `/Users/new/Desktop/aaicorefx-site copy`.

## Outcome and deployment status

Local application changes are implemented. No stored screenshots, avatars, or journal records were deleted, resized, deduplicated, or migrated by this work. No Supabase limits were increased. Existing RLS and authentication refresh configuration remain unchanged.

The earlier `journal_low_egress_migration.sql` is already installed in the user's project. This audit prepares an additional **not-yet-applied** `supabase/journal_egress_hardening.sql`. Until it is applied, the client remains compatible with the earlier RPC, but the new server-side account/avatar allowlist and lazy period-review bodies are not active. The revised AI-coach Edge Function also requires redeployment if that endpoint is used. No production database deployment or Edge redeployment was performed.

No actual response-byte or Supabase usage measurements were collected. Reduced transfers are an architectural expectation, not a measured percentage or GB saving. Browser caching avoids requests; it is distinct from Supabase's Storage CDN “cached egress” accounting. Existing consumed egress is not reversed. See [Supabase egress documentation](https://supabase.com/docs/guides/platform/manage-your-usage/egress).

## Files and paths inspected

- `src/db.js`, `src/supabaseClient.js`, `src/auth.js`, `src/AuthPage.jsx`, `src/main.jsx`.
- `src/TradingJournal.jsx`: startup/retries, cache hydration, multi-account scoping, trade/markup/review/period editors, screenshots, image viewer/editing, profile avatar, broker imports, resets/deletes, dashboard/analytics/review calculations.
- `src/journalCloudCache.js`, `src/journalDelta.js`, `src/journalCache.js`, `src/journalImageCache.js`; their tests; `src/activeAccount.js`, `src/demoAccount.js`, `src/siteTheme.js`.
- `src/balanceModel.js`, `src/useChallenge.js`, `src/useBalanceChallenge.js`, challenge model/lifecycle/automation/autosave and associated tests.
- `src/forexFactory.js`, server economic-calendar caching and AI-coach/delete-profile functions.
- `supabase/schema.sql`; finance, multi-balance, period-review, challenge/mode, dashboard-setting, trade-price/close-timing, calendar-cache, journal-cache-sync and low-egress migration SQLs.
- Repository inventory, README, public-site copy and references to sharing/import/export.

This checkout contains broker **imports**, but no implemented share-snapshot table, sharing API or outbound journal-export workflow was found. Export mentions refer to broker files being imported. Their absence is not evidence that they work in some other deployment: sharing/export behavior cannot be certified from this checkout. Nothing was added or removed to substitute for those missing implementations.

## Egress sources and query inventory

| Source | Audit finding | Resolution |
| --- | --- | --- |
| `fetchAllUserData` → `tj_sync_journal` | Earlier RPC already substitutes screenshot references, but uses broad `to_jsonb` rows; account `profile_image`, arbitrary future JSON and full period content can still travel. | New protocol-2 server allowlist emits consumed metadata and screenshot reference trees only; period bodies lazy-loaded. |
| `loadJournalImage` → `tj_journal_image` | Individual original image returned on demand. Previous cache survived logout and had late-request risks. | Auth checks before/after response; per-owner/entity/record/media-hash/path cache; generation gates; failed/null responses rejected. |
| Trade insert/update `.select()` | Complete row echoed screenshots, including unchanged media. | Explicit scalar projection; omit screenshot column on text-only saves; reconcile local screenshots without downloading echo. |
| Markup insert/update `.select()` | Complete screenshot JSON and embedded session review echoed. | Thin projection; preserve legacy stage names and current local tree; explicit edit detection. |
| Trade-review insert/update `.select()` | Full image-bearing row echoed. | Thin projection and protected screenshot writes. |
| Period-review upsert | Full `content` JSON echoed and broadly bootstrapped. Content can be large even if mostly text. | Save returns identifiers/completion/timestamp only; opened review fetches `content,updated_at` by owner/ID and checks version. |
| Account insert/update | Full row could echo legacy `profile_image`; update used to clear it. | Create response scalar-only; updates no longer clear stored avatar. Existing legacy account image field is unused by the current avatar UI. |
| Profile read/update and Auth session refresh | Profile read broad; avatar data URLs live in Auth user metadata. Auth responses can repeat the existing avatar. | Scalar profile selection; unchanged avatar excluded from update payload. Auth response shape/refresh untouched; repeated Auth avatar remains a documented limitation. |
| AI-coach history | Metadata-only, but histories capped at 500/200/300 rows, silently excluding older records. | Complete unique-ID keyset pagination with failure propagation, including a project row cap below requested page size. |
| Public economic calendar | Already browser/server cached, no private images. | Existing caches retained. |
| Signature helper | Scalar count/latest-update queries still exist, but have no active callers. | No media-bearing read; not part of startup. |
| Finance/rules/balances/challenges | Small scalar/calculation settings, not image-bearing records. | Existing behavior retained. |

All image-bearing application fields found: `trades.screenshots` (legacy array or entry/exit object), `premarket_markups.screenshots` (legacy arrays/stages, current preHTF/preM15/preH4/postH4/postM15 and embedded sessionReview), `trade_reviews.screenshots`, legacy `accounts.profile_image`, and Auth `user_metadata.avatar_url`/provider `picture`. Image strings can be nested with captions; recursive references preserve those structures. Period `content` is treated as a potentially large body. No share snapshot field was found in the schema or current query code.

## Architecture and correctness

Startup retains **all historical metadata across all owned accounts**, not just the newest trades. A warm startup displays an owner-scoped cached view and checks changes using per-table ID/timestamp manifests. The RPC returns changed rows and deleted IDs; incomplete/failed responses do not replace the last usable snapshot. Protocol 2 causes one full lightweight refresh after installation so older cached broad rows are replaced.

The primary journal RPC returns one aggregate JSON object, rather than a rowset subject to the usual 1,000-row response cap. It includes all owned historical rows. Server aggregation and client merge use stable record keys; same-date records receive ID tie-breakers. Calculation inputs, finance movements, all balances and trade allocations remain available. The AI endpoint's separate queries now page by unique ID, continue until an empty page, and never treat a failed page as end-of-history. [Supabase pagination documentation](https://supabase.com/docs/reference/javascript/using-modifiers-range) also warns that pagination needs defined ordering.

Screenshot arrays retain references instead of original data URLs. Array lengths, stage names, captions, IDs, timestamps and media hash/path remain usable for summaries without fetching originals. A reference means “media exists but bytes are not loaded”; an empty array means no images. Visible image previews fetch only their needed image. Opening/editing a record retains this behavior; saving changed media materializes references safely. No automatic duplicate detection is applied.

`privateCache.js` is the testable coordinator; `privateCacheRuntime.js` provides memory/IndexedDB storage. Keys include authenticated user, table/entity, record, immutable media hash/version and image path. Period-detail keys include user, record and updated timestamp. Pending same-version loads deduplicate. User changes/logout synchronously change the generation, then clear the previous owner's persistent journal/media/view/legacy-image caches. Reads/writes wait on the clearing barrier. Late responses cannot update cache or journal state after a newer mutation/session change. IndexedDB failure falls back to memory and may cause later refetches, not false empty media.

Every successful REST mutation triggers invalidation. Screenshot edits/deletes evict affected image references; account cascade deletion evicts user image references; period edits evict their detail cache. Text-only edits preserve matching media-version cache entries. Unversioned legacy inline-image snapshots are discarded on mutations so deleted/stale images cannot be restored; they are only browser copies, not database media. Cached raw metadata remains as the next delta manifest, allowing changed rows to be fetched rather than forcing a full history download.

Cross-tab mutation notifications use owner-scoped localStorage messages with table/record identifiers, not image bytes. Visible tabs refresh debounced; returning to a visible tab performs a metadata check. There is no continuous new polling loop. Another browser/device is discovered on the next sync or visibility refresh, not instantly through a new realtime subscription.

Text-only saves omit the screenshot column. An empty form cannot silently replace unloaded images. Explicit removals require the media-edit flag. References for a different record are rejected. Existing trade/markup/review updates use `updated_at` optimistic concurrency when provided, protecting newer remote saves from old editors. Failure keeps review editors open and rolls back the optimistic trade update. Thin responses reattach the submitted or previously cached local screenshot metadata instead of treating an omitted response column as empty media. Period opening is guarded against account/year changes and superseded requests.

Clipboard handling was already locally scoped; it was not a global handler on every uploader. It now additionally checks the nearest intentionally active uploader, honors prevented events and stops propagation. Input/textarea paste is left alone. Each upload validates image type and 10 MB per-file size with explicit error feedback. Screenshot originals are not silently compressed. Existing 320-pixel profile-avatar processing is retained and disclosed in the uploader feedback.

## Security

- Browser uses anon/project key plus authenticated JWT; no service-role credential added or exposed.
- Auth session persistence, token refresh and recovery configuration remain enabled.
- RPCs use authenticated-only grants, SECURITY INVOKER, fixed search path, allowed table names and explicit `auth.uid()` ownership filters. Client filters are not authorization.
- Existing table RLS was inspected in source and not weakened. Workspace balance/challenge policies also check parent ownership.
- A pre-existing relational-policy concern remains: `trade_balance_results` checks row `user_id`, but does not also verify ownership of referenced trade/balance in its policy. Foreign-key/relational hardening should be evaluated separately; this optimization does not change that policy.
- No buckets made public, signed URLs persisted, or private screenshot identifiers turned into public links. Media remains stored where it was.
- Live adversarial two-user RLS tests were not run; SQL-source inspection is not a substitute for production policy testing.

## Validation results

- `npm test`: **86 passed, 0 failed**, including new cache/egress safety cases and existing balance, challenge, review/insight, psychology and cache tests.
- New cases cover cold/warm delta merge, version/owner/record isolation, logout clear, failed media fetch and retry, stale in-flight responses, deduplication, text-only/unloaded-media protection, explicit removals, foreign-record refs, thin mutation projections, SQL metadata allowlist, 1,203-row complete history/P&L, 1,501-row keyset history (also a lower configured row cap), and one paste/one uploader with size validation and intentional duplicates preserved.
- `npm run build`: passed; existing large JavaScript bundle warning remains.
- Live localhost warm reload succeeded; displayed 256 trades and the same psychology/net journal figures before/after reload. Monthly review and nested saved individual-trade review opened successfully; no captured console errors in this check. Closed the views without saving user data.
- No production records created/edited/deleted for testing. No destructive logout/browser-cache-clear QA on the user's session.
- Tests for query shape and prepared SQL are static; new SQL was not executed against PostgreSQL. No local PostgreSQL/Docker runtime was available. The new lazy period-body branch awaits the server script and live integration verification. Multi-tab browser mutation, real media revision conflicts, live RLS isolation, outbound exports/sharing and exhaustive dashboard chart parity have not been certified end-to-end. Automated model/cache tests do not prove every UI calculation.

## Applying and verifying the remaining server changes

1. Retain a database backup and the existing RPC definition.
2. Apply `supabase/journal_egress_hardening.sql` after the installed low-egress migration in the Supabase SQL Editor. It is transactional and changes functions only, not records or RLS.
3. Reload and Sync. Confirm the response protocol is 2. Check cold metadata excludes original `data:image/` bytes, account avatar bytes and full period bodies; screenshot reference trees remain. Check a second unchanged sync has empty changed-row arrays.
4. Open actual legacy trade/markup/review screenshots; check one image request, same-version cache reuse, edited version refetch, visible failure/retry, and text-only saves with no screenshots in the response or mutation payload.
5. Use disposable test accounts to verify logout/user-change clearing, cross-tab saves/deletes, unloaded-media protection and RLS isolation. Confirm historical statistics past 1,000 rows and account switching.
6. Redeploy `ai-coach` if in use. Its source is maintained here, but the current frontend has no discovered invocation of that endpoint.
7. Capture browser network transferred bytes for a fixed cold/warm/open/edit/account-switch sequence and compare Supabase Database/Auth/Storage categories over equivalent usage windows. Do not attribute unrelated users' or existing traffic to these changes.

Rollback: restore the previous RPC definition from `journal_low_egress_migration.sql` and refresh browser caches; keep all original media unchanged. Restore prior client/Edge deployment if necessary. No media reversal or bucket deletion is required.

## Remaining limitations

Auth still returns avatar metadata with session/user responses. Markup session-review text lives inside the screenshot JSON column; changing that text can require materializing the existing screenshot tree before a write. Already cached legacy inline images can lack immutable per-image revisions; those cached copies are dropped on changes rather than trusted indefinitely. Metadata allowlists must be updated alongside future schema/features. The RPC still scans the user's full metadata and hashes changed screenshot trees: less network egress does not mean zero database work. Very large journals may need a server-managed changelog/snapshot protocol with bounded pages and consistent snapshot tokens. Direct changes on another device are reflected at the next sync, not instantaneously.

## Separate future Storage/thumbnails plan — not performed

1. Back up database rows **and**, if any already exist, Storage objects separately; verify restores. Inventory every legacy image path/caption/stage and compute SHA-256 checksums and counts. Database backups alone do not contain Storage object bytes: [Supabase object-backup guidance](https://supabase.com/docs/guides/storage/management/download-objects).
2. Add private buckets and an owner-scoped media manifest with immutable object keys, original checksum, dimensions, MIME/size and revision. Preserve all original database fields and captions.
3. Add dual readers that prefer verified manifest objects but fall back to unchanged legacy JSON. Store bucket/object identifiers, never signed URLs as permanent IDs; generate short-lived authorized URLs at read time.
4. Use resumable, idempotent batches and a migration ledger. Upload without deleting originals; verify read-back checksums and owner-only RLS, including cross-user denial, before marking each item complete. Repeated identical charts must remain separate attachments unless the user explicitly chooses otherwise.
5. Generate separate thumbnails from verified originals; never overwrite originals. Galleries request thumbnails; editor/zoom/export requests originals. Version thumbnails with their source checksum and preserve image-editing compatibility.
6. Test production-sized copies, failure/retry, browser cache behavior, sharing permissions (if implemented elsewhere), downloads/exports and rollback. Canary one consenting account, compare network bytes, then expand gradually.
7. Keep an audited rollback switch to legacy readers and retain original JSON/media throughout a defined verification window. Any eventual removal requires a separate explicit approval, backups and verified reversibility.

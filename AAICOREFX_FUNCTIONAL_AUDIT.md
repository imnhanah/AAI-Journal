# AAICoreFx Functional Audit

Audit date: 2026-10-19  
Scope: static source review and deterministic Node-based tests only. No browser automation, live Supabase connection, credentials, production records, or application-feature changes were used.

## Executive summary

The project builds successfully, and the targeted financial, account-isolation, challenge, cache, and reminder test subset passes. The full test command does **not** pass: 404 of 415 tests pass and 11 fail. Several failing tests encode UI implementation details that no longer match the current design rather than demonstrating a runtime defect; they still need to be reconciled so that the suite is reliable.

Three confirmed code-level correctness defects were found:

1. Invalid numeric values can produce `NaN` in finance, savings, guardrail, and some journal-stat outputs.
2. The savings reminder's noon schedule uses the device timezone even though the savings window is explicitly London-based; the same UTC instant therefore produces different answers on different devices.
3. The deployment documentation lacks one complete, ordered migration path although the frontend requires RPCs and tables added by later migration files.

No live-database or browser conclusion is made in this report.

## 1. Baseline and evidence

### Repository state

The supplied checkout's Git worktree metadata points at a missing worktree location. Consequently, `git status` cannot establish whether generated or pre-existing files were dirty. No source-code change was made during this audit. `npm run build` regenerated the normal `dist/` output.

### Project inspected

- React 18.3.1, Vite 5.4.0, Supabase JS 2.45.4, Recharts 2.12.7, and Playwright 1.64.0 are declared in `package.json`.
- 92 JavaScript test/spec files are present (not approximately 91).
- `README.md`, `AUDIT.md`, source modules, migrations, and Edge Functions were reviewed.

### Commands actually executed

| Command | Result | Evidence |
| --- | --- | --- |
| `npm test` | Failed | 415 tests: 404 pass, 11 fail, 0 skipped; exit 1. |
| `npm run build` | Passed | Vite built 2,527 modules; 14 landing assets validated. |
| Financial/account targeted test set | Passed | 77 pass, 0 fail, 0 skipped. |
| `npm run check:mobile` | Blocked | Browser-based script could not launch Chromium under the macOS sandbox. |

The production build emitted two warnings: Babel deoptimised the very large `TradingJournal.jsx` transform, and Vite reported a primary JavaScript chunk of 1,486.45 kB (391.28 kB gzip). This is a confirmed build-performance warning, not a measured runtime performance result.

### Mobile check limitation

`scripts/check-mobile.js` is not a static/mobile-only checker. It starts Vite and launches Playwright at 360, 390, and 430px in both themes, then clicks UI controls and checks overflow/targets. Chromium failed before any page was tested with macOS Mach-port permission error 1100 (`bootstrap_check_in ... MachPortRendezvousServer: Permission denied`). Therefore it produced no valid mobile visual or functional result.

### Earlier audit report verification

`AUDIT.md` reports 116 passing tests, 18 validated landing screenshots, and browser checks as of 2026-10-08. Those statements do not describe the present checkout: the current full suite has 415 tests with 11 failures, the build validates 14 assets, and browser validation was not executable in this audit.

## 2. Full-suite failures

These are confirmed test failures. Their status below distinguishes a product issue from a stale/brittle test expectation.

| Test | Classification | Assessment |
| --- | --- | --- |
| Shared picker/no native `<select>` | Code-quality failure | `TradingJournal.jsx` now contains a native select. It may be intentional for accessibility or a regression; static inspection alone cannot decide. |
| No explicit sub-12px font sizes | Test/tooling failure | The font-floor collector finds remaining source values, including SVG/public-site content. This is not evidence of unreadable rendered text without browser testing. |
| Markups require all planning fields | Behavioral mismatch | `journalSignal` no longer returns the exact asserted wording/condition. Verify desired validation/message contract. |
| Secondary screens load on demand | Stale expectation | Test requires `React.lazy` for PublicSite, ChallengePage, and BacktestAccounts. Current code uses normal loading, consistent with the previously requested reversal of on-demand loading. |
| Every extracted string has every translation | Localization coverage failure | Current extraction discovers at least one untranslated source string. This is a real catalog-coverage concern, but not proof of a user-visible fallback without rendering it. |
| Phone backtest legacy copy/assertions | Stale expectation | Test expects removed/changed literal copy and structure. |
| Sidebar leave handler/tooltips | Stale ownership expectation | Test expects tooltip handlers inside `SidebarShell`; current shell delegates navigation content to children. |
| News impact surface styling | Stale visual expectation | Exact former `color-mix` declarations are no longer present. Browser validation is required to judge visual contrast. |
| Shell alignment/gutters | Stale layout expectation | The test expects the former floating/fixed header. Current `shellAlignment.css` explicitly implements normal header flow. |
| Header fixed/scrollport | Stale layout expectation | Same implementation conflict: test expects `position: fixed`, current source uses a joined header. |
| Sidebar tooltip clipping | Stale implementation expectation | Test expects tooltip portal/focus handlers that are no longer in `SidebarShell`. |

Recommendation: do not blindly alter the UI to satisfy these tests. First decide the current UI contracts, then update or replace static tests with behavior-oriented tests.

## 3. Financial calculation verification

### Modules inspected

- `src/balanceModel.js`
- `src/journalStats.js`
- `src/positionSizing.js`
- `src/financeScope.js`
- `src/savingsSchedule.js`
- `src/savingsCardModel.js`
- `src/savingsReminderClock.js`
- `src/accountRisk.js`

### Passing deterministic coverage

The targeted suite verifies numeric-string trade P&L, invalid primary P&L exclusion, stable same-day ordering, closed-trade filtering, position-size rounding, minimum-volume protection, stale conversion-rate rejection, balance-scoped finance/savings, partial/full transfers, London DST window calculation, account-isolated guardrails, challenge deposits/resets, cloud-cache delta deletion, and user/account isolation.

Independent calculations also confirmed:

- EUR/USD, $100 risk, 0.001 price stop: calculated size is 1.00 lot and estimated risk is approximately $100.
- A valid $10 closed trade with a 10% savings allocation gives $1 target and $1 remaining when no transfer exists.
- Position sizing requires a current conversion rate when account and profit currencies differ, and marks built-in default contract specifications as estimates rather than broker-verified specifications.

### Confirmed findings

#### High — malformed numeric data poisons financial results

**Type:** confirmed deterministic code-analysis result.

`summarizeClosedTrades` validates the primary `pnl`, but then adds `grossPnl`, `commission`, and `swap` using unguarded `Number(...)` calls at [src/journalStats.js:24](/Users/new/Desktop/AAI%20Journal/src/journalStats.js:24)-[26](/Users/new/Desktop/AAI%20Journal/src/journalStats.js:26). A nonnumeric optional value makes totals `NaN`.

Finance and savings have the same pattern for a trade's primary P&L at [src/financeScope.js:29](/Users/new/Desktop/AAI%20Journal/src/financeScope.js:29) and [src/savingsSchedule.js:16](/Users/new/Desktop/AAI%20Journal/src/savingsSchedule.js:16). A synthetic closed trade with `pnl: 'not-number'` produced `NaN` for finance profit/available capital and for savings profit/target/remaining.

Guardrails use direct numeric coercion at [src/accountRisk.js:9](/Users/new/Desktop/AAI%20Journal/src/accountRisk.js:9)-[12](/Users/new/Desktop/AAI%20Journal/src/accountRisk.js:12). Invalid percentage/balance fields produced `NaN` caps and balance in the deterministic probe.

**Impact:** imported, manually edited, legacy, or malformed cloud rows can contaminate totals, savings availability, or risk UI instead of being rejected or safely ignored.

**Recommended fix:** centralise finite-number parsing at the persistence boundary and use it consistently in every financial aggregation. Decide explicitly whether invalid saved financial values are rejected, displayed as incomplete, or coerced to zero; do not silently mix policies.

#### High — reminder schedule is device-timezone dependent

**Type:** confirmed deterministic functional defect.

The reset window is calculated in `Europe/London` at [src/savingsSchedule.js:40](/Users/new/Desktop/AAI%20Journal/src/savingsSchedule.js:40)-[48](/Users/new/Desktop/AAI%20Journal/src/savingsSchedule.js:48), but the scheduled noon is built with local `Date#setHours` and `#setDate` at [src/savingsSchedule.js:54](/Users/new/Desktop/AAI%20Journal/src/savingsSchedule.js:54)-[62](/Users/new/Desktop/AAI%20Journal/src/savingsSchedule.js:62).

For the identical instant `2026-10-09T12:00:00Z`, `savingsReminderDue({interval: 'Weekly'})` returned `true` in the default UTC/Africa-Accra execution timezone and `false` with `TZ=America/New_York`. The business rule and tests describe Friday noon within the London window, so result should not depend on client location.

**Recommended fix:** calculate schedule dates/times in `Europe/London` (or explicitly document that reminders intentionally use each device's local time, and align the window accordingly). Add a test that runs the same UTC instant in two process timezones.

#### Medium — broker specifications remain estimates

**Type:** confirmed design limitation, not a calculation failure.

All built-in instrument specifications set `brokerVerified: false` ([src/positionSizing.js:3](/Users/new/Desktop/AAI%20Journal/src/positionSizing.js:3)-[27](/Users/new/Desktop/AAI%20Journal/src/positionSizing.js:27)); the calculator correctly labels returned results `estimated` at [src/positionSizing.js:113](/Users/new/Desktop/AAI%20Journal/src/positionSizing.js:113). It supports per-account overrides and current conversion rates. Contract size, tick value, leverage, margin, and symbol naming nevertheless vary by broker.

**Recommendation:** keep the existing warning and require broker-confirmed specs before treating sizing as executable advice. This cannot be verified from source without broker metadata.

## 4. Accounts, sub-accounts, synchronization, and challenges

### Confirmed strengths

- Active-account preference is user-scoped and handles deleted/foreign selection safely; all targeted tests pass.
- Delta sync uses a table manifest, rejects incomplete responses, merges remote changes, and removes remote deletions ([src/journalDelta.js:4](/Users/new/Desktop/AAI%20Journal/src/journalDelta.js:4)-[26](/Users/new/Desktop/AAI%20Journal/src/journalDelta.js:26)).
- Cloud cache checks session user and cache owner both before and after sync/image loading ([src/journalCloudCache.js:6](/Users/new/Desktop/AAI%20Journal/src/journalCloudCache.js:6)-[21](/Users/new/Desktop/AAI%20Journal/src/journalCloudCache.js:21), [24](/Users/new/Desktop/AAI%20Journal/src/journalCloudCache.js:24)-[42](/Users/new/Desktop/AAI%20Journal/src/journalCloudCache.js:42)).
- Challenge lifecycle tests pass for account isolation, deposits, checkpoints, reset/replay, concurrent updates, local isolation, and cloud scoped operations.
- Shared-trade pruning retains results for other balances at [src/challengeLifecycle.js:68](/Users/new/Desktop/AAI%20Journal/src/challengeLifecycle.js:68)-[76](/Users/new/Desktop/AAI%20Journal/src/challengeLifecycle.js:76).

### Unverified risks

- No live Supabase transaction, concurrent browser tab, offline/reconnect, or actual auth/session race was executed.
- Direct callers can still supply malformed numeric values, which is the confirmed aggregation concern above.
- Static tests do not prove UI edit/delete persistence, dialog error state, or cache invalidation against real Postgres.

## 5. Supabase schema, migration, and Edge Function review

### RLS and ownership review

The base schema enables RLS and uses `auth.uid()` ownership predicates for core profiles, settings, accounts, trades, rules, and journal entries. Later finance, multi-balance, challenge, period-review, and backtest migrations follow the same ownership design. The journal RPCs use `security invoker`, authenticate via `auth.uid()`, query rows by `user_id`, revoke public/anonymous execution, and grant to `authenticated` ([supabase/journal_low_egress_migration.sql:56](/Users/new/Desktop/AAI%20Journal/supabase/journal_low_egress_migration.sql:56)-[112](/Users/new/Desktop/AAI%20Journal/supabase/journal_low_egress_migration.sql:112)).

This is a positive static finding, not a live RLS verification. Actual policy behavior, grants, schema-cache state, and Edge Function deployment configuration require a disposable Supabase project.

### Confirmed deployment/documentation defect — incomplete migration path

**Type:** confirmed code/documentation compatibility finding.

`README.md` presents `supabase/schema.sql` as the database setup at [README.md:28](/Users/new/Desktop/AAI%20Journal/README.md:28)-[37](/Users/new/Desktop/AAI%20Journal/README.md:37). The current frontend, however, calls `tj_sync_journal` and specifically tells the user to apply `journal_low_egress_migration.sql` if it is absent ([src/journalCloudCache.js:12](/Users/new/Desktop/AAI%20Journal/src/journalCloudCache.js:12)-[15](/Users/new/Desktop/AAI%20Journal/src/journalCloudCache.js:15)). Further migrations add finance, multi-balance, savings scope, backtests, challenge modes, close timing, trade prices/risk, and egress hardening.

`journal_egress_hardening.sql` explicitly requires the low-egress migration first ([supabase/journal_egress_hardening.sql:1](/Users/new/Desktop/AAI%20Journal/supabase/journal_egress_hardening.sql:1)), and the risk migration replaces its RPC metadata allow-list ([supabase/trade_risk_calculation_migration.sql:12](/Users/new/Desktop/AAI%20Journal/supabase/trade_risk_calculation_migration.sql:12)-[47](/Users/new/Desktop/AAI%20Journal/supabase/trade_risk_calculation_migration.sql:47)). There is no single versioned migration index or complete install order.

**Impact:** a fresh schema-only installation can have a functional-looking app but fail cloud journal synchronization or omit feature fields/RPCs. Applying compatible migrations in an arbitrary order can also overwrite a newer `tj_bootstrap_metadata` function definition.

**Recommended fix:** publish a versioned migration manifest and a fresh-install script/order. Make dependencies explicit, particularly: schema → feature tables/columns → low-egress sync → egress hardening → risk metadata replacement, plus the dependent challenge/savings/multi-balance migrations.

### Edge Functions

- `delete-profile` authenticates the bearer token before using service role to remove only that authenticated user. It uses explicit confirmation.
- `ai-coach` authenticates first and filters every account-scoped query by both `account_id` and user ID.
- `economic-calendar` is intentionally public and only permits fixed weekly offsets; it uses service role only to maintain a non-user calendar cache.

No secret values were inspected or reported. CORS and deployment/auth configuration were not live-tested.

## 6. Reliability and UI limitations

Static review found explicit session/cache checks, missing-RPC error handling, stale image-version handling, and error propagation around async sync operations. Build completes.

The following cannot be claimed without browser or live-service tests:

- visual alignment, colors, contrast, responsive layout, focus order, and overflow;
- real button/menu/modal/form interaction;
- console and network errors in a rendered page;
- real authentication, OAuth, password-reset delivery, Edge Function deployment, RLS enforcement, transaction behavior, and browser storage/session persistence;
- load performance, accessibility-tree behavior, or security testing against a deployed application.

## 7. Test coverage recommendations

No new tests were added in this verification pass. The main newly discovered financial defects need an explicit product decision about malformed persisted values (reject versus ignore versus coerce) before a stable expected assertion can be written. After that decision, add deterministic tests for:

1. invalid `pnl`, `grossPnl`, `commission`, `swap`, movement amount, account balance, and guardrail percentage never producing `NaN`;
2. London reminder due calculation producing the same answer under UTC, America/New_York, and Europe/London host timezones;
3. a fresh, ordered migration installation against disposable Postgres/Supabase;
4. behavior-oriented UI tests replacing obsolete source-string assertions.

## 8. Prioritized recommended fixes

1. **High:** define and enforce finite-number handling across financial persistence and all aggregators.
2. **High:** make reminder schedule timezone semantics consistently London-based (or explicitly local everywhere).
3. **High:** document and automate a complete ordered migration installation path.
4. **Medium:** reconcile the 11 failing tests with the intentional current UI contracts; remove brittle source-literal tests where behavior tests are appropriate.
5. **Medium:** split or defer large dashboard code paths to reduce the build warning, after measuring in a browser.
6. **Medium:** require broker-specific contract confirmation before using position-sizing estimates for real order placement.
7. **Low:** complete catalog coverage for all source strings and validate translations in rendered UI.

## Appendix: classification key

- **Confirmed test failure:** a command executed in this audit failed.
- **Confirmed code-analysis finding:** deterministic source execution or direct control/data-flow inspection demonstrates the issue.
- **Unverified risk:** plausible concern that requires a browser, live database, broker data, or deployment environment to prove.

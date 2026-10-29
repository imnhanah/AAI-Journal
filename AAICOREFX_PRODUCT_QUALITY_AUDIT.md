# AAICoreFx Product Quality Audit

Audit date: 19 October 2026  
Scope: static source review, existing automated-test results, and production-build output. No browser, live Supabase project, production data, or application behavior was changed.

## Executive summary

AAICoreFx has meaningful product engineering foundations: financial validation is explicitly fail-closed, finance/challenge/savings modules share core models, Supabase ownership boundaries are represented in client and SQL, and the application has substantial deterministic coverage (92 test files). It is not appropriate to call the rendered product unprofessional from static code alone.

The main constraint is concentration of responsibility. The application shell, route rendering, state, data orchestration, components, and a large CSS body coexist in `TradingJournal.jsx`. This makes working functionality expensive to change safely and makes visual consistency dependent on cascade order and local overrides. The other material concern is delivery performance: the production entry bundle is about 1.49 MB before gzip, while only the public site is split lazily.

The recommended path is incremental: establish a clean test gate and style/component ownership first; then extract page domains and code-split them behind behavior-preserving route boundaries. Do not redesign pages before obtaining rendered evidence.

## Evidence and limits

| Item | Result |
| --- | --- |
| Source reviewed | React application, shared calculations, storage/cloud access, Supabase SQL/docs, CSS, tests, and build configuration. |
| Automated tests | 424 total: 413 passing, 11 failing, 0 skipped. The 11 failures predate this audit and are static UI-contract assertions. |
| Build | Passed. The build reports a 1,492.62 kB main JavaScript chunk (393.13 kB gzip) and 812.72 kB CSS (109.99 kB gzip). |
| Browser/visual evidence | Not available. No visual hypothesis below is treated as a confirmed rendered defect. |
| Live data/RLS evidence | Not available. Supabase findings are static code and SQL observations only. |

Severity: **High** = material reliability, release-quality, or accessibility risk; **Medium** = likely maintainability, performance, or consistency cost; **Low** = bounded polish/documentation opportunity.

## Findings

### 1. The application shell is a high-risk change surface

- **Severity:** High
- **Type:** Confirmed static architecture finding
- **Evidence:** [TradingJournal.jsx](/Users/new/Desktop/AAI%20Journal/src/TradingJournal.jsx:1) is 9,605 lines. It imports pages, Recharts, storage, Supabase adapters, financial modules, desktop/mobile variants, and holds the main application state. It embeds primary CSS beginning at [line 6839](/Users/new/Desktop/AAI%20Journal/src/TradingJournal.jsx:6839).
- **User impact:** A small page, modal, or CSS change can cause unrelated route, loading, responsive, or state regressions.
- **Recommended improvement:** Extract route/page containers (`Dashboard`, `Trade Log`, `Finance`, `Analytics`, `News`, `Management`) while retaining props and behavior. Then make a `JournalAppShell` responsible only for session loading, navigation, toasts, modals, and dispatch.
- **Regression risk:** High. Preserve public props and add route-level integration tests before every extraction.

### 2. Styling ownership is fragmented and cascade-dependent

- **Severity:** High
- **Type:** Confirmed static maintainability finding; rendered inconsistency itself requires browser proof
- **Evidence:** `themeTokens.css` has 1,297 lines, `entryComposer.css` 2,305 lines, and `TradingJournal.jsx` contains a large embedded CSS string. Static scans find 1,660 style signals involving inline styles, borders, shadows, or `!important`; `TradingJournal.jsx` contains 96 inline-style expressions.
- **User impact:** Theme or spacing changes can become route-specific accidentally. Override order and `!important` rules make light/dark and desktop/mobile drift harder to reason about.
- **Recommended improvement:** Define layers: tokens → primitives → component styles → page composition → responsive exceptions. Move embedded CSS gradually into owned feature/shell files. Prefer component properties/variants over inline pixel values and broad overrides.
- **Regression risk:** High for bulk moves. Establish screenshot baselines before selector consolidation.

### 3. First-load bundle is larger than necessary for a multi-page product

- **Severity:** Medium
- **Type:** Confirmed build finding
- **Evidence:** The current production build emits `index-*.js` at 1,492.62 kB uncompressed and warns about chunks over 500 kB. [TradingJournal.jsx:73](/Users/new/Desktop/AAI%20Journal/src/TradingJournal.jsx:73) lazily imports only `PublicSite`; Recharts and most route functionality are statically imported.
- **User impact:** Slower initial load, parse, and interaction on mobile or lower-powered devices, even for users who only need one screen.
- **Recommended improvement:** Route-split Analytics, Backtest, News calendar, Challenge, and Management first. Keep shell, active journal, and trade entry eager. Measure production builds and throttled-device behavior before/after.
- **Regression risk:** Medium. Loading/error boundaries and retained route state need tests.

### 4. Financial validation is centralized, but presentation and persistence still contain permissive numeric coercions

- **Severity:** Medium
- **Type:** Confirmed static consistency finding; no end-user bypass was demonstrated in this audit
- **Evidence:** [financialValidation.js](/Users/new/Desktop/AAI%20Journal/src/financialValidation.js) is applied at [TradingJournal.jsx:5760](/Users/new/Desktop/AAI%20Journal/src/TradingJournal.jsx:5760) and consumed by savings, risk, and challenge modules. Yet `TradingJournal.jsx` retains many `Number(value) || 0` calculations, while [db.js:83](/Users/new/Desktop/AAI%20Journal/src/db.js:83)-[85](/Users/new/Desktop/AAI%20Journal/src/db.js:85) use coercive defaults for finance/savings persistence.
- **User impact:** The approved fail-closed main path is protected, but a future direct caller or new UI path can silently normalize malformed values to zero before validation.
- **Recommended improvement:** Introduce a single internal parsing/result helper for drafts and persistence boundaries. It must distinguish blank optional values from malformed values and default to zero only where the rule explicitly permits it. Keep formatting separate from calculation parsing.
- **Regression risk:** Medium-to-high. Add persistence-adapter contract tests before changing coercion.

### 5. Data access adapters are difficult to review safely

- **Severity:** Medium
- **Type:** Confirmed static maintainability finding
- **Evidence:** [db.js](/Users/new/Desktop/AAI%20Journal/src/db.js) is 113 physical lines, but public persistence operations are dense one-line functions, including accounts at [74-75](/Users/new/Desktop/AAI%20Journal/src/db.js:74) and finance/savings at [83-88](/Users/new/Desktop/AAI%20Journal/src/db.js:83). It also has schema-fallback behavior for older deployments.
- **User impact:** Ownership filters, error paths, concurrent updates, and numeric mapping are unnecessarily hard to audit. Compatibility fallback may conceal a partially migrated deployment.
- **Recommended improvement:** Reformat and split by domain (`accounts`, `trades`, `finance`, `reviews`) without changing queries. Standardize result objects. Surface schema fallback as a migration-health warning rather than silently treating it as normal.
- **Regression risk:** Medium. Add query-mock snapshot tests before and after splits.

### 6. Page-level financial calculations are duplicated outside shared modules

- **Severity:** Medium
- **Type:** Confirmed static architecture finding
- **Evidence:** Shared `summarizeClosedTrades`, `savingsAllocation`, `accountLossGuardrails`, and `challengeLifecycle` exist, but raw P&L/net-result reductions also occur at [TradingJournal.jsx:3321](/Users/new/Desktop/AAI%20Journal/src/TradingJournal.jsx:3321), [3366](/Users/new/Desktop/AAI%20Journal/src/TradingJournal.jsx:3366), [4054](/Users/new/Desktop/AAI%20Journal/src/TradingJournal.jsx:4054), and [6014](/Users/new/Desktop/AAI%20Journal/src/TradingJournal.jsx:6014).
- **User impact:** Dashboard, trade details, analytics, and finance can drift in treatment of closed trades, costs, invalid records, or multi-balance data.
- **Recommended improvement:** Create validation-aware read-model selectors such as `selectTradeNetPnl`, `selectScopedTrades`, and `selectAccountPerformance`. Views should render selector output rather than recompute finance expressions.
- **Regression risk:** Medium. Use parity fixtures with valid, malformed, and multi-balance records.

### 7. Error/loading states exist, but lack one shared rendering contract

- **Severity:** Medium
- **Type:** Confirmed static UX architecture finding; rendered clarity needs browser testing
- **Evidence:** Accessible `role="alert"`/`role="status"` patterns exist in authentication and challenge pages, and the root owns toast/error state beginning near [TradingJournal.jsx:5379](/Users/new/Desktop/AAI%20Journal/src/TradingJournal.jsx:5379). Recovery behavior is still emitted through distributed local calls and route-specific UI.
- **User impact:** Similar sync, save, validation, and loading failures can receive different recovery actions or prominence depending on where they occur.
- **Recommended improvement:** Define `AsyncState` and `InlineError` primitives with consistent retry, accessible announcements, and data-preservation language. Consolidate rendering first; keep current copy initially.
- **Regression risk:** Low-to-medium if introduced as wrappers.

### 8. Custom picker/dialog behavior needs real-browser keyboard and focus validation

- **Severity:** Medium
- **Type:** Static accessibility risk, not a confirmed accessibility defect
- **Evidence:** [JournalControls.jsx:49](/Users/new/Desktop/AAI%20Journal/src/JournalControls.jsx:49) implements portaled pickers with Escape and ArrowDown support but uses `role="group"`; the app also has multiple hand-built modal patterns. Static review cannot prove initial focus, focus containment/restoration, scroll lock, or screen-reader behavior.
- **User impact:** Keyboard-only and assistive-technology users may lose context or encounter inconsistent overlay navigation.
- **Recommended improvement:** Adopt one tested dialog/popover primitive or formalize equivalent behavior: initial focus, trapped focus for modals, restored focus, Escape semantics, labels/descriptions, and pointer/keyboard parity.
- **Regression risk:** Medium. Overlay interactions are broadly shared.

### 9. Desktop/mobile variants improve targeting but multiply product surfaces

- **Severity:** Medium
- **Type:** Confirmed static maintainability finding
- **Evidence:** Dedicated mobile components/CSS exist for Finance, Trade Logs, Markups, News, Calendar, Challenge, Account Settings, Review, Backtest, and routine. The root imports desktop and mobile paths near [TradingJournal.jsx:8](/Users/new/Desktop/AAI%20Journal/src/TradingJournal.jsx:8).
- **User impact:** Feature parity, labels, validation, and accessibility fixes must be maintained in more than one rendering path.
- **Recommended improvement:** Share headless models/action handlers and keep responsive rendering components thin. Do not force identical markup where mobile needs a different information order.
- **Regression risk:** Medium. Start with finance and trade-entry models, where financial rules matter most.

### 10. Visual hierarchy and density require rendered evidence before redesign

- **Severity:** Low now; potentially Medium after browser confirmation
- **Type:** Visual-review hypothesis only
- **Evidence:** Code contains many semantic colors (`green`, `red`, `purple`, `blue`, `amber`), repeated border/shadow declarations, card primitives, and page-specific CSS. Static inspection cannot establish accent competition, card nesting, contrast, clipping, or crowding at any viewport.
- **User impact:** If confirmed, users may scan slower or fail to distinguish primary actions from context.
- **Recommended improvement:** Review Dashboard, Trade Log, Finance, Analytics, News, Challenge, and Account Settings at desktop/tablet/mobile in both themes. Assess one primary action, surface depth, semantic-color reserve, typography scale, row density, and focus visibility.
- **Regression risk:** Low for review; high for a broad retheme.

### 11. Supabase boundaries are thoughtfully designed, but live guarantees remain unverified

- **Severity:** Medium
- **Type:** Positive static finding plus unverified operational risk
- **Evidence:** [journalCloudCache.js](/Users/new/Desktop/AAI%20Journal/src/journalCloudCache.js:5) verifies session and private-cache ownership before sync and image loading. The migration manifest/read-only verifier documents expected tables/RPCs/RLS. SQL uses ownership-oriented policies and `security invoker` RPCs. No live RLS, schema-cache, Edge Function, or concurrency test was run.
- **User impact:** A partial migration or live configuration error can still behave differently from static expectations.
- **Recommended improvement:** Add a disposable Supabase integration environment: apply the manifest, run the verifier, then test two-user isolation, RPC grants, stale-version behavior, and deletions.
- **Regression risk:** Low to add an environment; high if production migration history is rewritten.

### 12. The release gate is not healthy while 11 tests fail

- **Severity:** Medium
- **Type:** Confirmed test-quality finding
- **Evidence:** `npm test` reports 413 passing / 11 failing / 424 total. Failures are pre-existing static UI-contract tests covering sidebar/header/layout/picker/page-copy expectations.
- **User impact:** A red suite reduces confidence in later refactors and hides genuinely new failures.
- **Recommended improvement:** Triage each test: restore a valid contract, replace brittle source-string assertions with behavior coverage, or retire an obsolete expectation with a documented decision. Do not bulk-disable tests.
- **Regression risk:** Low for isolated test corrections.

### 13. Coverage is substantial but concentrated in unit/static checks

- **Severity:** Medium
- **Type:** Confirmed coverage finding
- **Evidence:** 92 Node test files cover models and source contracts. `scripts/check-mobile.js` is a useful Playwright mobile harness, but this audit did not execute it because browser execution is unavailable here. No rendered visual or live Supabase results are available.
- **User impact:** Layout, focus behavior, browser persistence, theme transitions, network errors, and actual RLS can regress while units remain green.
- **Recommended improvement:** Add app-integration tests with mocked storage, Playwright user journeys, screenshot baselines, axe checks, and disposable-Supabase contract tests.
- **Regression risk:** Low to add tests; moderate CI runtime cost.

## Design-system assessment

### Confirmed strengths

- Shared theme tokens and journal semantic variables exist in [themeTokens.css](/Users/new/Desktop/AAI%20Journal/src/themeTokens.css) and [TradingJournal.jsx:6848](/Users/new/Desktop/AAI%20Journal/src/TradingJournal.jsx:6848).
- Shared themed field/select/date/time controls and confirmed deletion exist in [JournalControls.jsx](/Users/new/Desktop/AAI%20Journal/src/JournalControls.jsx).
- Lucide provides one consistent icon system.
- Existing toast, error-card, loading, and confirmation patterns should be preserved as the basis for later consolidation.

### Requires browser inspection

- Contrast of accent/background combinations in dark and light themes.
- Whether borders, shadows, cards, and color semantics create visual noise.
- Typography scale and line length at desktop, tablet, and phone widths.
- Table overflow, chart readability, sidebar/header alignment, and modal overlap.
- Focus indicators, hover states, reduced motion, and dark-to-light transitions.

## Product-consistency assessment

Accounts, balances, trades, finance, savings, challenges, and backtests share important domain concepts, and fail-closed validation now reaches savings, risk, and challenge logic. The remaining integration risk is that some read calculations remain UI-local. The next architectural work should consolidate calculation consumers—not merge unrelated features or remove differentiated workflows.

## Prioritized improvement roadmap

### Quick, low-risk polish

| Priority | Improvement | Regression protection |
| --- | --- | --- |
| P0 | Triage the 11 failing tests. | Fix one expectation at a time; do not mute groups. |
| P1 | Document CSS layers and component ownership. | No runtime change. |
| P1 | Reformat/split `db.js` without changing queries. | Query-mock snapshots. |
| P1 | Replace duplicated presentational inline values with current tokens/variants. | Component snapshots and later visual checks. |
| P2 | Standardize async error/retry wrappers. | Existing interaction tests. |

### Medium-risk component cleanup

| Priority | Improvement | Regression protection |
| --- | --- | --- |
| P0 | Extract validation-aware financial selectors/read models. | Cross-page valid/malformed/multi-balance parity fixtures. |
| P1 | Extract Finance, Analytics, News, and Trade Log containers. | Route integration/state-retention tests. |
| P1 | Share desktop/mobile action/model hooks. | Paired desktop/mobile behavior tests. |
| P2 | Formalize picker/modal focus behavior. | Keyboard Playwright tests and axe checks. |
| P2 | Move embedded CSS into domain files. | Screenshot baselines per migrated page/theme. |

### High-risk architectural changes

| Priority | Improvement | Regression protection |
| --- | --- | --- |
| P0 | Route-level code splitting for chart-heavy/secondary screens. | Loading/error tests, retained-navigation tests, performance budget. |
| P1 | Disposable Supabase integration environment in CI. | Manifest-order migration job and two-user tests. |
| P1 | Timestamped Supabase CLI migrations only after a backup/rehearsal. | Never retrofit production history without staging. |
| P2 | Lightweight shared UI primitive layer. | Visual matrix and incremental adoption only. |

## Recommended test matrix

1. **Unit:** retain financial/timezone/balance/challenge/cache tests; add selector-parity tests as calculations move.
2. **Integration:** render routes with mock cloud/local storage; exercise create/edit/delete cancellation and retry without real records.
3. **Accessibility:** keyboard traversal for sidebar, pickers, dialogs, table regions, and destructive confirmations; axe supplements manual checks.
4. **Visual regression:** desktop 1440 px, tablet 768 px, mobile 390 px; dark/light and default/high-contrast accents; populated, loading, empty, error, modal, and long-number states.
5. **Supabase:** in a disposable project only, apply [MIGRATION_MANIFEST.md](/Users/new/Desktop/AAI%20Journal/supabase/MIGRATION_MANIFEST.md), run the verifier, then test two-user RLS isolation and RPC grants.
6. **Performance:** define budgets for initial JS/CSS, route chunks, and chart rendering; verify from production builds and throttled traces.

## Conclusion

AAICoreFx does not require a visual redesign to become more professionally engineered. The highest-value work is disciplined consolidation: get CI green, shrink the root change surface, centralize financial read models, add route splitting, and introduce browser/live-database verification. These steps preserve the product identity and working features while making future polish safer and more consistent.

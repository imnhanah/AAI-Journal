# Daily-use mobile refinement

`mobile-daily` starts from main after the approved fast-forward to `54ae036`. The original checkout and all 90 uncommitted files remain unchanged; its 340 source hashes match the preservation manifest.

Dashboard uses `ReferenceDashboardPage`, scoped journal statistics and balances, existing challenge state and the existing Start Day trigger. Calendar uses `AttachedPnlCalendar` on both pages and `DayTradesModal` for full figures, trades and cash movements. Routine uses `DailyRoutinePopup`, profile persistence through `useDailyRoutine`, cached News data and real account guardrail summaries. No save/reset logic is replaced.

## Step 1 — Dashboard

Phone refinements include the 26px headline, 34px wrapping net P&L, progress-first routine label, left-aligned challenge detail, bounded responsive charts and short Recent/Flow labels. Existing desktop labels and layout are retained.

The app-browser audit reports zero findings for Dashboard at 360/390/430px in dark/light (`step-1.json`). The standalone checker was invoked but Chromium startup was rejected by the macOS sandbox (exit 2); that is not counted as a passing CLI run. Build and all 323 tests passed.

## Step 2 — Calendar and day sheets

`formatCompactAmount` is the single shared implementation: integer amounts below 1K, one decimal below 10K, whole K amounts below 1M, and one decimal in M. Boundary, negative, rounding and invalid-value tests cover each band; the legacy export is an alias, not a second implementation. Desktop continues to use its original formatter.

The grid uses 44px-high cells. At 360px it uses 2px gaps so seven 44px targets fit within 16px side padding; from 375px it uses the requested 3px gaps. Week summaries share one card, consecutive quiet weeks are merged, and only phone cell contents clip. The day sheet is capped at 700px, has independent scrolling and a wrapping 38px total.

The dev-only long-figure fixture uses a separate synthetic identity. Checked values are exactly +$1,222,184.60, -$26,350.00 and a live balance of +$12,340,601.40. Cash and five-thumbnail screenshot rows are exercised. Both themes and all three widths passed the app-browser audit. The CLI checker now opens three calendar day sheets rather than checking only the page; its run is still blocked at Chromium startup (exit 2). Build and all 325 tests passed.

## Step 3 — Routine and final acceptance

The routine sheet fills 100dvh, keeps a separate 44px close target with a 36px visual frame, a 64px progress ring, wrapping current-session label, 38px checklist tiles and a pinned action bar. Completion decorations are explicitly conditional on phone width; desktop retains its previous appearance. Closing without saving stores no completion and does not open the markup composer. REQUIRE_ALL remains false, and all UTC/profile persistence logic is unchanged.

The checker now opens the routine, ticks approximately two-thirds of its items, ticks all items, closes without saving, and opens it again through the central menu. It also opens three day sheets, including cash movements and screenshots. The default command exercises sheets; `--sheets=false` explicitly skips them. Run full acceptance with:

```sh
node scripts/check-mobile.js --routes=dashboard,calendar --accents=all --long-figures=true
```

`final.json` contains **936 unique app-browser measurements, zero findings**, covering all 18 accent choices (Default plus 17 colours), dark/light, and 360/390/430px. Dashboard, Calendar, all three routine states and all three day sheets are checked at every combination. The central menu and its routine trigger are additionally checked at 430px for every accent/theme; the other widths were verified in the previous frame phase. Synthetic long values are used throughout. Earlier exploratory findings are preserved in `step-3-history.json` and are not presented as final passing measurements.

The standalone script was run after each step; all three attempts exited 2 at Chromium launch with macOS MachPortRendezvous permission denied. It is not claimed to have passed. The actual DOM audits used the same exported `auditMobile` function in the app browser. Production user data was never loaded in these fixtures, and no trade, markup or cash movement was saved.

Build and all **327 tests** pass. Commits are one per step: Dashboard `c917962`, Calendar `578c7fd`, and the routine/final acceptance commit containing this report.

## Desktop and original work

The desktop baseline is the unchanged `mobile-frame` checkout at `54ae036`, served separately on 4175. The revised checkout was served on 4174. Paired Dashboard captures at **1440×900 have zero changed pixels in both dark and light** after decoding. Identical synthetic data, preloaded fonts, fixed quote and disabled fixture animations are used on both sides. The production entry does not load this test stabilization.

`main` was fast-forwarded only with the user's approval. `mobile-daily` remains a separate branch and checkout; it has not been merged back or deployed to localhost:5173. The original desktop checkout remains on its original branch and HEAD, and all 90 uncommitted files and all 340 recorded source hashes remain unchanged. The temporary browser viewport and servers are restored/stopped after verification.

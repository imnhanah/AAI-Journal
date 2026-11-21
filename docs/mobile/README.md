# Mobile implementation and verification

The `mobile-frame` branch was created from `main` at `a158bd9`. The current app implementation was copied into the isolated worktree to preserve the user's current desktop baseline, including previous mobile implementations. The original checkout is never edited or staged. Preserved ` 2` recovery copies remain on disk and are ignored, not deleted.

## Six phases

1. Shared checker, global phone rules and frame.
2. Dashboard, Calendar/day sheet and Start Day routine.
3. Trade Logs, Markups and their two-step forms.
4. Review, Finance and Backtest.
5. Analytics, Psychology, News and Challenge.
6. Management, Profile, Account Settings and protected popups.

Each phase has one commit and a build/test run before its commit. All new layout refinements are scoped below 768px.

## Checker

Install dependencies with `npm ci` and the matching browser with `PLAYWRIGHT_BROWSERS_PATH=$PWD/.cache/playwright npx playwright install chromium`.

Run `npm run check:mobile`. It creates synthetic data in a fresh browser context, blocks external requests and checks 12 routes at 360, 390 and 430px in dark and light. `npm run check:mobile -- --routes=dashboard,calendar,trade-log --accents=all` checks the core routes in every existing accent. It reports selectors and pixel amounts in `artifacts/mobile-report.json`, returns 1 for findings and 2 for infrastructure failures. It never logs in or loads the user's journal.

This host blocks Chromium process startup through its sandbox. The app-browser fallback runs the same exported `auditMobile` function, with saved reports. A blocked CLI launch is not counted as a passing CLI run.

## Baseline

`baseline.json` contains 72 actual app-browser measurements before shared style refinements: 288 element-level findings, zero document horizontal-scroll findings. Findings include repeated descendants, not 288 independent defects. Core issues: small 360px calendar cells, an overflowing Dashboard account selector, narrow Analytics period controls, a compact Review month button strip, and an unmarked News currency rail.

## Shell and tooling

The app uses a shared `.tj-root` shell with a sidebar, `.tj-main`, a top header, and a separately scrolling content area. Styling is plain CSS: the embedded journal stylesheet plus imported feature stylesheets, not Tailwind or CSS modules. Existing responsive rules include 1280, 1024, 900 and 767px breakpoints. Phone-only feature rules use `max-width:767px`; the new header is in normal flow and the bottom navigation reserves content space.

The repository originally had Node tests but no browser runner. This branch adds Playwright and a dev-only synthetic fixture. The fixture blocks external requests, uses a synthetic identity and local records, and never reads the signed-in user's journal. Destructive confirmations were inspected, not submitted. The fixture can show savings and challenge popups without recording a trade or cash movement; celebration sound is disabled only in that fixture.

## Final results

| Phase | Commit | Tests passed |
| --- | --- | ---: |
| 1 — checker and frame | 06b7923 | 314 |
| 2 — daily use | 844d71a | 315 |
| 3 — logging | 1586eac | 316 |
| 4 — lists | 9ac6f9b | 319 |
| 5 — analysis | 67d9e0a | 320 |
| 6 — settings and popups | this commit | 322 |

Builds passed before each phase commit. `final.json` records 378 unique route/width/theme/accent checks, all with zero findings: 72 checks across all 12 routes, plus the additional accent cases. Dashboard, Calendar and Trade Logs account for 324 checks across 360/390/430px, dark/light and all 18 accent choices including Default.

`phase-2.json` through `phase-6.json` contain the page and interaction measurements. The phase 4 and 6 history files retain findings discovered during implementation; the corresponding final files keep the latest recheck for each state. Both final state reports have zero findings. Disabled controls, disclosure summaries and radio options are included in the final checker, with 0.1px tolerance for 44px targets. The compact phone Review month strip is an accessible status readout; full-width monthly cards keep the review actions and desktop retains its month buttons.

The CLI checker was attempted again after the final changes and exited 2 because macOS blocked Chromium startup. It is not reported as passing. The saved measurements use the app browser and the same exported audit function.

## Desktop comparison and preservation

The paired dark and light Dashboard screenshots are each 1440×900. Pixel comparison after JPEG decoding reported **zero changed pixels in both pairs**. Baseline rendering omits the new shared mobile refinement sheet. All feature layout refinements are phone scoped, and desktop conditional markup is retained. The fixture preloads fonts, fixes the quote and disables entrance animations in both renders so session randomness and transient paint do not distort the comparison. This fixture-only stabilization is not loaded by the production entry point.

The original checkout remains on `shell-scroll-avatar` at `6d8522b`, with all 90 uncommitted files unchanged. All 340 source-file SHA-256 hashes recorded before work still match. No original file was reset, deleted or staged. The `mobile-frame` checkout lives separately at `/Users/new/.codex/worktrees/aaicorefx-mobile-frame`; localhost:5173 was not replaced or redeployed.

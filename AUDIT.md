# App audit — 2026-10-08

## Corrected

- Numeric-string P&L is added numerically; malformed results are excluded.
- Same-day statistics use trade time and a stable ID tie breaker.
- Profit factor is unlimited when gains exist without losses, not a fabricated 3.
- Empty statistics no longer manufacture recovery or a positive core score.
- Trade Log average R uses recorded R values rather than the cash win/loss ratio.
- Open trades no longer dilute average closed-trade results or match outcome filters.
- Largest-loss cards do not show winning trades; empty analytics extremes do not show infinity.
- Added missing built-in page translations for all 13 non-English languages and coverage tests.
- Preserved the AAICOREFX brand in translated pages.
- Added the missing rule-progress chart animation hook.
- Cross-tab theme changes use the actual new preference.
- Malformed backtest rows cannot corrupt simulated equity.

## Verification

- 116 automated tests passed, including journal math, backtesting, challenge progression, data isolation, cache/media safety, localization, timing, and reduced-motion behavior.
- Production build passed; all 18 landing screenshot assets validated.
- All 12 main navigation destinations opened without captured browser errors.
- Landing anchor targets and loaded images checked; no broken targets found.
- German and Arabic page translations checked in-browser; Arabic RTL and cross-tab language propagation verified.
- Light/dark switching and cross-tab theme propagation verified.
- Account, Profile, and Trade Log modal sizing checked at desktop width.
- Journal and landing page had no document-level overflow at 390px mobile width.
- Trade composer inspected without saving a record; all forms closed after checks.

## Limits

- This is not a guarantee that every possible account/data combination is defect-free.
- Destructive account actions, password changes, OAuth, and real record mutations were not exercised against the user's live data.
- New translations were checked for catalog coverage, not professionally reviewed in every language.
- The production build still warns about a large initial JavaScript bundle (~1.93 MB before gzip); deeper code splitting remains a performance improvement.

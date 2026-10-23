# Shared tournament minigame tab — 2026-10-22

- Mini game now shares the tournament navigation with Players, Bracket and Standings. Existing status-based default tabs and bracket/standings visibility are preserved.
- Removed the separate Enter/Close game controls. Leaving the game tab unmounts its arena; entering it unmounts the decorative playground. Existing effect cleanup releases resources and tournament subscriptions when their sections are inactive.
- Decorative tops use the same compact setting as Home: 46-unit model sizing, 88px dock, no drag instructions.
- Model attribution and source/license links appear only in the page footer, including when viewing the bracket or minigame. Other standalone arena pages retain their own attribution.

## Verification

- Isolated production build passed (includes TypeScript).
- `node scripts/testing/run-migration-e2e.mjs --production shared-tabs.spec.ts`: **6/6 passed, 51.9 seconds**. STARTED and COMPLETED states on desktop, mobile and iPad-sized Chromium; switches through all available tabs, loads game assets, returns to tournament sections, checks compact height, footer-only attribution, missing obsolete buttons, horizontal overflow and browser runtime errors.
- Reviewed mobile compact/game screenshots under `test-results/migration/`.
- Targeted lint retains existing `PublicTournamentView` explicit-any errors and two pre-existing effect-dependency warnings. With the existing explicit-any rule debt excluded, targeted lint has zero errors. Whitespace checks passed.
- Tests mock public tournament reads and use the isolated local E2E runtime; no production data writes. Not deployed or pushed.

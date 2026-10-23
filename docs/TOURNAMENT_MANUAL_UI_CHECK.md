# Tournament history fix and pending manual verification — 2026-10-22

## Local fixes

- History clock popover uses viewport coordinates, not viewport coordinates plus document scroll. Horizontal position is clamped for narrow screens; height is limited to the available viewport.
- History popover sits above the sticky admin navigation rather than underneath it.
- Opening a result edit closes the history popover.
- Removed a duplicated generic modal bound to the same state. The remaining modal renders custom winner choices and preserves existing confirmation-label fallback.
- User confirmed the history popup now appears. This is not confirmation of an end-to-end tournament run.
- `tsc --noEmit --incremental false`: exit 0. `git diff --check`: exit 0.

## Completed manual UI run — 2026-10-23

Browser control became available. The original localhost app was stopped, so a separate local dev runtime was started on port 3333 with explicit overrides pointing only to `beyx_motion_e2e` on loopback port 55435. A synthetic organizer was prepared in that disposable database. No production credentials or real organizer account were needed. All tournament creation, registration, generation, winner selection/correction, arena selection, calling, sharing and finishing were performed with visible browser UI controls, not an API/SQL tournament driver or a Playwright test suite.

| Journey | Result |
| --- | --- |
| SINGLE, 14 players | All 13 matches played, CLOSED status persisted; champion S Player 01 (3 W / 0 L), runner-up S Player 02 (2 W / 1 L). Public standings list all 14 players. |
| DOUBLE, 14 players | All 27 matches played including Grand Final and Reset Final; CLOSED status persisted. Champion D Player 08 (7 W / 1 L), runner-up D Player 01 (3 W / 2 L); all 14 players placed. History shows 27 editable results. |
| History correction | First match initially awarded to Player 08 then changed to Player 09 before dependent matches. SINGLE next-round entrant changed; DOUBLE next-round winner and loser destinations both changed correctly. |
| Announcements | Enabled voice, used test phrase, selected arena 1, triggered real match call and repeated call. User explicitly confirmed hearing clear audio. |
| Sharing | Copied public links through UI, opened them, observed live result changes including Double Reset Final, then reloaded after closure and inspected standings and W/L. No social post was published. |

Additional fixes made during direct UI testing:

- Closing modal overlays immediately stop receiving pointer events during their fade-out, preventing fast follow-up clicks from being swallowed.
- Added accessible names to compact History and refresh buttons; History exposes expanded state. Verified clock popup and winner chooser on a narrow viewport.
- Completed tournaments no longer tell the organizer to finish them again; the empty-match message points to final public standings. Verified after reloading the finished Double admin page.
- The temporary manual-build directory is ignored. Initial Tailwind errors came from scanning its own generated output; switched to the already excluded `.next-e2e` output and resumed the same saved tournament. Those development-build errors are resolved, not misreported as a clean initial run.

Final `tsc --noEmit --incremental false` and `git diff --check`: exit 0. Screenshots: `test-results/manual-ui-20261023/single-final.jpg`, `double-final.jpg`, `history-mobile.jpg`.

Known cosmetic observation: active Reset Final was labelled with internal play order `MATCH 10003`; bracket view correctly labels it Reset and the result/rankings are correct. This numbering was not changed in this task. This is one manual path per bracket type, not exhaustive proof of every correction timing, concurrent-judge condition or physical device.

No production deployment, push or production data mutation. The local test app/database and synthetic finished tournaments are retained for inspection; no test-data deletion was performed. Normal `.env.local` settings were not rewritten, so a separate future dev launch may still point at GCP unless explicitly overridden.

## Earlier access blocker (resolved)

Before 2026-10-23, browser access returned `Local browser use is disabled in Work settings`. No substitute API/simulated tournament test was claimed as the requested manual run.

The manual checklist used for this run:

1. Create INTERNAL tournament from the dashboard; enter 14 synthetic players using the UI.
2. Choose bracket type, generate bracket, verify all players/byes and open shared bracket.
3. Enable call audio with a user gesture; trigger a call and check player/arena labels. Actual audible output must be verified, not inferred from a successful click.
4. Submit results through match UI; use history clock to change a winner before dependent matches are played; verify downstream participant changes and shared bracket updates.
5. Continue all real matches through the UI to the final. For DOUBLE cover loser progression and grand-final reset where supported.
6. Share/copy the bracket link via UI and open the resulting URL; verify participant names and results, not just HTTP success. Do not publish test data to social media.
7. End tournament through confirmation UI; inspect admin and public final standings, champion, placement, then reload to verify persistence.
8. Record match counts, result corrections, console-visible errors and screenshots. Do not claim passed until each journey is actually executed.

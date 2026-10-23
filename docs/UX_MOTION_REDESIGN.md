# BeyX motion redesign

## Scope

Implemented from the user's local `BEYX SYSTEM.html` POC as progressive enhancement of the existing application, not its simulated authentication, placeholder QR code, or demo tournament logic.

- GSAP 3.15, installed locally and dynamically imported after hydration; CSS handles hover, touch feedback, focus rings and decorative surfaces.
- Replaced the global AOS initializer/dependency. Server-rendered content starts visible: blocked JavaScript or a failed animation import cannot leave a page invisible.
- Home: responsive editorial hero, dark green arena grid, real draggable 3D models and four real navigation cards. One column on small screens, two from the tablet breakpoint.
- Opt-in entrance animation on safe headings, tournament/event cards and registration sections; localized pointer spotlight only on fine/hover pointers.
- Existing forms, tournament algorithms, scoring, sessions, storage and API contracts retained. No magnetic controls, scroll hijacking, delay before navigation, or animation on bracket coordinates/page containers.
- Runtime `prefers-reduced-motion` changes revert the GSAP context. Observers, listeners and pending animation frames are cleaned up on route changes/unmount.
- Login labels now explicitly associate with inputs and use correct autocomplete. Keyboard navigation has visible focus outlines.
- Events calendar is created after hydration to avoid server/browser date/locale mismatches. Month navigation resets the date to 1 before changing the month, so January 31 does not skip February. Arrow controls have accessible names.
- Match-management actions stack until the wide-desktop breakpoint and wrap instead of clipping into a hidden horizontal strip. The iPad audit found the music control obscured in the original medium-width toolbar; the regression audit now performs a no-side-effect trial click on that control as well.

## Verification design

Tests use a dedicated local PostgreSQL 18 container `beyx-motion-e2e-20261022`, bound to `127.0.0.1:55435`, with database `beyx_motion_e2e`. Only schema was restored; test fixtures generate their own accounts/players. No live GCP, Neon, storage or tournament-provider credentials are used.

The production-build runner (`--production`) starts Next on loopback and fronts it with temporary localhost TLS. This tests actual Secure cookies without weakening application cookie flags. Self-signed-certificate bypass is restricted to the exact test origin `https://127.0.0.1:3346`; the certificate is not installed in the OS trust store. OpenSSL generates a 2-day certificate in ignored `test-results/`. Trace/screenshots are retained; video is disabled to avoid unnecessary software-WebGL recording overhead.

`motion-ui.spec.ts` inventories these 17 page routes in desktop, Pixel 7 and iPad-sized Chromium emulation:

| Pages | Coverage |
| --- | --- |
| Home, login, password migration | Visibility, layout, navigation, real test-account login |
| Events, rankings | Layout, loading, calendar navigation/locale regression |
| Scoreboard, minigame | Layout plus existing scoring/correction and game-control journeys |
| Registration, shared tournament | Fixture-backed pages, normal/limited registration tests, game open/close |
| Admin dashboard, tournament detail | Correct organizer identity, real fixture data, scoring/lock/progression regression |
| Users, create user, global catalog, player merge | Superadmin identity, layout plus existing permission/CRUD tests |
| Organizer catalog, password reset | Organizer identity and layout; existing persistence/password tests |

The inventory checks document horizontal overflow, settled/visible motion targets, visible enabled controls not obscured by another layer, page exceptions and per-page screenshots/control lists. Closed disclosure contents and non-rendered controls are not incorrectly treated as visible buttons.

Public UI tests additionally cover disabled JavaScript, persisted language, drag/collision, keyboard use, reduced motion, launch/pause/reset and scoreboard correction. No claim is made that every destructive button is clicked indiscriminately: mutation journeys run only against isolated fixtures.

## Local commands

Start the already-initialized test container with `docker start beyx-motion-e2e-20261022`. For initial provisioning, `prepare-local-motion-db.mjs` accepts only that labeled empty test container and a dump copied to `/tmp/schema-source.dump`; it restores schema only and verifies that zero real users were imported. Never substitute a production container.

```powershell
$env:E2E_DATABASE_URL='postgresql://beyx_motion_test@127.0.0.1:55435/beyx_motion_e2e'
$env:E2E_DATABASE_NAME='beyx_motion_e2e'
$env:E2E_ALLOW_WRITES='1'
$env:E2E_DATABASE_SSL='disable'
node scripts/testing/run-migration-e2e.mjs --production
node scripts/testing/motion-contact-sheet.mjs
```

Reports: ignored `test-results/migration-results.json`, `playwright-report/migration`, screenshots/control inventories under `test-results/migration`. The server/proxy is torn down by the runner. Stop the dedicated database container after verification; do not stop unrelated project containers.

## Limits and release boundary

- Emulation is not a physical-device/Safari certification. A browser/device matrix and production-like traffic checks are distinct from this UI change.
- Animation is client-side, but real devices can have different GPU performance, extensions and assistive settings. Passing automation cannot prove absence of all possible bugs.
- npm reported 26 existing dependency advisories both before and after the library swap; no broad dependency upgrade or `audit fix --force` is part of this UI task.
- No production deployment, traffic switch, database migration or external Git push is included in this redesign task.

## Run results

Verified locally on 2026-10-22:

- Production build: passed. Final focused UI run: **24 passed, zero skipped, 8.2 minutes** across desktop, mobile and iPad-sized Chromium.
- Broad regression: all **80 backend/integration cases passed**. That raw run also recorded three UI-inventory failures and seven unexecuted UI cases; it is preserved as a failed run, not relabeled successful. The final post-fix UI run supersedes only matching UI cases.
- Latest result per exact case: **104/104 passed**, zero failed/not-run, as recorded by `summarize-motion-verification.mjs` in `test-results/motion-verification-summary.json`. This is combined evidence from the broad regression and focused rerun, not a claim of one uninterrupted green run.
- Standalone regression: **85/85 passed** across bracket invariants, game/playground, report comparison, sessions, gateway and realtime lifecycle. A concurrent attempt hit a CPU watchdog under software-WebGL load; the sequential rerun passed without relaxing timeouts.
- Visually reviewed **51 screenshots**: 17 routes × three viewports, including the corrected tablet tournament toolbar. Contact sheets are in `test-results/migration/motion-{desktop,mobile,ipad}-contact.png`.
- TypeScript, targeted lint and Git whitespace checks passed. Whole-repository lint debt is outside this task.

Initial failed runs helped identify the real calendar hydration/month-navigation issue and tablet toolbar clipping, alongside local HTTPS/visibility-test harness issues. No production system or real tournament data was changed.

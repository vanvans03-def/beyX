# UX/UI second pass — 2026-10-22

## Changes

- Homepage: Bey models render at 46 px instead of 72 px; dock height 88 px instead of 170 px; reduced hero/menu spacing and mobile card padding. Drag guidance is removed on home, and attribution/license/source links are retained in the footer. Pause/reset and keyboard dragging remain available.
- GSAP: homepage and opt-in auth elements use a context-owned timeline, 32 px entrance, 0.8 second `power3.out` easing and 90 ms stagger. Existing viewport reveals use 22 px / 0.65 second easing. Newly inserted inline form feedback animates for 0.25 seconds. No fake loading overlay or delay on navigation.
- Runtime reduced-motion changes revert the context; SSR stays readable before JavaScript, and observers/listeners/timelines clean up on route changes.
- Home is a static server-rendered shell (no server database reads). A JS-disabled test exposed the global loading boundary obscuring navigation behind a streamed suspense segment even in static output. Removed the global full-screen overlay; the admin subtree has its own accessible skeleton instead. Public HTML no longer depends on JavaScript to remove a blocking loading screen, while the interactive models still load progressively in the browser.
- Login: mobile starts near the top rather than vertically centering a tall scattered layout; quieter background, tighter icon/heading/form hierarchy, real password visibility toggle, input autocomplete/capitalization settings, accessible inline errors, invalid-input association, failure focus and duplicate-submit guard.
- Auth/form entrances retain full opacity throughout their slide/stagger. Inspection of the iPad screenshots caught a mid-fade frame that looked like missing fields; inputs should never depend on a decorative fade to become readable. Home's decorative sequence still fades/staggers as requested.
- Create-user form: top alignment and narrower padding on phones. User accounts table: keyboard-focusable horizontal scroll region with an accessible name. Change-password back control: accessible name. Password-migration page: top aligned on phones. Standard mobile forms use 16 px inputs to avoid iOS focus zoom.
- Bracket coordinates, match/scoring controls, form business logic and authentication APIs are not replaced. Animations are opt-in: do not animate wrappers containing fixed dialogs or bracket coordinate systems.

## Complete page inventory

All 17 current `src/app/**/page.tsx` routes are represented in the responsive audit. Dynamic routes use uniquely tagged synthetic fixtures in the task-owned local database, not GCP production.

| Public | Organizer / superadmin |
| --- | --- |
| Home `/` | Dashboard `/admin` |
| Login `/login` | Tournament `/admin/tournament/[id]` |
| Password migration `/migrate-password` | Accounts `/admin/users` |
| Events `/events` | Create account `/admin/users/create` |
| Rankings `/rankings` | Global catalog `/admin/beyblades` |
| Scoreboard `/score-board` | Player merge `/admin/players` |
| Minigame `/minigame` | Organizer catalog `/admin/profile/beyblades` |
| Registration `/register/[id]` | Change password `/admin/reset-password` |
| Shared tournament `/[shopName]/[id]` | |

## Verification

The `motion-ui` inventory checks loaded fixture-backed views, viewport overflow, visible enabled controls hit-testing, settled animation, real fixture login, keyboard navigation, shared-game open/close, runtime errors and screenshots for each route in desktop, Pixel 7 and iPad-sized Chromium.

`home-compact` additionally observes actual animation style updates, checks raised mobile menus, compact dock height, footer-only credits and runtime motion preference changes. `login-ux` intercepts only the failed-login response to check visibility toggle, inline error recovery and disabled pending submit; the inventory separately tests successful login against real isolated fixtures. `public-ui` covers JS-disabled rendering, collisions, drag, pause/reset, language, scoring and minigame controls.

This is not a claim that every destructive button is clicked indiscriminately or that Chromium emulation certifies physical iPad Safari. No mutation/load tests run against the GCP-connected development server. Production deployment is not included.

## Results

- Final production-build page audit: **6/6 passed in 4.1 minutes**, comprising all 17 pages on each of three viewports plus three JS-disabled journeys after removal of the global loading overlay.
- Compact-home timeline/layout/reduced-motion and login error/visibility/pending-submit journeys: **9/9 passed** in the focused run. The successful fixture login is additionally exercised by all three complete-page audits.
- Final auth visibility follow-up: **3/3 passed in 25.2 seconds** on another successful production build after preserving full opacity for auth entrances. Screenshots explicitly wait for actual GSAP transforms to settle; the iPad form remains readable throughout its animation. Raw report: `test-results/ux-second-pass-auth-final.json`.
- Latest result per exact case across preserved runs: **33/33 passed**, zero unexecuted. This is combined evidence, not one uninterrupted green run. `summarize-ux-second-pass.mjs` writes `test-results/ux-second-pass-summary.json` and preserves each source report.
- The initial 33-case run had 27 passes and six failures (three global-loading/JS-disabled failures, three overly broad alert locators); the next focused run fixed the alert checks but confirmed static generation alone did not remove the loading boundary. The final six-case run verifies the actual boundary fix and re-audits every page.
- Production build/type checking, standalone TypeScript, targeted ESLint and whitespace checks passed. The playground physics regression also passed, including 500 rapid pinned-contact checks.
- Reviewed desktop/mobile/iPad contact sheets covering **51 page screenshots**, preserved as `test-results/ux-second-pass-{desktop,mobile,ipad}.png`. The subsequent auth visibility fix has three additional settled screenshots in `test-results/ux-login-*.png`; compact-home views are `test-results/ux-home-*.png`. Browser emulation and partial viewports are not exhaustive physical-device certification.
- Task-owned local test server/proxy and PostgreSQL container stopped after verification. The user's GCP-connected local development server and its private tunnel remain running; no production application data was changed by these tests.

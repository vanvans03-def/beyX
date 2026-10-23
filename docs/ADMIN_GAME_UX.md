# Admin navigation and directional dash — 2026-10-22

## Dashboard

- Collapsed-by-default top card: click/tap the dashboard title to reveal organizer identity, Tournaments/Events navigation and Account tools. Native disclosure supports keyboard activation. Desktop uses a two-column toolbar inside the open card; mobile wraps predictably.
- Shop/email/Challonge key/password settings are in an expandable Account & integrations section instead of dominating the header. Existing editing handlers and permissions remain.
- Compact creation panel: full-width name, less padding and spacing. Rules/system controls occupy separate full-width rows on phones so option names are not clipped; wider screens retain two columns. Labels are associated with inputs.
- Default provider is INTERNAL for eligible accounts. An account explicitly denied internal brackets falls back to CHALLONGE and cannot select the disabled INTERNAL option. No server authorization checks are bypassed. No existing tournament provider is changed.

## Game tuning

- Stamina remains a 0–100% meter. Passive drain drops from 1.6 to **0.8 per second**; movement drain drops from 0.035 to **0.02 × speed per second**. Normal collision costs drop from 2.5/3 to **1.8/2.1**. Launch timing still matters; charged dash damage remains unchanged.
- A normal rail entry costs **3 stamina**, plus **4 per second** while riding. These effort costs apply to both player and bot, but are waived for the player's active charged special. Passive drain still applies. Repeated ordinary rail rides therefore spend stamina even without using the special.
- During rail approach/ride, a drag commits its latest intentional direction in arena coordinates. Small movements accumulate to a 0.12-world-unit threshold. Releasing a drag keeps that direction until the current exit. Keyboard directions also work while on the rail. No direction preserves the existing inward straight dash.
- Direction is normalized, consumed at the single dash gate and cannot home/change mid-flight. Special/reset/finish clear stale direction; cancelling a pointer gesture or blurring also clears it. Choosing a direction does not guarantee a hit or free special.
- Outward-directed dashes rebound at the wall rather than leaving the arena. Actual charged knockback is still required for pocket finishes.

Tests use only the task-owned isolated local database. Game tests cover both player selections, normal/powered rides, six directions, no-input fallback, keyboard aim, direction consumption, non-homing, outward rebounds, passive endurance, repeated entry costs and special exemption. Browser tests cover grouped menu, settings disclosure, compact creation, persisted INTERNAL provider, disabled permissions and pointer/keyboard game controls on three viewport sizes. No production deployment or GCP data writes are part of this task.

## Verification results

- Collapsed-menu/mobile-field follow-up: production build and **6/6 browser checks passed in 1.5 minutes**, covering default-closed disclosure, open/close navigation, separate full-width phone selects, creation of an INTERNAL tournament and disabled feature permissions across three viewport sizes. Report: `test-results/admin-collapse-results.json`.

- Initial browser run: **12/12 passed in 3.0 minutes** across desktop, mobile and iPad-sized Chromium. Includes actual form creation and persisted provider checks in the isolated fixture database, disabled internal permissions, Events/Tournaments navigation, settings disclosure and game controls.
- Final build after adding outward-dash wall rebound: successful; minigame browser journeys rerun **3/3 passed in 1.6 minutes**. This reruns three of the original cases, not 15 unique cases. Raw reports: `test-results/admin-game-ux-initial.json` and `test-results/admin-game-ux-final.json`.
- Both game logic regression files pass, including 24 directional exits and outward-wall checks. TypeScript, targeted lint and whitespace checks pass; whole-project lint debt is not addressed here.
- Visually reviewed the three dashboard screenshots: `test-results/admin-game-{desktop,mobile,ipad}.png`. Mobile creation panel is under 335 px tall in the fixture. Chromium emulation is not physical-device Safari certification.
- Task-owned test database/server/proxy are stopped after verification; the user's local GCP tunnel/development server remain available.

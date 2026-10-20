# BeyX repeatable E2E / PostgreSQL migration checks

This suite is an on-demand test runner, not a scheduled automation. Tests live in
`tests/migration/`, not in `scratch/`. It exercises real HTTP handlers and the real
test database. Browser journeys use Playwright on desktop Chromium and Pixel 7.
There is no claim of 100% functional coverage or of successful migration until the
database-backed and provider-backed suites have actually run.

## Commands

```sh
npm ci
npx playwright install chromium
npm run test:e2e:list
npm run test:e2e:ui
npm run test:brackets
npm run test:e2e:migration
npm run test:e2e:challonge
npm run test:e2e:report
```

The repository also includes `.github/workflows/migration-e2e.yml`, manually
dispatched with `ui`, `migration` or `challonge`. Configure the `e2e` GitHub
environment's test-only secrets/variables using the same E2E names as below.
The workflow uploads reports for seven days and still fails if bracket invariants
fail. It has no automatic schedule and has not been published or triggered here.

`test:e2e:ui` owns a local Next.js server, has no database credentials, and tests
homepage/playground controls, minigame launch/control/reset, language, login page,
scoreboard and reduced motion. The first compilation may take longer on Windows.
`test:brackets` runs 70 algorithm scenarios without network/database access:
SINGLE/DOUBLE, counts 2–64, favorites/upsets and forced reset. It checks match
counts, loss limits and deadlocks. **These are invariants, not Challonge oracles.**

## Real database setup

Copy `.env.e2e.example` to `.env.e2e` and fill in an **isolated, migrated**
PostgreSQL database. This runner intentionally does not provision databases or
apply production migrations. Use your actual application schema including views,
RPCs, triggers and the `db/migrations/002_realtime_notify.sql` notification trigger.
Using a hand-written replacement schema would hide migration incompatibilities.
The database's name must contain `test`, `e2e` or `rehearsal`, and match both the
URL and `SELECT current_database()`. `E2E_ALLOW_WRITES=1` is required.

The runner starts an owned server on `127.0.0.1:3345` with `DATA_BACKEND=postgres`,
local auth, PostgreSQL realtime, random session signing secret, Redis disabled and
a separate `.next-e2e` build directory. It refuses an occupied port. It never uses
`TEST_SESSION_COOKIE` or production accounts. Each fixture creates fresh organizer,
superadmin and outsider accounts and logs in through `/api/auth/login`. Tests fail
instead of silently skipping missing database fixtures.

App secrets from ordinary `.env` files are not used as test database credentials.
The wrapper clears active Supabase/Google/AWS/blob credentials and database URLs
before spawning UI-only tests. Run in a clean CI environment for stronger isolation
from unrelated service integrations and local environment configuration.

Every test cleans only its own unique namespace and UUID-owned records, never
TRUNCATE. A process crash can leave tagged `e2e…` fixture rows, so a disposable
database remains required. Cleanup failures are reported as failures. Artifacts
contain fixture credentials and account state: keep `test-results/` and
`playwright-report/` private and git-ignored.

```powershell
# Run a focused journey against the isolated database:
node scripts/testing/run-migration-e2e.mjs registration.spec.ts --project=desktop
node scripts/testing/run-migration-e2e.mjs administration.spec.ts --project=desktop
node scripts/testing/run-migration-e2e.mjs tournaments.spec.ts --grep "DOUBLE 8"
```

Direct Node invocation preserves Playwright flags on Windows npm/PowerShell
combinations that otherwise consume named arguments.

## What is automated

| Feature | Tests / assertions |
| --- | --- |
| Homepage | Real GLBs load; drag/keyboard; collisions; pause/reset; language persists; menu links; responsive width |
| Mini game | Selection; countdown/shoot; pause/resume; battle and reset controls; original GLB assets |
| Scoreboard | Spin, Burst, Over, Xtreme, correction confirmation |
| Accounts | Login via UI/API, wrong password, case-insensitive username, logout, own-password change, superadmin create/reset user |
| Superadmin | Management pages, role propagation, feature flags, ordinary-user write restrictions |
| Registration | Browser name/deck selection/submit and API persistence/update for Open/U10/U10Custom/NMM; duplicate parts; bans; points limit; custom overrides; late registration/device ownership |
| Tournament lifecycle | Create, bulk entrants, duplicate/rename/delete entrant, saved order, generation, arena locks, concurrent writes, close, ranking awards, retry idempotence, reset |
| Brackets via persisted APIs | SINGLE/DOUBLE 2,3,4,5,8,9,16; BYEs; reset/no reset; full progression; match counts; loss limits; winner; correction of completed result |
| Shared pages | Shared URL, registration/matches/standings APIs; completed display; unknown tournament |
| Rankings | Merge from browser; aggregate points; preserved history; rename/split; organizer approval; exclusions; public rankings, badges, suggestions/history readers |
| Realtime | Actual score mutation -> PostgreSQL NOTIFY -> public browser SSE delta |
| Authorization | Anonymous/forged-header matrix; cross-organizer read/write/generate/reset/score cases; password/settings mutation restrictions |
| Provider validation | Unsafe image proxy requests; empty TTS/upload; invalid OAuth callback; disabled OAuth redirect; missing password-migration input; OG PNG generation |

Most persisted transitions are driven through HTTP APIs and asserted in the DB;
selected journeys also operate the actual browser controls. This is not a claim
that every control on every page has a separate browser click test.

## Compare with real Challonge

Use a dedicated Challonge test account and fill `E2E_CHALLONGE_USERNAME` and
`E2E_CHALLONGE_API_KEY`. `npm run test:e2e:challonge` is an explicit opt-in that
creates **new private remote tournaments**, bulk-adds synthetic players, starts,
scores, finalizes and deletes only those newly created tournament IDs. It does not
reuse existing remote tournaments. Do not use a production organizer account.
The API key is supplied in an authorization header, not query strings or artifacts.

The default matrix is SINGLE + DOUBLE (normal and forced reset), 3,4,5,8,9,16
entrants: 18 remote comparisons. Configure sizes between 2 and 64. Each step
compares the **set of playable named pairs** against the local persisted API,
submits the same winner to both systems, then checks champion, runner-up, top-four
membership and reset behavior. Tied single-elimination semifinal placements are
compared as sets. It deliberately does not pretend sequential local podium award
positions are identical to Challonge's tied rank 3.

`challonge-comparison.json` is attached even when a comparison fails; it contains
the local/remote match snapshots at each step. The remote ID is retained in that
artifact if remote cleanup fails, so it can be removed from the test account.
Rate limiting, unavailable API credentials or non-2xx responses cause a failure;
they do not turn into a successful mocked comparison.

The oracle uses the legacy v1 API to match the application's existing integration.
Challonge now marks v1 deprecated; provider availability/quotas remain prerequisites,
and a provider rejection fails the run. Reference:
https://challonge.apidog.io/create-a-tournament-23824895e0

## Remaining coverage / configuration boundaries

Successful Google sign-in requires an interactive Google test account and provider
configuration; the default suite checks rejection/disabled paths only. Actual
S3/R2/blob upload/download, Google TTS audio playback, Share API delivery to another
application, real webhook delivery/signature behavior, QR scanning, invite-image
visual quality and live Challonge provider fallback need integration fixtures or
manual verification. The current default suite does not certify those behaviors.
The CX attachment write endpoint edits a repository JSON file; only its denial
path is exercised, to avoid modifying application source during tests. Legacy
schema migration endpoints should remain retired, not run as test setup.

Run `npm run test:e2e:inventory` to regenerate a method-by-method route inventory
with declared coverage and outstanding integrations. This inventory is a checklist,
not runtime code coverage. New/unmapped routes cause that command to fail so a new
feature cannot silently disappear from the testing checklist.

## Interpreting migration results

Run the same suite on a disposable source clone before migration, and a disposable
target clone afterward. Preserve the two HTML/JSON reports separately. Compare
schema-preflight failures, HTTP error bodies, assertion failures and realtime
behavior. A green UI-only or bracket-invariant run does not certify a migrated DB.
Save `test-results/migration-results.json` from each complete run, then execute:

```sh
npm run test:e2e:compare -- before.json after.json
```

This writes `test-results/migration-comparison.json`, separates existing/new
failures and fixes, and fails on skipped, flaky, missing or failing target tests.
Run `npm run test:e2e:tools` to verify the report comparison logic itself.
Existing product bugs remain visible as failures; tests are not marked xfail or
skipped to manufacture a green report.

Initial invariant execution found a real existing defect: DOUBLE with two entrants
throws while building a losers bracket (`loser_to_match_id` on undefined). All
three two-player DOUBLE policies fail; the other 67 invariant scenarios pass.
The test suite preserves this regression case rather than changing game logic as
part of a testing-only request. Database ownership/password/settings checks also
target potential gaps seen during source inspection; until run against the test
DB those are suspected issues, not verified E2E findings.

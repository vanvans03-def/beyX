# Automated functional and capacity testing

Use a staging deployment with production-like Supabase compute. Do not run the
high load levels against production during an active tournament.

## Configuration

Set these values in your shell or CI secret store:

```powershell
$env:TEST_BASE_URL="https://staging.example.com"
$env:TEST_BUCKET_PATH="/shop-name/short-id"
$env:TEST_BUCKET_TOURNAMENT_ID="uuid"
$env:TEST_TOURNAMENT_NMM_ID="uuid"
$env:TEST_TOURNAMENT_U10_ID="uuid"
$env:TEST_TOURNAMENT_U10CUSTOM_ID="uuid"
$env:TEST_ORGANIZER_TOURNAMENT_ID="uuid"
$env:TEST_SESSION_COOKIE="signed-session-cookie"
```

The tournament IDs should point to disposable staging tournaments. Tests are
read-only; the registration journeys validate the page, configuration, and
registered-player list without creating players.

## Commands

```powershell
npm run test:functional
npm run test:load
npm run test:realtime
npm run test:predeploy
```

`test:load` ramps each configured journey through `1,5,10,25,50,100`
concurrent users. A stage fails when error rate exceeds 1% or p95 exceeds 2
seconds. Customize with:

```powershell
$env:PERF_LEVELS="1,5,10,25,50,100,200"
$env:PERF_STAGE_SECONDS="30"
$env:PERF_P95_MS="2000"
$env:PERF_ERROR_RATE="0.01"
$env:PERF_SCENARIOS="organizer,bucket,registration_nmm,registration_u10,registration_u10custom,scoreboard"
$env:PERF_REPORT_PATH="performance-results/http-capacity.json"
```

HTTP capacity is written to `performance-results/http-capacity.json`. Realtime
connection capacity is written to `performance-results/realtime-capacity.json`.
The reported number is a measured lower bound when the highest configured level
passes; it is a bounded capacity only when the next level fails.

For reliable sizing, run at least 30 seconds per stage, repeat three times, and
use the lowest passing result. Watch Supabase CPU, memory, database connections,
IOPS, Realtime concurrent clients/events, and deployment function duration
during the run.

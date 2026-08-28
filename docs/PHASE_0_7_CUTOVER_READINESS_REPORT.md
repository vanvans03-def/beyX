# Phase 0–7 Cutover Readiness Report

Date: 2026-08-28

Branch: `feat/supabase-exit-migration`

Target: 1 vCPU / RAM 2 GB

| Phase | Status | Evidence |
|---|---|---|
| 0 Snapshot | PASS | production public-only read-only dump; temp credential removed |
| 1 PostgreSQL | PASS (local) | PostgreSQL 17.11 healthy, persistent volume, loopback port |
| 2 Data access | PASS (rehearsal) | parameterized PostgreSQL adapter; pool max 5 |
| 3 Auth | IMPLEMENTED | hardened local JWT; direct Google OAuth; live credential test pending |
| 4 Realtime | PASS (rehearsal) | trigger/NOTIFY/SSE test; one shared LISTEN connection/process |
| 5 Restore | PASS | dump restored into isolated database |
| 6 Reconcile | PASS | 14/14 tables match exact counts and content checksums |
| 7 Validation | PASS (accepted capacity) | actual 1 vCPU / 2 GB host passed smoke, 50 SSE clients, and HTTP through 25 concurrent registrations |
| 8 Cutover | NOT STARTED | separate maintenance authorization required |

## Evidence

- Source dump: 14 tables, 1,399,716 bytes; SHA-256 `b6c01ef218cfd3e320d3af5351495fb16e30c876b833da0a5dfe7510e15cdd9f`.
- Encrypted backup/restore drill and post-restore reconciliation passed.
- Six concurrent organizer sessions passed.
- PostgreSQL NOTIFY to browser SSE passed.
- Credential-free production build passed (33/33 static pages plus runtime database-backed routes).
- Docker Compose config validation passed.
- Actual-host smoke tests returned HTTP 200 for `/`, `/events`, `/rankings`, and `/api/public/rankings`.
- Actual-host SSE passed 50/50 clients with p95 connect time 785.3 ms.
- Actual-host scoreboard passed 50 concurrent users at p95 583 ms with 0% errors.
- Registration passed 25 concurrent users at p95 1,979 ms with 0% errors; 50 concurrent users failed the 2-second gate at p95 4,793.2 ms.
- No application or PostgreSQL OOM/restarts occurred during the measured tests.

## 1 vCPU / 2 GB profile

- App: 768 MB; Node heap 512 MB; DB pool max 5.
- PostgreSQL: 512 MB; max connections 20; shared buffers 128 MB; work_mem 2 MB.
- Redis: 128 MB; maxmemory 64 MB.
- Accepted operating envelope: approximately 20 simultaneous registration users, leaving margin below the measured 25-user boundary. A total audience of 250 is acceptable when registrations are staggered.
- Upgrade trigger: move to at least 2 vCPU / 4 GB before an event expected to exceed 20 simultaneous registrations, or if production p95 exceeds 2 seconds.

## Blockers before cutover

1. Configure off-host R2 backup and store the production encryption key safely. The drill used an ephemeral test key.
2. Test direct Google OAuth with production credentials and redirect URI.
3. Production cutover still requires a write freeze and final source-of-truth dump.

No production writes, deletions, key revocations, Supabase shutdown, or cutover were performed.

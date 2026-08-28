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
| 7 Validation | PARTIAL | build PASS; E2E PASS after isolated transient rerun; host load pending |
| 8 Cutover | NOT STARTED | separate maintenance authorization required |

## Evidence

- Source dump: 14 tables, 1,399,716 bytes; SHA-256 `b6c01ef218cfd3e320d3af5351495fb16e30c876b833da0a5dfe7510e15cdd9f`.
- Encrypted backup/restore drill and post-restore reconciliation passed.
- Six concurrent organizer sessions passed.
- PostgreSQL NOTIFY to browser SSE passed.
- Production build passed (34/34 static pages plus dynamic routes).
- Docker Compose config validation passed.

## 1 vCPU / 2 GB profile

- App: 768 MB; Node heap 512 MB; DB pool max 5.
- PostgreSQL: 512 MB; max connections 20; shared buffers 128 MB; work_mem 2 MB.
- Redis: 128 MB; maxmemory 64 MB.
- Upgrade recommendation: 2 vCPU / 4 GB if actual-host load fails thresholds.

## Blockers before cutover

1. Target server terminal is not attached to this Codex task; deployment rehearsal is pending.
2. Run HTTP/SSE capacity tests on the actual 1 vCPU / 2 GB host: p95 <= 2 s, errors <= 1%, no OOM/swap thrash.
3. Configure off-host R2 backup and store the production encryption key safely. The drill used an ephemeral test key.
4. Test direct Google OAuth with production credentials and redirect URI.
5. Production cutover still requires separate approval and a write freeze.

No production writes, deletions, key revocations, Supabase shutdown, or cutover were performed.

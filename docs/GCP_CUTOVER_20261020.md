# BeyX GCP production cutover

Production was verified on 2026-10-20 at 23:50 Asia/Bangkok. Post-cutover
verification and cleanup continued into 2026-10-21.

## Live system

- Website: https://beyx-system.com
- Project: `beyx-production-20261020` (`638873004771`).
- Web: Cloud Run `beyx-web`, `us-central1`, 1 vCPU / 1 GiB per instance,
  request-based CPU, minimum zero, maximum three instances per revision,
  concurrency 400, request timeout 3600 seconds. Service-level maximum six
  permits revision overlap. Ordinary database pool three, plus one LISTEN and
  one mutation-lock connection per instance; PostgreSQL maximum 40 connections.
- Data: `beyx-data-1`, e2-small / 2 GiB, `us-central1-a`, private `10.42.0.10`.
  PostgreSQL 18 and Redis 7. Public IP removed. SSH requires IAP. Database and
  Redis ingress is restricted to the Cloud Run subnet; neither is public.
- Runtime configuration: Secret Manager `beyx-runtime-production`, version 1.
  Existing production session signing secret and storage integrations preserved.
- Cloudflare gateway `beyx-gcp-gateway` routes apex and www to Cloud Run over
  HTTPS. Maintenance is off. workers.dev and preview URLs are disabled.
- Cloudflare Universal SSL was confirmed Active by the owner. Public TLS
  validation and HTTP-to-HTTPS redirect passed. Cloudflare manages edge renewals;
  Google manages the run.app origin certificate. No Certbot is needed on the VM.

Build: `ca35c293-c5a4-45bb-8610-9316f68893dc`.
Production image:
`us-central1-docker.pkg.dev/beyx-production-20261020/beyx/web@sha256:9428082b2cc12ddf2a24175dd8b9dc50873844402592a39573ff026ba5e4c722`.

## Final data transfer

The old Linode web container was stopped before the final Neon export. Dump and
inventory used one exported, read-only MVCC snapshot. The target was a NEW
database, `beyx_prod_20261020`; existing target databases are never overwritten
by the restore script. Restore used a single transaction and exit-on-error.

- All 14 table row counts and deterministic content checksums matched exactly.
- Preserved 10 users, 275 tournaments, 7,395 registrations, 2,909 players,
  5,594 internal matches, and all other source tables.
- Final dump: 1,660,805 bytes, SHA256
  `80228b2cc00845ebd87becdd4a8806e6f2a1d13c19871ef1d3399fd0ef4c2bc0`.
- Restricted local evidence: `backups/gcp/cutover-20261020-final/`.
- Private off-VM copy:
  `gs://beyx-production-20261020-backups/cutover-20261020-final/`.
- No synthetic capacity/E2E records were copied into production. Tests wrote
  only to the isolated rehearsal database. Production smoke checks were read-only.

## Verification

- Deployed rehearsal functional suite: **88 passed, zero skipped, zero flaky**.
  Covers authentication, roles/ownership, catalogs, all registration formats,
  rankings, SINGLE/DOUBLE progression and reset finals, concurrent judges, score
  correction, persisted results, public short links and realtime.
- Node logic/security/lifecycle regression checks: **85/85 passed**.
- Post-cutover public UI on the actual domain: **8/8 passed**, desktop/mobile,
  including homepage 3D models, minigame, language persistence and scoreboard.
- Forced SSE disconnect/reconnect on the actual deployed frontend: **2/2 passed**,
  desktop/mobile; reconnect triggers snapshot reconciliation.
- Production read-only smoke: home, rankings, minigame, restored session identity,
  administrator reads, registration config, public bracket, short-link identity,
  SSE ready, certificate validation and HTTP-to-HTTPS redirect all passed.
- Live external Challonge comparison and real storage-provider upload writes
  were not run. Existing credentials/configuration were preserved, not replaced.

### Capacity result

HTTP load jobs are not 300 simultaneous rendered browser processes. Real browser
journeys were tested separately. The load generator used 64 HTTP connections,
300 concurrent viewer jobs, and separate connections for 300 SSE clients.

| Scenario | Result | p95 |
|---|---|---|
| Registration page/config, 100 viewers | 100/100 | 2.36 s |
| 300 registrations, concurrency 25, three catalog blades / U10 | 300/300 | 398 ms |
| Public HTML + matches + standings, 300 simultaneous viewer jobs | 300/300 | 11.63 s |
| Initial SSE connections, 300 viewers | 300/300 | 1.94 s |
| Ten administrator pollers | 1,548 reads, zero errors | — |
| DOUBLE tournament | 598 played updates; all 1,023 bracket nodes complete | 220 s total |

Zero Unknown Player values. All 300 viewers caught up to the final played result.
There were **eight transient stream disconnects**; all eight reconnected and
reconciled successfully, with zero unrecovered realtime errors. This is not a
claim of uninterrupted connections. SSE lifetimes are bounded to five minutes
to prevent abandoned proxy connections occupying request slots indefinitely.

The 11.63-second simultaneous burst result is a remaining latency limitation,
not a sub-two-second guarantee. Evidence: `backups/gcp/capacity-final.json`,
`backups/gcp/migration-deployed-final-results.json`, and public UI/reconnect reports
under ignored `test-results/`. Failed earlier trials were retained separately.

## Backups and credentials

- Daily systemd timer: `beyx-backup.timer`, approximately **01:00–01:15 Bangkok**.
- Private bucket: `beyx-production-20261020-backups`, public access prevented,
  uniform bucket access. Data VM identity has object-creator access, not a static
  service-account key. Daily objects expire after 14 days; cutover objects do not
  match that lifecycle rule. Local copies remain; monitor disk usage.
- A backup downloaded from GCS was hash-checked, restored into the uniquely named
  disposable drill database, and validated for tables, view and merge RPC.
  `BACKUP_RESTORE_DRILL_PASS`; only the disposable drill DB was removed afterward.
- After removing the VM public IP, a fresh production backup uploaded successfully
  via Private Google Access:
  `daily/beyx_prod_20261020-20261020T165530Z.dump`, SHA256
  `2ebe4faf9107bf235ac89bd8c9ef0e0bf937e338dfe197f728edb5d62d22f019`.
- Temporary local runtime/password/test-env files were removed. Operating VM
  credentials remain root-only in `/opt/beyx/.env.gcp-data`; production runtime
  remains in Secret Manager. Do not print or commit either.
- The public rehearsal Cloud Run service and its temporary runtime secret were
  removed. Its database remains private and is not serving web traffic.
- Bootstrap helpers are migration tools, not routine redeploy commands. If their
  local credential file is absent, recover the current VM configuration first.
  `--new-vm` is ONLY for a fresh empty VM, never an existing database volume.

## Recovery and follow-up

- Linode `beyx-app` is stopped, with restart policy disabled. Its image/config and
  the old Neon database remain available. They have NOT been deleted. Linode
  continues to incur its own charges until deliberately decommissioned.
- New production can now accept writes. **Do not start the old app or route traffic
  back to the old Neon database without quiescing and reconciling new writes.**
  An application-image rollback using the SAME GCP database is different from a
  database rollback.
- The existing proxied DNS still provides the rollback origin; Workers routes
  intercept production traffic. Review/update DNS before eventually releasing
  the old Linode IP. Do not disable the production Worker route casually.
- Minimum Cloud Run instances remain zero. Database VM size is fixed; it does not
  autoscale with the web. Future apt/image downloads need a deliberate temporary
  egress method; no always-on Cloud NAT was added.
- Budget alert: 335 THB/month for this project, before credits, at 50/90/100%.
  Alerts do NOT cap charges. Credits, free allowances and Cloudflare plan quotas
  require ongoing review; this architecture is not guaranteed to cost zero.
- Local original `.env` was intentionally preserved and may still point to old
  Neon. Use an isolated development DB; do not redirect local development writes
  to the new production database.

The production gateway config is `deploy/cloudflare/wrangler.production.jsonc`.
The rehearsal gateway config uses a DIFFERENT Worker name to prevent a future
staging deployment replacing production routing. Do not rerun the production
restore script against the live database; its existing-target guard is intentional.

The local manual GitHub Actions workflow was kept out of the main publication:
the current GitHub OAuth credential lacks `workflow` scope. Application source,
test scripts and deployment files can be pushed without extending that credential.
The workflow file remains in the working directory and the local migration
checkpoint branch; enabling/publishing it requires separately authorized access.

# BeyX GCP migration

Production cutover is complete. See [the final cutover report](GCP_CUTOVER_20261020.md)
for verified production status, tests, backups and recovery restrictions.

## Historical rehearsal checkpoints (superseded by the cutover report)

- New project: `beyx-production-20261020`, project number `638873004771`, ACTIVE.
- Google Cloud CLI login succeeded. Console login alone was insufficient for CLI operations.
- Billing is enabled using the owner's newly opened billing account. AI Pro credit
  redemption has NOT been independently verified.
- Created `beyx-vpc`, data/run subnets, private data firewall and IAP SSH firewall,
  Artifact Registry `beyx`, a private build-source bucket and separate service accounts.
- `beyx-data-1` is RUNNING: e2-small, 2 GiB, us-central1-a, private IP 10.42.0.10.
  Temporary external IP remains attached for bootstrap/image downloads; remove after
  required images and maintenance/backup access are verified. Paid resources now exist.
- PostgreSQL and Redis are healthy. Restored `beyx_rehearsal` and verified exact
  counts/checksums for all 14 source tables against one exported MVCC snapshot.
- Source dump: `backups/gcp/rehearsal-2026-10-20T14-44-35-385Z`, 1,660,805 bytes,
  SHA256 `49271d5bf056fd834d0660524d4e1e4d74bd07e2f09a6b7d2ca5ce39c10eb254`.
- Candidate 1 Cloud Build succeeded: `39eedf87-3014-4380-8cf6-c9735a0dd179`.
  Image digest: `sha256:f20697892c499bd86356940ed557905b4b34812a4aad70376f0d021be749ae09`.
- Candidate 3 build `b68b6386-cc7b-4963-98e7-00b358455406` succeeded and is deployed
  to rehearsal, digest `sha256:8d9a4c1aaf45b53a130ba0082c5e0b80080315e7c04e682980ae1cdaa7b71f53`.
  Includes two-player DOUBLE, hydration, authorization and cross-instance advisory-lock fixes.
- Public staging URL: https://beyx-rehearsal-638873004771.us-central1.run.app
  Health, home, minigame, public rankings and both GLB downloads returned HTTP 200.
- The current working directory includes uncommitted product fixes, the 3D game,
  GLB assets, and the migration automation suite. Preserve these files together.
- Current production build passed, including TypeScript and all 34 static pages.
- Game logic checks passed. The combined Node test run has 74 passes and 3 failures:
  the existing two-player DOUBLE generator crashes while assigning losers feeders.
  The two-player DOUBLE generator has since been fixed; all 70 invariant scenarios
  pass after the fix. The fixed source is in candidate 2, not deployed candidate 1.
- First deployed UI suite: 6 passed / 2 failed (early language/score clicks).
  After hydration fixes, candidate 3 deployed UI tests pass 8/8, desktop and mobile.
- Full 88-test migration suite remains running at the latest checkpoint. Its
  partial results include existing authorization failures; owner checks and
  superadmin restrictions have been added locally and require fresh validation.
- Capacity report `performance-results/gcp-capacity.json` is FAILED: registration
  pages 100/100 (p95 2,984.7ms), registration writes 300/300 at concurrency 25
  (p95 418.2ms), public bracket loads 106/300, SSE 9/300. Tournament completion
  was not achieved. Do not cut over on this result. Diagnose app/DB/client/network
  behavior rather than assuming the VM or Cloud Run setting is the sole cause.
- Some synthetic capacity fixtures remain in the rehearsal database after an
  interrupted run; identify them by their generated account/tournament IDs and
  clean only those fixtures after investigating. No production fixtures were made.
- Cloudflare login succeeded. Gateway is deployed ONLY to its workers.dev URL,
  pointing to rehearsal. No production Worker route or DNS change exists yet.
- Domain TLS handshake verified: Google Trust Services WE1, SAN beyx-system.com
  and www.beyx-system.com, valid 2026-10-15 through 2027-01-13. Existing public
  HTTP still returns 200. Gateway now enforces HTTP-to-HTTPS 308 (three unit tests
  pass), but this affects the main domain only after route cutover.
- Cloudflare OAuth cannot read SSL/Universal SSL settings (403). The owner has
  confirmed Universal SSL is Active in the dashboard (2026-10-20). Use these
  automatically renewed managed edge certificates and Google-managed Cloud Run
  origin TLS; no Certbot on the data VM. Recheck HTTPS/redirect after cutover.
- Candidate 5 build `ca35c293-c5a4-45bb-8610-9316f68893dc` succeeded and is deployed:
  `sha256:9428082b2cc12ddf2a24175dd8b9dc50873844402592a39573ff026ba5e4c722`.
  Includes bounded five-minute SSE lifetimes and disconnect-during-subscribe
  cleanup (three lifecycle unit tests pass), plus empty upload validation.
- Candidate 5 VM-generated test with a bounded 64-connection HTTP agent and a
  1 CPU / 1 GiB generator passed all 100 registration-page jobs, 300 registrations
  at concurrency 25, 300 public bracket jobs, and 300 initial SSE connections.
  Tournament completion/delivery verification is still running; this partial
  result is not yet a complete capacity PASS.
- Local 88-test run: 75 passed, 13 failed. After fixes, all 13 pass in targeted
  reruns (11 then 2). A fully parallel local-dev rerun was explicitly interrupted:
  network/development-server timeouts make it unsuitable as deployment evidence.
  Next run uses --staging against the exact allowlisted rehearsal Cloud Run URL;
  fixture logins must authenticate unique accounts created only in rehearsal.
- Latest candidate 1 VM-generated capacity run finished all 1,023 bracket nodes,
  598 played match updates, 300/300 SSE clients received updates, zero unknown
  players, zero errors across 1,032 administrator polls. Still FAILED: 182/300
  public page deadlines and four SSE stream errors. Candidate 3 rerun is underway.
  Cloud Run logged sampled public HTML requests at 8–121ms despite generator
  deadlines. Diagnose TLS/client connection churn before attributing all to app CPU.
- No production traffic or database has been switched as part of this checkpoint.

## Target

- Cloud Run rehearsal target: 1 vCPU, 1 GiB, request-based CPU, concurrency 400, minimum 0,
  maximum 3 instances, request timeout 3600 seconds, container port 80. Runtime
  secret version 2 limits ordinary DB connections to three per instance plus one
  LISTEN and one mutation-lock connection (15 at maximum normal scale). Revision
  overlaps and tests need additional connection headroom under PostgreSQL's 40 cap.
- Compute Engine data VM: `e2-small`, 2 GiB RAM, `us-central1-a`, PostgreSQL 18
  and Redis. Match the source PostgreSQL major version; do not downgrade Neon 18
  to PostgreSQL 17. Pin image digests when provisioning the actual release.
- VPC: separate VM and Cloud Run subnets in `us-central1`; reserve a fixed
  private IP for the database. Cloud Run uses Direct VPC egress for private ranges.
- Allow PostgreSQL and Redis only from the Cloud Run subnet. Use IAP for SSH.
  No public exposure of ports 5432 or 6379.
- Provision packages/images with a temporary public IP, then remove that IP after
  verification. Private Google Access supports Google APIs, not arbitrary package
  downloads. Future updates need an explicit egress plan; do not silently add NAT.

This is not guaranteed to cost zero. The database VM, disks, backups, builds,
registry and network traffic have separate charges. Google AI Pro credits must
be redeemed and confirmed on the selected billing account. Long-lived SSE requests
keep Cloud Run request billing active. Set a billing budget alert, and measure the
actual competition workload before claiming the credit covers the month. A budget
alert does not stop spending. The maximum-instance setting limits scaling rather
than creating a hard financial cap.

## Build and runtime

`deploy/gcp/cloudbuild.yaml` builds the current local source and pushes a release
image to Artifact Registry. `.gcloudignore` excludes secrets, dumps, local builds
and reports. Use a unique `_RELEASE`; never reuse a tag for a different source tree.

```powershell
gcloud builds submit . --project=beyx-production-20261020 --config=deploy/gcp/cloudbuild.yaml --substitutions=_RELEASE=REPLACE_WITH_RELEASE_ID
```

The Artifact Registry repository `beyx` and the relevant APIs/service accounts
must be provisioned before that command. Set runtime secrets through Secret
Manager; never pass production credentials as Docker build arguments.

Runtime settings include `DATA_BACKEND=postgres`, `AUTH_BACKEND=local`,
`REALTIME_BACKEND=postgres`, `DATABASE_POOL_MAX=8`, `DATABASE_SSL=disable` on the
private VPC, `DATABASE_APPLICATION_NAME` per environment, and the existing session
secret. Point both the query and realtime URLs at the private PostgreSQL endpoint.
Three configured web instances use up to 27 pooled/listener connections, but
deployments can temporarily overlap old and new revisions. Monitor the 40-connection
database limit and reduce per-instance pools or scaling if necessary.

`deploy/gcp/compose.database.yaml` uses the existing bootstrap roles and extensions.
Supply required variables from a root-only VM env file, including `VM_PRIVATE_IP`
and random database/Redis passwords. Use `chmod 600` and `umask 077`. Run Compose
from the repository with its explicit env file and this compose file. Do not run
`down -v`. The Redis instance is a disposable cache; PostgreSQL uses a persistent
volume mounted at PostgreSQL 18's supported `/var/lib/postgresql` location.

Check external storage, uploads, image domains, session cookies, public URLs,
Challonge callbacks and OAuth redirects separately. The CX attachment write endpoint
currently edits a repository JSON file; Cloud Run instance-local writes are not
persistent or shared, so this behavior needs a separate persistence decision if used.

## Rehearsal and tests

1. Check source PostgreSQL version, extensions, roles, schema, sequences and current
   row counts. Obtain the direct Neon URL without printing credentials.
2. Make a restricted custom-format dump using PostgreSQL 18 `pg_dump`, with
   `--schema=public --no-owner --no-privileges`. Verify command success, nonzero
   file size, checksum and `pg_restore --list`. Never restore a failed/empty dump.
3. Restore into a new, isolated rehearsal database, in a single transaction with
   exit-on-error. Skip only `CREATE SCHEMA public` in the archive list when the
   schema already exists. Do not suppress other restore errors.
4. Reapply target ownership/grants and check extension dependencies, functions,
   triggers, views, sequences, constraints, row counts and deterministic row hashes.
   Reconcile against the SAME source snapshot or a quiesced source, not a database
   receiving concurrent writes. Existing snapshot scripts must be reviewed for
   Neon compatibility before reuse; they originated in the Supabase migration.
5. Create separate disposable source and target E2E databases, with names containing
   `e2e` or `rehearsal`. Use `.env.e2e` and the real restored schema. Keep provider
   credentials disabled except for explicit test-account integration checks.
6. Run `npm run test:minigame`, `npm run test:brackets`, `npm run test:e2e:tools`,
   `npm run test:e2e:ui`, and `npm run test:e2e:migration`. Keep before/after reports
   separately and run the report comparison tool. Record existing defects; do not
   skip them to claim a fully green migration.
7. Deploy a staging Cloud Run service against the rehearsal database. The current
   migration runner owns a local dev server; its passing result alone does not
   certify the Cloud Run deployment. Also check deployed desktop/mobile journeys,
   image/GLB loads and realtime behavior using its staging URL.
8. Test the agreed load with synthetic staging data: 25 concurrent registrations,
   100 registration-page viewers and gradual enrollment to 300, 10 administrators,
   300 public bracket/SSE viewers while a DOUBLE tournament progresses to completion.
   Record latency, errors, database connections, VM CPU/RAM, Cloud Run instances,
   reconnect behavior and actual billing-relevant runtime.

## Cutover

1. Confirm a maintenance window and stop writes from the old service, jobs and APIs.
2. Take a fresh final dump and retain the old service's configuration/image.
3. Restore into a NEW production database and reconcile the same quiesced source.
4. Deploy the tested source/image with production secrets; verify database reads,
   an owned test write, login, registration, bracket updates and SSE.
5. Switch the domain, verify HTTPS/cookies/short links and all asset URLs, then
   reopen registration and administrator writes.
6. Keep Neon and the old Linode deployment available for recovery until the new
   system has survived real use. Do not delete either during initial cutover.
7. If new production has accepted writes, switching back to the old database
   loses/diverges those writes. Stop writes and reconcile or copy them back before
   a database rollback. Reverting only the web revision is a separate operation.
8. Configure off-VM backups with retention and actually rehearse restoring one
   before decommissioning the source.

## References

- https://cloud.google.com/run/pricing
- https://docs.cloud.google.com/run/docs/configuring/billing-settings
- https://developers.google.com/profile/help/benefits

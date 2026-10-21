# 3D production release — 2026-10-21

- Source checkpoint: `1b8736f` (3D stadium, rail/dash physics, pooled impact effects, stable edge collisions and regression tests).
- Cloud Build: `d70177ae-5372-495b-a10f-b892fdc0732f`, SUCCESS.
- Image: `us-central1-docker.pkg.dev/beyx-production-20261020/beyx/web@sha256:e505d65e3c0e62f8546a2f5da2c280f77eaaed8735f872f99f62554b75b90be3`.
- Production service: `beyx-web`, `us-central1`, revision `beyx-web-00002-kom`, 100% traffic.
- Cloudflare release cache key: `gcp-20261021-3d-v1`; Worker version `6b0f5d2e-3f70-447d-b7ed-7273d129ece7`.
- Runtime secret, database, Redis and production data were not modified.

## Verification

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit --incremental false`, exit 0.
- Unit/regression suite: 85 passed, 0 failed, 0 skipped.
- Playwright public UI on the no-traffic preview revision: 10 passed (desktop and Pixel 7), 4.8 minutes. Includes rapid pinned contacts, home drag/pause/reset, minigame launch, language/login, scoreboard and reduced motion.
- Production HTTPS `/api/health`: HTTP 200, `{"status":"ok"}`.
- Post-promotion Playwright reduced-motion interaction: 2 passed (desktop/mobile) on `https://beyx-system.com`.
- Inspected the rendered preview stadium screenshot; models, rail and three finish zones displayed.

The previous revision `beyx-web-00001-t4h` was retained for application-only rollback. The release was promoted only after preview tests passed; no maintenance mode or database migration was used.

Changes that appeared in the working directory after the build snapshot were deliberately left uncommitted and were not included in this image. This release does not claim to contain those later edits.

## Application-only rollback

```powershell
gcloud run services update-traffic beyx-web --project=beyx-production-20261020 --region=us-central1 --to-revisions=beyx-web-00001-t4h=100
```

Reconcile the production image manifest and Cloudflare release key if rollback is used. Do not restore an older database: the existing production database continues receiving live writes.

## Follow-up release: 3d-v2

- Source checkpoint: `0db14aa`. Includes the previously pending shared-tournament game toggle and launch meter freeze/reset regression fix.
- Cloud Build `af3912ab-7ce2-4449-a12b-45ac5ed86414`: SUCCESS.
- Image: `us-central1-docker.pkg.dev/beyx-production-20261020/beyx/web@sha256:417dd4a12b42e0bc91c0e3fb65516f13004a9776ad61e8779584e3a052ad50f3`.
- Promoted revision: `beyx-web-00005-tej`, 100% traffic. Previous application revision `beyx-web-00002-kom` retained for rollback.
- Cloudflare release key `gcp-20261021-3d-v2`, Worker version `ce64894a-4faa-42a4-9bb0-e3a5ee4d4474`.
- TypeScript passed; unit/regression suite passed all 85 cases.
- Preview Playwright passed 12/12 desktop/mobile cases in 4.8 minutes, including opening/closing the game on the existing public tournament page without leaving it. No tournament records were edited.
- Preview results preserved locally in ignored `backups/gcp/3d-v2-preview-results.json`.
- Post-promotion shared-page Playwright passed 2/2 desktop/mobile cases on the production domain; `/api/health` returned HTTP 200.
- No database, runtime secret or Redis changes; no maintenance mode used.

For application-only rollback of this follow-up, use the command above with `--to-revisions=beyx-web-00002-kom=100` instead, and reconcile the image manifest/cache release key.

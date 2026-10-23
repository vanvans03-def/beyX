# Production UX release — 2026-10-23

- Application source checkpoint: `c801c5f`, pushed to `origin/main`.
- Cloud Build: `b53bdce2-f961-4357-9ce4-44af29bd2b25`, SUCCESS. Input was a Git archive of that checkpoint, not the dirty working directory. Only example environment files were included; no local runtime files, backups or scratch files.
- Image: `us-central1-docker.pkg.dev/beyx-production-20261020/beyx/web@sha256:db433a704ecb152d466b21c7b1f6c53071923bd80e939f9dec520efdf3f7e2e1`.
- Cloud Run revision: `beyx-web-ux-20261023-v1`, `us-central1`, **100% production traffic**. First deployed with zero traffic and verified through its tagged preview URL.
- Cloudflare release key: `gcp-20261023-ux-v1`; Worker version `a7cb2bd3-93f8-44a6-ad00-3d39a410b8d5`.
- Existing PostgreSQL, Redis, runtime secret mount, autoscaling settings and production data preserved. No database migration, credential rotation, maintenance mode or production tournament writes.

## Verification

- Earlier manual direct-UI test in the isolated local test database: SINGLE 14 players / 13 matches; DOUBLE 14 players / 27 matches including reset final. Result correction, live shared brackets, final rankings and W/L verified. User confirmed clear announcement audio. Full scope/limitations: `TOURNAMENT_MANUAL_UI_CHECK.md`.
- Final TypeScript check passed; game logic and directional/stamina regression scripts passed. Staged release secret audit: zero findings.
- Cloud container build passed without production credentials.
- No-traffic preview: health, home, login, events, rankings, minigame, public rankings and both OG images returned HTTP 200. Existing public short link resolved correctly. Browser loaded compact home models, opened the shared-page minigame (start enabled), switched back to bracket and kept credits in footer; no preview browser errors observed.
- After promotion: actual production health, home, login, events, rankings, minigame and `/Team-Lungpuk/05fe6661` returned HTTP 200. Both OG images matched local SHA256 values. HTTP redirects to HTTPS with certificate validation enabled.
- Production browser check: new shared-page game tab and game assets verified read-only. No authenticated admin writes performed as a deployment smoke check.

Known pre-existing cosmetic limitation: active reset-final card uses internal play-order number `10003`; bracket label and results are correct. This release does not claim exhaustive coverage of all browsers or correction timings.

## Application-only rollback

Previous revision `beyx-web-00005-tej` is retained:

```powershell
gcloud run services update-traffic beyx-web --project=beyx-production-20261020 --region=us-central1 --to-revisions=beyx-web-00005-tej=100
```

If rolling back, reconcile `service.production.yaml` to the previous image and Cloudflare cache key to `gcp-20261021-3d-v2`, then deploy the gateway config. Do **not** restore an older database: production continues receiving writes.

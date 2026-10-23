# Local development against GCP production

Local `.env.local` now overrides the old Neon/Supabase values in `.env`. PostgreSQL points through loopback `127.0.0.1:55432` to database `beyx_prod_20261020` on private VM `beyx-data-1` in project `beyx-production-20261020`. Redis uses `127.0.0.1:56379` to the same GCP VM, avoiding stale caches from the previous database.

**This is live production data, not a development clone. Changes made in the local UI affect real users/tournaments. Do not run mutation/load tests against it.** Existing isolated E2E configuration/runner is separate and must continue to use an explicitly named test/rehearsal database.

## Windows workflow

1. Sign into `gcloud auth login` if the existing login expires.
2. In one terminal, run `npm run gcp:tunnel` and leave it running. The tunnel binds only to `127.0.0.1`; it does not open public database/Redis ports. Stop it with Ctrl+C.
3. In another terminal, run `npm run dev` and open `http://localhost:3333`. Restart a previously running Next server after changing database settings: hot reload does not replace cached global connection pools.

For port 3334, `npm run dev-local` still works; override local base URLs accordingly if testing absolute links/OAuth. Defaults in this setup use port 3333.

`npm run setup:local-gcp` refreshes local connection settings from Secret Manager `beyx-runtime-production` without printing secrets. It preserves unrelated environment variables, makes a restricted backup under ignored `backups/local-gcp/`, and restricts `.env.local` permissions. It does not copy the production session signing secret: local sessions remain separate. Neither credentials nor backups should be committed. Never run `neon env pull` to update this GCP configuration.

The connection uses PostgreSQL's non-TLS protocol **inside an encrypted SSH/IAP tunnel**, not unencrypted transport over the Internet. The VM is private; firewall/public IP settings were not changed. GCP connection checks use a read-only session and Redis PING only. No schema migrations or application data writes were performed during setup.

During setup the task started a hidden tunnel process, PID 11444 (PowerShell supervisor; its child plink owns the forwarded ports). After closing that tunnel or restarting Windows, use `npm run gcp:tunnel` to start a new one. Diagnostic output is in ignored `backups/local-gcp/tunnel.*.log`.

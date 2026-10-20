#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /opt/beyx
set -a
source .env.gcp-data
set +a
target=beyx_e2e_backup_drill_20261020
compose=(docker compose --env-file .env.gcp-data -f deploy/gcp/compose.database.yaml)
exists=$("${compose[@]}" exec -T postgres psql -X -qAt -U "$LOCAL_POSTGRES_ADMIN_USER" -d postgres -c "SELECT count(*) FROM pg_database WHERE datname='$target';")
test "$exists" = 0 || { echo 'Backup-drill target exists; refusing overwrite.' >&2; exit 1; }
"${compose[@]}" exec -T postgres createdb -U "$LOCAL_POSTGRES_ADMIN_USER" -T template0 "$target"
"${compose[@]}" exec -T postgres psql -X -v ON_ERROR_STOP=1 -U "$LOCAL_POSTGRES_ADMIN_USER" -d "$target" < docker/postgres/init/001-bootstrap.sql
"${compose[@]}" exec -T postgres pg_restore --list /backups/drill/rehearsal-backup.dump > backups/drill/restore.list
sed -i '/ SCHEMA - public /s/^/;/' backups/drill/restore.list
"${compose[@]}" exec -T postgres pg_restore -U "$LOCAL_POSTGRES_ADMIN_USER" -d "$target" \
  --no-owner --no-privileges --single-transaction --exit-on-error \
  --use-list=/backups/drill/restore.list /backups/drill/rehearsal-backup.dump
"${compose[@]}" exec -T postgres psql -X -v ON_ERROR_STOP=1 -U "$LOCAL_POSTGRES_ADMIN_USER" -d "$target" < docker/postgres/post-restore/001-grants.sql
"${compose[@]}" exec -T postgres psql -X -v ON_ERROR_STOP=1 -U "$LOCAL_POSTGRES_ADMIN_USER" -d "$target" <<'SQL'
DO $$ BEGIN
  IF (SELECT count(*) FROM pg_tables WHERE schemaname='public') <> 14 THEN RAISE EXCEPTION 'Incorrect restored table count'; END IF;
  IF to_regprocedure('public.merge_player_profiles(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'Missing merge RPC'; END IF;
  IF to_regclass('public.player_ranking_totals') IS NULL THEN RAISE EXCEPTION 'Missing rankings view'; END IF;
END $$;
SELECT 'BACKUP_RESTORE_DRILL_PASS' AS result;
SQL
# Remove only the uniquely named disposable restore database, never the source.
"${compose[@]}" exec -T postgres dropdb -U "$LOCAL_POSTGRES_ADMIN_USER" "$target"
echo 'Removed the disposable drill DB; off-VM backup and source DB remain intact.'

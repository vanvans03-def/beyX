#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /opt/beyx
set -a
source .env.gcp-data
set +a
if [ "$LOCAL_POSTGRES_DB" != 'beyx_rehearsal' ]; then
    echo 'Refusing to restore outside the named rehearsal database.' >&2
    exit 1
fi
compose=(docker compose --env-file .env.gcp-data -f deploy/gcp/compose.database.yaml)
"${compose[@]}" up -d
ready=0
for attempt in $(seq 1 120); do
    container=$("${compose[@]}" ps -q postgres)
    if [ -n "$container" ] && [ "$(docker inspect --format '{{.State.Health.Status}}' "$container")" = 'healthy' ]; then
        ready=1
        break
    fi
    sleep 2
done
[ "$ready" = 1 ] || { echo 'PostgreSQL readiness timeout.' >&2; exit 1; }
count=$("${compose[@]}" exec -T postgres psql -X -qAt -U "$LOCAL_POSTGRES_ADMIN_USER" -d "$LOCAL_POSTGRES_DB" -c "SELECT count(*) FROM pg_tables WHERE schemaname='public';")
[ "$count" = 0 ] || { echo 'Rehearsal is not empty; refusing to overwrite it.' >&2; exit 1; }
"${compose[@]}" exec -T postgres pg_restore --list /backups/rehearsal/beyx-public.dump > backups/rehearsal/restore.list
sed -i '/ SCHEMA - public /s/^/;/' backups/rehearsal/restore.list
"${compose[@]}" exec -T postgres pg_restore -U "$LOCAL_POSTGRES_ADMIN_USER" -d "$LOCAL_POSTGRES_DB" \
    --no-owner --no-privileges --single-transaction --exit-on-error \
    --use-list=/backups/rehearsal/restore.list /backups/rehearsal/beyx-public.dump
"${compose[@]}" exec -T postgres psql -X -v ON_ERROR_STOP=1 -U "$LOCAL_POSTGRES_ADMIN_USER" -d "$LOCAL_POSTGRES_DB" \
    < docker/postgres/post-restore/001-grants.sql
container=$("${compose[@]}" ps -q postgres)
python3 deploy/gcp/reconcile-snapshot.py backups/rehearsal/source-inventory.json "$container" "$LOCAL_POSTGRES_ADMIN_USER" "$LOCAL_POSTGRES_DB"
"${compose[@]}" ps

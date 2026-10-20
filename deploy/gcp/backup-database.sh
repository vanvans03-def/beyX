#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /opt/beyx
target=${1:?Specify the reviewed database name}
case "$target" in beyx_rehearsal|beyx_prod_20261020) ;; *) echo 'Unapproved backup target.' >&2; exit 1;; esac
set -a
source .env.gcp-data
set +a
install -d -m 700 backups/daily
name="${target}-$(date -u +%Y%m%dT%H%M%SZ).dump"
file="backups/daily/$name"
test ! -e "$file"
docker compose --env-file .env.gcp-data -f deploy/gcp/compose.database.yaml exec -T postgres \
  pg_dump -U "$LOCAL_POSTGRES_ADMIN_USER" -d "$target" --schema=public --format=custom --no-owner --no-privileges > "$file"
test -s "$file"
docker compose --env-file .env.gcp-data -f deploy/gcp/compose.database.yaml exec -T postgres \
  pg_restore --list "/backups/daily/$name" >/dev/null
sha256sum "$file"
python3 deploy/gcp/upload-backup.py "$file"

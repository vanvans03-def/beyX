#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /opt/beyx
set -a
source .env.gcp-data
set +a
target=beyx_prod_20261020
test "${REVIEWED_PRODUCTION_DATABASE:-}" = "$target" || {
  echo 'Explicit production target approval is required.' >&2; exit 1;
}
python3 - <<'PY'
import hashlib, json
from pathlib import Path
root = Path('backups/cutover')
inventory = json.loads((root / 'source-inventory.json').read_text())
dump = (root / 'beyx-public.dump').read_bytes()
assert len(dump) == inventory['archive']['bytes'] and len(dump) > 5
assert hashlib.sha256(dump).hexdigest() == inventory['archive']['sha256']
print('Cutover dump size and SHA256 verified.')
PY
compose=(docker compose --env-file .env.gcp-data -f deploy/gcp/compose.database.yaml)
exists=$("${compose[@]}" exec -T postgres psql -X -qAt -U "$LOCAL_POSTGRES_ADMIN_USER" -d postgres -c "SELECT count(*) FROM pg_database WHERE datname='$target';")
test "$exists" = 0 || { echo 'Target already exists; refusing overwrite.' >&2; exit 1; }
"${compose[@]}" exec -T postgres createdb -U "$LOCAL_POSTGRES_ADMIN_USER" -T template0 "$target"
"${compose[@]}" exec -T postgres psql -X -v ON_ERROR_STOP=1 -U "$LOCAL_POSTGRES_ADMIN_USER" -d "$target" < docker/postgres/init/001-bootstrap.sql
"${compose[@]}" exec -T postgres pg_restore --list /backups/cutover/beyx-public.dump > backups/cutover/restore.list
sed -i '/ SCHEMA - public /s/^/;/' backups/cutover/restore.list
"${compose[@]}" exec -T postgres pg_restore -U "$LOCAL_POSTGRES_ADMIN_USER" -d "$target" \
  --no-owner --no-privileges --single-transaction --exit-on-error \
  --use-list=/backups/cutover/restore.list /backups/cutover/beyx-public.dump
"${compose[@]}" exec -T postgres psql -X -v ON_ERROR_STOP=1 -U "$LOCAL_POSTGRES_ADMIN_USER" -d "$target" < docker/postgres/post-restore/001-grants.sql
container=$("${compose[@]}" ps -q postgres)
GCP_RECONCILE_PRODUCTION="$target" python3 deploy/gcp/reconcile-snapshot.py backups/cutover/source-inventory.json "$container" "$LOCAL_POSTGRES_ADMIN_USER" "$target"
echo 'Production restore verified; traffic has not been switched by this script.'

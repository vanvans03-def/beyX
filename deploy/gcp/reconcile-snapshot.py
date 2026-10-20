#!/usr/bin/env python3
"""Compare a restored database to the consistent inventory; never writes rows."""
import json
import os
import subprocess
import sys

inventory_path, container, user, database = sys.argv[1:]
if not any(marker in database for marker in ('rehearsal', 'e2e')) and not (
    database == 'beyx_prod_20261020' and os.environ.get('GCP_RECONCILE_PRODUCTION') == database
):
    raise SystemExit('Reconciliation must be explicitly reviewed before use on production.')
with open(inventory_path, encoding='utf-8') as source:
    inventory = json.load(source)


def query(sql):
    result = subprocess.run([
        'docker', 'exec', container, 'psql', '-X', '-qAt', '-F', '\t',
        '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', database, '-c',
        "BEGIN READ ONLY; SET LOCAL TIME ZONE 'UTC'; " + sql + ' ROLLBACK;',
    ], check=True, capture_output=True, text=True)
    return result.stdout.strip()


tables = query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;").splitlines()
if tables != inventory['tables']:
    raise SystemExit('FAIL: restored table set differs from the source snapshot.')
failures = []
for table in tables:
    identifier = '"' + table.replace('"', '""') + '"'
    actual = query(
        "SELECT count(*)::text, md5(coalesce(string_agg(row_value, E'\\n' "
        'ORDER BY row_value COLLATE "C"), \'\')) '
        f'FROM (SELECT row_to_json(t)::text AS row_value FROM public.{identifier} t) rows;'
    ).split('\t')
    matches = int(actual[0]) == inventory['rowCounts'][table] and actual[1] == inventory['rowChecksums'][table]
    print(f'{table}: rows={actual[0]} checksum={"PASS" if matches else "FAIL"}')
    if not matches:
        failures.append(table)
if failures:
    raise SystemExit('Reconciliation failed: ' + ', '.join(failures))
print(f'PASS: exact row counts and content checksums match across {len(tables)} tables.')

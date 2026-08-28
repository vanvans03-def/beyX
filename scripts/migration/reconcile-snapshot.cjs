const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const snapshotDir = path.resolve(
  process.env.MIGRATION_SNAPSHOT_DIR
    || path.join(os.tmpdir(), 'beyx-migration-snapshot'),
);
const inventoryPath = path.join(snapshotDir, 'source-inventory.json');
const targetDatabase = process.env.REHEARSAL_DATABASE;
const containerName = process.env.POSTGRES_CONTAINER || 'beyx-postgres';
const databaseUser = process.env.POSTGRES_REHEARSAL_USER || 'beyx_admin';

if (!targetDatabase || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(targetDatabase)) {
  console.error('[RECONCILE] Set REHEARSAL_DATABASE to the exact rehearsal database name.');
  process.exit(2);
}
if (!fs.existsSync(inventoryPath)) {
  console.error(`[RECONCILE] Missing source inventory: ${inventoryPath}`);
  process.exit(2);
}

const source = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
if (!source.rowChecksums) {
  console.error('[RECONCILE] Source inventory has no rowChecksums. Re-run create-readonly-snapshot.cjs.');
  process.exit(2);
}

function runPsql(sql) {
  const result = spawnSync('docker', [
    'exec', containerName,
    'psql', '--no-psqlrc', '--quiet', '--set', 'ON_ERROR_STOP=1',
    '--tuples-only', '--no-align',
    '--username', databaseUser,
    '--dbname', targetDatabase,
    '--command', `begin read only; ${sql} rollback;`,
  ], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`psql exited with status ${result.status}`);
  }
  return result.stdout.trim();
}

function lines(value) {
  return value ? value.split(/\r?\n/).filter(Boolean) : [];
}

const failures = [];
const targetTables = lines(runPsql(
  "select tablename from pg_catalog.pg_tables where schemaname='public' order by tablename;",
));

if (JSON.stringify(targetTables) !== JSON.stringify(source.tables)) {
  failures.push(`table set differs: source=${source.tables.length}, target=${targetTables.length}`);
}

for (const tableName of source.tables) {
  if (!/^[a-z_][a-z0-9_]*$/.test(tableName)) throw new Error(`Unsafe table identifier: ${tableName}`);
  const targetCount = Number(runPsql(`select count(*) from public.${tableName};`));
  const targetChecksum = runPsql(`
    select md5(coalesce(string_agg(row_value, E'\\n' order by row_value), ''))
    from (select row_to_json(t)::text as row_value from public.${tableName} t) rows;
  `);
  const countOk = targetCount === source.rowCounts[tableName];
  const checksumOk = targetChecksum === source.rowChecksums[tableName];
  console.log(`[RECONCILE] ${tableName}: rows=${targetCount} ${countOk && checksumOk ? 'OK' : 'MISMATCH'}`);
  if (!countOk) failures.push(`${tableName}: row count ${source.rowCounts[tableName]} != ${targetCount}`);
  if (!checksumOk) failures.push(`${tableName}: checksum differs`);
}

const targetViews = lines(runPsql(
  "select table_name from information_schema.views where table_schema='public' order by table_name;",
));
const targetFunctions = lines(runPsql(
  "select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1;",
));
const targetConstraints = lines(runPsql(
  "select conrelid::regclass::text || '|' || conname || '|' || contype::text || '|' || pg_get_constraintdef(oid) from pg_constraint where connamespace='public'::regnamespace order by conrelid::regclass::text, conname;",
));

for (const [label, expected, actual] of [
  ['views', source.views, targetViews],
  ['functions', source.functions, targetFunctions],
  ['constraints', source.constraints, targetConstraints],
]) {
  const missing = expected.filter((item) => !actual.includes(item));
  const additions = actual.filter((item) => !expected.includes(item));
  if (missing.length) failures.push(`${label} missing from target: ${missing.join(', ')}`);
  if (additions.length) console.log(`[RECONCILE] ${label}: ${additions.length} expected target-side addition(s).`);
}

if (failures.length) {
  console.error('[RECONCILE] FAILED:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`[RECONCILE] PASS: ${source.tables.length} tables match by exact row count and deterministic content checksum.`);

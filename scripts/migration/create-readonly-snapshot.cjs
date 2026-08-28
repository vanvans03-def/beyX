const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const dotenv = require('dotenv');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(ROOT_DIR, '.env.local'), quiet: true });
dotenv.config({ path: path.join(ROOT_DIR, '.env'), quiet: true, override: false });

const sourceUrl = process.env.SOURCE_DATABASE_URL
  || process.env.POSTGRES_URL_NON_POOLING
  || process.env.POSTGRES_URL;

if (!sourceUrl) {
  console.error('[SNAPSHOT] Missing SOURCE_DATABASE_URL or POSTGRES_URL_NON_POOLING.');
  process.exit(2);
}

const parsed = new URL(sourceUrl);
if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
  console.error('[SNAPSHOT] Source URL is not a PostgreSQL connection string.');
  process.exit(2);
}

const clientImage = process.env.PG_CLIENT_IMAGE || 'postgres:17.11-alpine';
const outputDir = path.resolve(
  process.env.MIGRATION_SNAPSHOT_DIR
    || path.join(os.tmpdir(), 'beyx-migration-snapshot'),
);
const localDump = path.join(outputDir, 'beyx-public.dump');
const inventoryPath = path.join(outputDir, 'source-inventory.json');
const archiveListPath = path.join(outputDir, 'beyx-public.archive-list.txt');
const clientEnvPath = path.join(outputDir, '.source-pg-client.env');

fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });

const pgEnv = {
  ...process.env,
  PGHOST: parsed.hostname,
  PGPORT: parsed.port || '5432',
  PGDATABASE: decodeURIComponent(parsed.pathname.replace(/^\//, '') || 'postgres'),
  PGUSER: decodeURIComponent(parsed.username),
  PGPASSWORD: decodeURIComponent(parsed.password),
  PGSSLMODE: parsed.searchParams.get('sslmode') || 'require',
  PGOPTIONS: '-c statement_timeout=120000',
};

function assertSingleLine(name, value) {
  if (/[\r\n]/.test(value)) throw new Error(`${name} contains a newline.`);
  return value;
}

function writeClientEnvFile() {
  const content = [
    `PGHOST=${assertSingleLine('PGHOST', pgEnv.PGHOST)}`,
    `PGPORT=${assertSingleLine('PGPORT', pgEnv.PGPORT)}`,
    `PGDATABASE=${assertSingleLine('PGDATABASE', pgEnv.PGDATABASE)}`,
    `PGUSER=${assertSingleLine('PGUSER', pgEnv.PGUSER)}`,
    `PGPASSWORD=${assertSingleLine('PGPASSWORD', pgEnv.PGPASSWORD)}`,
    `PGSSLMODE=${assertSingleLine('PGSSLMODE', pgEnv.PGSSLMODE)}`,
    `PGOPTIONS=${assertSingleLine('PGOPTIONS', pgEnv.PGOPTIONS)}`,
    '',
  ].join('\n');
  fs.writeFileSync(clientEnvPath, content, { encoding: 'utf8', mode: 0o600 });

  if (process.platform === 'win32') {
    const username = process.env.USERNAME;
    if (!username) throw new Error('USERNAME is required to protect the temporary client env file.');
    execFileSync('icacls.exe', [
      clientEnvPath,
      '/inheritance:r',
      '/grant:r', `${username}:(R,W)`,
      '/grant:r', 'SYSTEM:(F)',
      '/grant:r', 'Administrators:(F)',
    ], { stdio: 'ignore' });
  }
}

function dockerClientArgs(commandArgs, needsSnapshotMount = false) {
  return [
    'run', '--rm',
    '--env-file', clientEnvPath,
    ...(needsSnapshotMount
      ? ['--mount', `type=bind,source=${outputDir},target=/snapshot`]
      : []),
    clientImage,
    ...commandArgs,
  ];
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    env: pgEnv,
    encoding: options.binary ? undefined : 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (options.capture && result.stderr) process.stderr.write(result.stderr);
    throw new Error(`${command} exited with status ${result.status}`);
  }
  return result.stdout;
}

function psql(sql) {
  return run('docker', dockerClientArgs([
    'psql',
    '--no-psqlrc',
    '--quiet',
    '--set', 'ON_ERROR_STOP=1',
    '--tuples-only',
    '--no-align',
    '--command', `begin read only; ${sql} rollback;`,
  ]), { capture: true }).trim();
}

function lines(value) {
  return value ? value.split(/\r?\n/).filter(Boolean) : [];
}

function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

try {
  writeClientEnvFile();
  console.log('[SNAPSHOT] Verifying PostgreSQL 17 client tools...');
  const dumpVersion = run('docker', ['run', '--rm', clientImage, 'pg_dump', '--version'], { capture: true }).trim();
  const restoreVersion = run('docker', ['run', '--rm', clientImage, 'pg_restore', '--version'], { capture: true }).trim();
  console.log(`[SNAPSHOT] ${dumpVersion}; ${restoreVersion}`);

  const sourceVersion = psql("select current_setting('server_version') || '|' || current_database() || '|' || current_setting('transaction_read_only');");
  const [serverVersion, databaseName, readOnly] = sourceVersion.split('|');
  if (readOnly !== 'on') throw new Error('Source session is not read-only.');

  console.log('[SNAPSHOT] Creating read-only, public-only custom archive...');
  run('docker', dockerClientArgs([
    'pg_dump',
    '--schema=public',
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '--serializable-deferrable',
    '--file=/snapshot/beyx-public.dump',
  ], true));

  const archiveList = run('docker', [
    'run', '--rm',
    '--mount', `type=bind,source=${outputDir},target=/snapshot`,
    clientImage,
    'pg_restore', '--list', '/snapshot/beyx-public.dump',
  ], { capture: true });
  fs.writeFileSync(archiveListPath, archiveList, { encoding: 'utf8', mode: 0o600 });

  const tableNames = lines(psql("select tablename from pg_catalog.pg_tables where schemaname='public' order by tablename;"));
  const rowCounts = {};
  const rowChecksums = {};
  for (const tableName of tableNames) {
    if (!/^[a-z_][a-z0-9_]*$/.test(tableName)) throw new Error(`Unsafe table identifier: ${tableName}`);
    rowCounts[tableName] = Number(psql(`select count(*) from public.${tableName};`));
    rowChecksums[tableName] = psql(`
      select md5(coalesce(string_agg(row_value, E'\\n' order by row_value), ''))
      from (select row_to_json(t)::text as row_value from public.${tableName} t) rows;
    `);
  }

  const inventory = {
    capturedAt: new Date().toISOString(),
    source: {
      serverVersion,
      databaseName,
      hostMode: parsed.hostname.includes('pooler') ? 'session-pooler' : 'direct',
      port: pgEnv.PGPORT,
      readOnly: true,
    },
    tables: tableNames,
    rowCounts,
    rowChecksums,
    views: lines(psql("select table_name from information_schema.views where table_schema='public' order by table_name;")),
    functions: lines(psql("select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1;")),
    extensions: lines(psql("select extname || '|' || extversion from pg_extension order by extname;")),
    constraints: lines(psql("select conrelid::regclass::text || '|' || conname || '|' || contype::text || '|' || pg_get_constraintdef(oid) from pg_constraint where connamespace='public'::regnamespace order by conrelid::regclass::text, conname;")),
    sequences: lines(psql("select sequence_name from information_schema.sequences where sequence_schema='public' order by sequence_name;")),
    archive: {
      path: localDump,
      bytes: fs.statSync(localDump).size,
      sha256: sha256(localDump),
      listPath: archiveListPath,
    },
  };

  fs.writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });

  console.log(`[SNAPSHOT] Complete: ${tableNames.length} public tables, ${inventory.archive.bytes} bytes.`);
  console.log(`[SNAPSHOT] Artifacts stored outside Git at: ${outputDir}`);
  console.log('[SNAPSHOT] Credentials were not printed or persisted in the artifacts.');
} catch (error) {
  console.error(`[SNAPSHOT] FAILED: ${error.message}`);
  process.exitCode = 1;
} finally {
  try {
    if (fs.existsSync(clientEnvPath)) fs.unlinkSync(clientEnvPath);
  } catch (cleanupError) {
    console.error(`[SNAPSHOT] WARNING: Could not remove temporary client env file: ${cleanupError.message}`);
    process.exitCode = 1;
  }
}

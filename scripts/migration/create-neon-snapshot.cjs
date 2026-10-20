// Read-only Neon export. Dump and inventory share one exported MVCC snapshot.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ path: '.env', quiet: true });

function run(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Docker PostgreSQL client failed: ${result.stderr}`);
  return result.stdout;
}

async function main() {
  const source = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
  if (!source) throw new Error('Set SOURCE_DATABASE_URL or DATABASE_URL_UNPOOLED.');
  const url = new URL(source);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname.includes('-pooler')) {
    throw new Error('A direct, non-pooled PostgreSQL URL is required.');
  }
  const output = path.resolve(process.env.MIGRATION_SNAPSHOT_DIR ||
    `backups/gcp/rehearsal-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  const dump = path.join(output, 'beyx-public.dump');
  if (fs.existsSync(dump)) throw new Error('Output dump already exists; choose a new directory.');
  const clientFile = path.join(output, '.pg-client.env');
  const image = process.env.PG_CLIENT_IMAGE || 'postgres:18-alpine';
  const db = new Pool({ connectionString: source, max: 1, connectionTimeoutMillis: 15_000 });
  let client;
  try {
    const env = {
      PGHOST: url.hostname, PGPORT: url.port || '5432',
      PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
      PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
      PGSSLMODE: 'verify-full',
      PGSSLROOTCERT: '/etc/ssl/certs/ca-certificates.crt',
      PGOPTIONS: '-c default_transaction_read_only=on -c statement_timeout=120000 -c timezone=UTC',
    };
    for (const value of Object.values(env)) if (/[\r\n]/.test(value)) throw new Error('Invalid multiline client setting.');
    fs.writeFileSync(clientFile, Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n',
      { mode: 0o600, flag: 'wx' });
    if (process.platform === 'win32') {
      for (const file of [output, clientFile]) {
        const rights = file === output ? '(OI)(CI)F' : 'F';
        const acl = spawnSync('icacls.exe', [file, '/inheritance:r', '/grant:r',
          `${process.env.USERNAME}:${rights}`, '/grant:r', `SYSTEM:${rights}`,
          '/grant:r', `Administrators:${rights}`], { encoding: 'utf8' });
        if (acl.status !== 0) throw new Error('Could not restrict snapshot ACL.');
      }
    }
    // Pull/check the image before starting the source transaction.
    console.log(run(['run', '--rm', image, 'pg_dump', '--version']).trim());
    client = await db.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    await client.query("SET LOCAL statement_timeout = '120s'");
    const identity = (await client.query("SELECT current_database() AS database, current_setting('server_version') AS version, current_setting('server_version_num')::integer AS version_num, pg_export_snapshot() AS snapshot")).rows[0];
    if (identity.version_num < 180000 || identity.version_num >= 190000) throw new Error('Expected PostgreSQL 18 source; inspect compatibility before proceeding.');
    const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r => r.tablename);
    const inventory = { capturedAt: new Date().toISOString(), source: identity, tables, rowCounts: {}, rowChecksums: {} };
    for (const table of tables) {
      const identifier = '"' + table.replaceAll('"', '""') + '"';
      const result = (await client.query(`SELECT count(*)::text AS count, md5(coalesce(string_agg(row_value, E'\\n' ORDER BY row_value COLLATE "C"), '')) AS checksum FROM (SELECT row_to_json(t)::text AS row_value FROM public.${identifier} t) rows`)).rows[0];
      inventory.rowCounts[table] = Number(result.count);
      inventory.rowChecksums[table] = result.checksum;
    }
    inventory.extensions = (await client.query('SELECT extname, extversion FROM pg_extension ORDER BY extname')).rows;
    inventory.views = (await client.query("SELECT table_name FROM information_schema.views WHERE table_schema='public' ORDER BY table_name")).rows.map(r => r.table_name);
    console.log(`Exporting ${tables.length} tables from a consistent read-only PostgreSQL ${identity.version} snapshot.`);
    run(['run', '--rm', '--env-file', clientFile, '--mount', `type=bind,source=${output},target=/snapshot`,
      image, 'pg_dump', '--schema=public', '--format=custom', '--no-owner', '--no-privileges',
      `--snapshot=${identity.snapshot}`, '--file=/snapshot/beyx-public.dump']);
    if (fs.statSync(dump).size < 5) throw new Error('Dump is empty.');
    const list = run(['run', '--rm', '--mount', `type=bind,source=${output},target=/snapshot`,
      image, 'pg_restore', '--list', '/snapshot/beyx-public.dump']);
    fs.writeFileSync(path.join(output, 'archive.list'), list, { mode: 0o600 });
    inventory.archive = { bytes: fs.statSync(dump).size,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(dump)).digest('hex') };
    fs.writeFileSync(path.join(output, 'source-inventory.json'), JSON.stringify(inventory, null, 2) + '\n', { mode: 0o600 });
    await client.query('ROLLBACK');
    console.log(JSON.stringify({ result: 'PASS', directory: output, tables: tables.length, bytes: inventory.archive.bytes, sha256: inventory.archive.sha256 }));
  } finally {
    if (client) { try { await client.query('ROLLBACK'); } catch {} client.release(); }
    await db.end();
    if (fs.existsSync(clientFile)) fs.unlinkSync(clientFile);
  }
}
main().catch(error => { console.error(`[neon-snapshot] ${error.message}`); process.exitCode = 1; });

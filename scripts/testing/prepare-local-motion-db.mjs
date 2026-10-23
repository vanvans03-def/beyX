import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

// Explicit, disposable local container only. Never read the application's .env.
const container = 'beyx-motion-e2e-20261022';
const run = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const label = run('inspect', '--format', '{{index .Config.Labels "beyx.task"}}', container).trim();
if (label !== 'motion-e2e') throw new Error('Refusing a container not owned by this test workflow.');
const identity = run('exec', container, 'psql', '-U', 'beyx_motion_test', '-d', 'beyx_motion_e2e', '-Atc', 'select current_database()').trim();
if (identity !== 'beyx_motion_e2e') throw new Error('Wrong test database identity.');
const count = run('exec', container, 'psql', '-U', 'beyx_motion_test', '-d', identity, '-Atc', "select count(*) from pg_tables where schemaname='public'").trim();
if (count !== '0') throw new Error('Test database is not empty; refusing to overwrite it.');
const list = run('exec', container, 'pg_restore', '--list', '/tmp/schema-source.dump')
    .replace(/^([^;\n].* SCHEMA - public .*)$/gm, ';$1');
mkdirSync('test-results', { recursive: true });
writeFileSync('test-results/motion-schema.list', list);
run('cp', 'test-results/motion-schema.list', `${container}:/tmp/schema.list`);
run('exec', container, 'psql', '-U', 'beyx_motion_test', '-d', identity, '-v', 'ON_ERROR_STOP=1', '-c', 'CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
run('exec', container, 'pg_restore', '-U', 'beyx_motion_test', '-d', identity, '--schema-only', '--no-owner', '--no-privileges', '--exit-on-error', '--use-list=/tmp/schema.list', '/tmp/schema-source.dump');
const rows = run('exec', container, 'psql', '-U', 'beyx_motion_test', '-d', identity, '-Atc', 'select count(*) from public.users').trim();
if (rows !== '0') throw new Error('Schema-only restore unexpectedly imported user data.');
run('exec', container, 'rm', '--', '/tmp/schema-source.dump', '/tmp/schema.list');
console.log('Local test schema ready; 0 real users imported.');

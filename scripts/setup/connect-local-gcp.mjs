// Pull only connection settings into ignored local config. Never print secrets.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import dotenv from 'dotenv';

const project = 'beyx-production-20261020';
const target = path.resolve('.env.local');
execFileSync('git', ['check-ignore', '--quiet', '.env.local']);
const sdk = path.join(process.env.LOCALAPPDATA || '', 'Google/Cloud SDK/google-cloud-sdk');
const command = process.platform === 'win32' ? path.join(sdk, 'platform/bundledpython/python.exe') : 'gcloud';
const prefix = process.platform === 'win32' ? ['-S', path.join(sdk, 'lib/gcloud.py')] : [];
let runtime;
try {
    runtime = JSON.parse(execFileSync(command, [...prefix, 'secrets', 'versions', 'access', 'latest',
        '--secret=beyx-runtime-production', `--project=${project}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
} catch { throw new Error('Cannot read the current GCP runtime secret. Check gcloud authentication/permissions; no local configuration changed.'); }
const db = new URL(runtime.DATABASE_URL);
if (db.hostname !== '10.42.0.10' || db.pathname !== '/beyx_prod_20261020') throw new Error('Unexpected GCP database target; no changes made.');
const redis = new URL(runtime.REDIS_URL);
if (redis.hostname !== '10.42.0.10') throw new Error('Unexpected GCP Redis target; no changes made.');
db.hostname = '127.0.0.1'; db.port = '55432';
redis.hostname = '127.0.0.1'; redis.port = '56379';
const original = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
const current = dotenv.parse(original);
const values = {
    DATA_BACKEND: 'postgres', AUTH_BACKEND: 'local', REALTIME_BACKEND: 'postgres',
    DATABASE_URL: db.href, DATABASE_URL_UNPOOLED: db.href, REALTIME_DATABASE_URL: db.href,
    DATABASE_SSL: 'disable', DATABASE_POOL_MAX: '2', DATABASE_APPLICATION_NAME: 'beyx-local-gcp',
    REDIS_URL: redis.href, NEXT_PUBLIC_BASE_URL: 'http://localhost:3333', NEXT_PUBLIC_APP_URL: 'http://localhost:3333',
    // Local sessions must not reuse the production signing secret.
    APP_SESSION_SECRET: current.APP_SESSION_SECRET || crypto.randomBytes(48).toString('hex'),
};
function protect(file, directory = false) {
    if (process.platform === 'win32') {
        const rights = directory ? '(OI)(CI)F' : 'F';
        execFileSync('icacls.exe', [file, '/inheritance:r', '/grant:r', `${process.env.USERNAME}:${rights}`,
            '/grant:r', `SYSTEM:${rights}`, '/grant:r', `Administrators:${rights}`], { stdio: 'pipe' });
    } else fs.chmodSync(file, directory ? 0o700 : 0o600);
}
const backupDir = path.resolve('backups/local-gcp');
fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
protect(backupDir, true);
if (original) {
    const backup = path.join(backupDir, `env.local.${Date.now()}.bak`);
    fs.writeFileSync(backup, original, { flag: 'wx', mode: 0o600 }); protect(backup);
}
const lines = original.split(/\r?\n/).filter(line => !Object.keys(values).some(key => new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`).test(line)));
const updated = `${lines.join('\n').trimEnd()}\n\n# GCP production via loopback-only IAP/SSH tunnel. LOCAL ACTIONS AFFECT LIVE DATA.\n${Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n')}\n`;
fs.writeFileSync(target, updated, { mode: 0o600 }); protect(target);
console.log('Updated ignored .env.local: GCP production PostgreSQL via 127.0.0.1:55432; Redis via 127.0.0.1:56379.');
console.log('Local session secret is separate; existing non-connection settings and restricted backup preserved. No database writes performed.');

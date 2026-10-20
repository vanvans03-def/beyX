// Generate private migration configuration without printing credential values.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const dotenv = require('dotenv');

const output = path.resolve('backups/gcp/private');
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
function protect(file, directory = false) {
  if (process.platform === 'win32') {
    const rights = directory ? '(OI)(CI)F' : 'F';
    execFileSync('icacls.exe', [file, '/inheritance:r', '/grant:r', `${process.env.USERNAME}:${rights}`,
      '/grant:r', `SYSTEM:${rights}`, '/grant:r', `Administrators:${rights}`], { stdio: 'pipe' });
  } else fs.chmodSync(file, directory ? 0o700 : 0o600);
}
protect(output, true);
const vmFile = path.join(output, 'data-vm.env');
let vm;
if (fs.existsSync(vmFile)) vm = dotenv.parse(fs.readFileSync(vmFile));
else {
  if (!process.argv.includes('--new-vm')) throw new Error('Bootstrap credentials are absent. Recover the current VM root-only .env.gcp-data first; use --new-vm only for an empty, new VM.');
  const password = () => crypto.randomBytes(32).toString('hex');
  vm = { VM_PRIVATE_IP: '10.42.0.10', LOCAL_POSTGRES_DB: 'beyx_rehearsal',
    LOCAL_POSTGRES_ADMIN_USER: 'beyx_admin', LOCAL_POSTGRES_ADMIN_PASSWORD: password(),
    LOCAL_POSTGRES_APP_PASSWORD: password(), LOCAL_POSTGRES_BACKUP_PASSWORD: password(),
    REDIS_PASSWORD: password() };
  fs.writeFileSync(vmFile, Object.entries(vm).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
}
protect(vmFile);

const key = path.join(process.env.USERPROFILE, '.ssh', 'codex_beyx_ed25519');
const inspection = JSON.parse(execFileSync('ssh', ['-i', key, '-o', 'BatchMode=yes', '-o',
  'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=10', 'root@172.104.48.16',
  'docker inspect beyx-app'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
const source = Object.fromEntries(inspection[0].Config.Env.map(entry => {
  const split = entry.indexOf('='); return [entry.slice(0, split), entry.slice(split + 1)];
}));
const secret = source.APP_SESSION_SECRET || source.SUPABASE_JWT_SECRET;
if (!secret || secret.length < 32) throw new Error('Production session secret is missing or invalid.');
const rehearsalSecretFile = path.join(output, 'rehearsal-session.secret');
if (!fs.existsSync(rehearsalSecretFile)) {
  fs.writeFileSync(rehearsalSecretFile, crypto.randomBytes(48).toString('hex'), { flag: 'wx', mode: 0o600 });
}
protect(rehearsalSecretFile);
const rehearsalSecret = fs.readFileSync(rehearsalSecretFile, 'utf8').trim();
const sourceUrl = new URL(source.DATABASE_URL);
console.log(`Production database host verified: ${sourceUrl.hostname}; database ${sourceUrl.pathname}`);

const retained = ['CHALLONGE_API_KEY', 'BLOB_READ_WRITE_TOKEN', 'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_ACCOUNT_ID', 'CLOUDFLARE_R2_BUCKET_NAME', 'CLOUDFLARE_R2_PUBLIC_URL',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY'];
for (const [mode, database] of [['rehearsal', 'beyx_rehearsal'], ['production', 'beyx_prod_20261020']]) {
  const url = `postgresql://beyx_app:${vm.LOCAL_POSTGRES_APP_PASSWORD}@10.42.0.10:5432/${database}`;
  const runtime = { DATA_BACKEND: 'postgres', AUTH_BACKEND: 'local', REALTIME_BACKEND: 'postgres',
    DATABASE_URL: url, DATABASE_URL_UNPOOLED: url, REALTIME_DATABASE_URL: url,
    DATABASE_SSL: 'disable', DATABASE_POOL_MAX: '3', DATABASE_APPLICATION_NAME: `beyx-gcp-${mode}`,
    APP_SESSION_SECRET: mode === 'production' ? secret : rehearsalSecret, REDIS_URL: `redis://:${vm.REDIS_PASSWORD}@10.42.0.10:6379/${mode === 'rehearsal' ? 1 : 0}`,
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: 'false', NEXT_PUBLIC_BASE_URL: 'https://beyx-system.com',
    NEXT_PUBLIC_APP_URL: 'https://beyx-system.com' };
  if (mode === 'production') for (const name of retained) if (source[name]) runtime[name] = source[name];
  const file = path.join(output, `runtime.${mode}.json`);
  fs.writeFileSync(file, JSON.stringify(runtime, null, 2) + '\n', { mode: 0o600 });
  protect(file);
  console.log(`${mode} runtime prepared; integrations ${mode === 'production' ? 'preserved' : 'disabled'}; values kept private.`);
}
console.log('VM configuration prepared. Existing generated passwords are reused on subsequent runs.');

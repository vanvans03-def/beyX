import fs from 'node:fs';
import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import { Pool } from 'pg';

// Explicit test configuration only. Never load .env/.env.local as test credentials.
const file = process.env.E2E_ENV_FILE || '.env.e2e';
const settings = { ...(fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {}), ...process.env };
const live = process.argv.includes('--challonge');
const ui = process.argv.includes('--ui');
const staging = process.argv.includes('--staging');
const args = process.argv.slice(2).filter(arg => !['--challonge', '--ui', '--staging'].includes(arg));
let server;
let stopping = false;
async function stop() {
    if (!server || server.exitCode !== null || server.signalCode !== null || stopping) return;
    stopping = true;
    if (process.platform === 'win32') {
        try { execFileSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'pipe' }); }
        catch {
            // The OS may already have torn down the process or disallow taskkill
            // while the owned ChildProcess handle can still terminate it.
            server.kill('SIGTERM');
            await Promise.race([new Promise(resolve => server.once('close', resolve)), new Promise(resolve => setTimeout(resolve, 5000))]);
            if (server.exitCode === null && server.signalCode === null) throw new Error(`Unable to stop owned test server PID ${server.pid}; stop it before the next run.`);
        }
    }
    else { process.kill(-server.pid, 'SIGTERM'); await new Promise(resolve => server.once('close', resolve)); }
}
async function main() {
    const url = settings.E2E_DATABASE_URL, name = settings.E2E_DATABASE_NAME;
    if (ui && live) throw new Error('Choose UI-only or live Challonge, not both.');
    if (staging && (ui || live || name !== 'beyx_rehearsal')) throw new Error('Staging mode requires only the isolated GCP rehearsal database.');
    if (!ui) {
    if (!url || !name || settings.E2E_ALLOW_WRITES !== '1') throw new Error('Set E2E_DATABASE_URL, E2E_DATABASE_NAME and E2E_ALLOW_WRITES=1 in .env.e2e.');
    if (!/(test|e2e|rehearsal)/i.test(name) || /^(postgres|template0|template1)$/i.test(name)) throw new Error('Use an isolated database whose name contains test, e2e or rehearsal.');
    if (decodeURIComponent(new URL(url).pathname.slice(1)) !== name) throw new Error('E2E_DATABASE_NAME must exactly match the URL database name.');
    if (live && (!settings.E2E_CHALLONGE_USERNAME || !settings.E2E_CHALLONGE_API_KEY)) throw new Error('Live comparison requires E2E_CHALLONGE_USERNAME and E2E_CHALLONGE_API_KEY from a test account.');
    const db = new Pool({ connectionString: url, connectionTimeoutMillis: 10_000 });
    try {
        const identity = await db.query('SELECT current_database() AS name');
        if (identity.rows[0].name !== name) throw new Error('Connected database identity mismatch.');
        const required = ['users', 'tournaments', 'registrations', 'internal_matches', 'match_locks', 'beyblades', 'events', 'system_settings', 'players', 'player_aliases', 'tournament_results', 'player_ranking_totals', 'player_win_rate_totals'];
        for (const relation of required) {
            const result = await db.query('SELECT to_regclass($1) AS relation', [`public.${relation}`]);
            if (!result.rows[0].relation) throw new Error(`Missing migrated relation: public.${relation}. Restore the application schema before testing.`);
        }
        const rpc = await db.query("SELECT to_regprocedure('public.merge_player_profiles(uuid,uuid)') AS function");
        if (!rpc.rows[0].function) throw new Error('Missing merge_player_profiles migration.');
    } finally { await db.end(); }
    if (settings.E2E_REALTIME_DATABASE_URL) {
        if (decodeURIComponent(new URL(settings.E2E_REALTIME_DATABASE_URL).pathname.slice(1)) !== name) throw new Error('Realtime URL must target the same isolated database name.');
        const realtime = new Pool({ connectionString: settings.E2E_REALTIME_DATABASE_URL, connectionTimeoutMillis: 10_000 });
        try {
            const identity = await realtime.query('SELECT current_database() AS name');
            if (identity.rows[0].name !== name) throw new Error('Realtime database identity mismatch.');
        } finally { await realtime.end(); }
    }
    }
    if (staging) {
        const baseURL = 'https://beyx-rehearsal-638873004771.us-central1.run.app';
        const env = { ...settings, TEST_BASE_URL: baseURL, E2E_STAGING_BASE_URL: baseURL, E2E_CHALLONGE_LIVE: '0' };
        console.log('Testing the deployed GCP rehearsal service. Production URLs are not allowed.');
        const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '-c', 'playwright.migration.config.ts', ...args], { env, stdio: 'inherit', shell: false });
        process.exitCode = Number(await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => resolve(code ?? 1)); }));
        return;
    }
    const port = Number(settings.E2E_PORT || 3345);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid E2E_PORT.');
    await new Promise((resolve, reject) => { const probe = net.createServer(); probe.once('error', () => reject(new Error(`Port ${port} is occupied; refusing to use another application server.`))); probe.listen(port, '127.0.0.1', () => probe.close(resolve)); });
    const env = {
        ...settings, NODE_ENV: 'development', TEST_BASE_URL: `http://127.0.0.1:${port}`,
        E2E_CHALLONGE_LIVE: live ? '1' : '0',
        DATA_BACKEND: 'postgres', AUTH_BACKEND: 'local', REALTIME_BACKEND: 'postgres',
        DATABASE_URL: ui ? '' : url, REALTIME_DATABASE_URL: ui ? '' : settings.E2E_REALTIME_DATABASE_URL || url, DATABASE_URL_UNPOOLED: ui ? '' : settings.E2E_REALTIME_DATABASE_URL || url,
        DATABASE_SSL: settings.E2E_DATABASE_SSL || (url ? new URL(url).searchParams.get('sslmode') : '') || 'disable',
        APP_SESSION_SECRET: randomBytes(48).toString('hex'), NEXT_DIST_DIR: '.next-e2e', NEXT_TYPESCRIPT_CONFIG: 'tsconfig.e2e.json',
        REDIS_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
        NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: 'false', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '',
        NEXT_PUBLIC_BASE_URL: `http://127.0.0.1:${port}`, NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
        BLOB_READ_WRITE_TOKEN: '', AWS_ACCESS_KEY_ID: '', AWS_SECRET_ACCESS_KEY: '',
        CHALLONGE_API_KEY: '', CLOUDFLARE_R2_ACCESS_KEY_ID: '', CLOUDFLARE_R2_SECRET_ACCESS_KEY: '',
        CLOUDFLARE_R2_ACCOUNT_ID: '', CLOUDFLARE_R2_BUCKET_NAME: '', CLOUDFLARE_R2_PUBLIC_URL: '',
    };
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', String(port)], { env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32', shell: false });
    const log = fs.createWriteStream('test-results/e2e-server.log', { flags: 'w' });
    server.stdout.pipe(log); server.stderr.pipe(log);
    server.once('error', error => { console.error(error.message); });
    let ready = false;
    for (let i = 0; i < 120; i++) {
        if (server.exitCode !== null) throw new Error('Test server exited. See test-results/e2e-server.log.');
        try { ready = (await fetch(`${env.TEST_BASE_URL}/api/health`, { signal: AbortSignal.timeout(2000) })).ok; } catch { /* waiting for compilation */ }
        if (ready) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!ready) throw new Error('Test server did not become ready. See test-results/e2e-server.log.');
    console.log(`Running ${ui ? 'UI-only' : 'isolated migration'} E2E at ${env.TEST_BASE_URL}. ${live ? 'Live Challonge enabled.' : 'No external tournament writes.'}`);
    const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '-c', 'playwright.migration.config.ts', ...(live ? ['challonge-live.spec.ts', '--project=desktop'] : ui ? ['public-ui.spec.ts'] : []), ...args], { env, stdio: 'inherit', shell: false });
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => resolve(code ?? 1)); });
    process.exitCode = Number(code);
}
fs.mkdirSync('test-results', { recursive: true });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void stop().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143)); });
try { await main(); } catch (error) { console.error(`[migration-e2e] ${error.message}`); process.exitCode = 1; }
finally { try { await stop(); } catch (error) { console.error(`[migration-e2e] Teardown failed: ${error.message}`); process.exitCode = 1; } }

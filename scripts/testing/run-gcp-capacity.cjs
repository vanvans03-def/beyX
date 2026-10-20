const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

async function main() {
  const config = process.env.GCP_VM_CAPACITY === '1'
    ? (() => {
      const vm = dotenv.parse(fs.readFileSync('.env.gcp-data'));
      if (vm.LOCAL_POSTGRES_DB !== 'beyx_rehearsal') throw new Error('Expected rehearsal VM settings.');
      return { E2E_DATABASE_URL: `postgresql://beyx_app:${vm.LOCAL_POSTGRES_APP_PASSWORD}@10.42.0.10:5432/beyx_rehearsal` };
    })()
    : dotenv.parse(fs.readFileSync('backups/gcp/private/e2e.env'));
  const baseURL = 'https://beyx-rehearsal-638873004771.us-central1.run.app';
  const db = new Pool({ connectionString: config.E2E_DATABASE_URL, max: 2, connectionTimeoutMillis: 15000 });
  const id = randomUUID(), username = `gcpperf${id.replaceAll('-', '')}`;
  let inserted = false;
  try {
    const actual = (await db.query('SELECT current_database() AS name')).rows[0].name;
    if (actual !== 'beyx_rehearsal') throw new Error('Refusing capacity writes outside GCP rehearsal.');
    const password = randomUUID();
    await db.query(`INSERT INTO users(id,username,password_hash,shop_name,email,role,event_mode_enabled,internal_bracket_enabled)
      VALUES($1,$2,$3,$2,$4,'user',true,true)`, [id, username, await bcrypt.hash(password, 10), `${username}@example.invalid`]);
    inserted = true;
    const blades = (await db.query("SELECT name, points_standard FROM beyblades WHERE type IN ('BX','UX') AND NOT coalesce(is_banned,false) AND points_standard BETWEEN 0 AND 3 ORDER BY points_standard, name LIMIT 3")).rows;
    if (blades.length !== 3) throw new Error('Need three actual catalog blades whose total is at most ten.');
    const login = await fetch(`${baseURL}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }), signal: AbortSignal.timeout(60000) });
    if (!login.ok) throw new Error(`Staging login failed: HTTP ${login.status}`);
    const session = login.headers.getSetCookie().find(value => value.startsWith('session='))?.split(';')[0].slice(8);
    if (!session) throw new Error('Staging login did not set a session.');
    console.log('Starting GCP staging capacity test: 3 real catalog blades, U10, 25 concurrent writes, 300 registrations/viewers, 10 administrators.');
    const child = spawn(process.execPath, ['scripts/testing/prod-neon-capacity.mjs'], { stdio: 'inherit', shell: false,
      env: { ...process.env, TEST_BASE_URL: baseURL, TEST_SESSION_COOKIE: session, TEST_PUBLIC_SHOP: username,
        TEST_SKIP_PLAYWRIGHT: '1', PERF_TOURNAMENT_TYPE: 'U10', PERF_REGISTRATION_MODE: 'Under10',
        PERF_MAIN_BEYS_JSON: JSON.stringify(blades.map(blade => blade.name)), PERF_PLAYER_PREFIX: `${username} P`,
        PERF_REPORT_PATH: 'performance-results/gcp-capacity.json' } });
    process.exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', code => resolve(code ?? 1)); });
  } finally {
    if (inserted) {
      const remaining = await db.query('SELECT id FROM tournaments WHERE user_id=$1', [id]);
      if (remaining.rows.length) {
        console.error('Capacity fixture cleanup incomplete; retaining test account for investigation.');
        process.exitCode = 1;
      } else await db.query('DELETE FROM users WHERE id=$1', [id]);
    }
    await db.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

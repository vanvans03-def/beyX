const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { spawn } = require('child_process');
const dotenv = require('dotenv');
const { Pool } = require('pg');

const rootDir = path.resolve(__dirname, '..', '..');
const localDbEnvPath = path.join(rootDir, '.env.local-db');
const rehearsalDatabase = process.env.REHEARSAL_DATABASE;

if (!rehearsalDatabase || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(rehearsalDatabase)) {
  console.error('[POSTGRES TEST] Set REHEARSAL_DATABASE to the exact rehearsal database name.');
  process.exit(2);
}
if (!fs.existsSync(localDbEnvPath)) {
  console.error('[POSTGRES TEST] Missing .env.local-db. Run npm run setup:local-db-env first.');
  process.exit(2);
}

const localDb = dotenv.parse(fs.readFileSync(localDbEnvPath));
const user = 'beyx_app';
const password = localDb.LOCAL_POSTGRES_APP_PASSWORD;
const port = localDb.LOCAL_POSTGRES_PORT || '5432';
if (!password) {
  console.error('[POSTGRES TEST] LOCAL_POSTGRES_APP_PASSWORD is missing.');
  process.exit(2);
}

const databaseUrl = new URL('postgresql://127.0.0.1');
databaseUrl.username = user;
databaseUrl.password = password;
databaseUrl.port = port;
databaseUrl.pathname = `/${rehearsalDatabase}`;

async function main() {
  const sessionSecret = localDb.APP_SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    console.error('[POSTGRES TEST] APP_SESSION_SECRET must contain at least 32 characters.');
    process.exit(2);
  }

  const pool = new Pool({ connectionString: databaseUrl.toString(), max: 2 });
  const fixtureTag = crypto.randomUUID().replace(/-/g, '');
  const userId = crypto.randomUUID();
  const shopName = `codex${fixtureTag.slice(0, 10)}`;
  const tournamentIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  let child;

  const cleanup = async () => {
    try {
      await pool.query('DELETE FROM public.tournaments WHERE id = ANY($1::uuid[])', [tournamentIds]);
      await pool.query('DELETE FROM public.users WHERE id = $1', [userId]);
    } finally {
      await pool.end();
    }
  };

  try {
    await pool.query(
      `INSERT INTO public.users (id, username, password_hash, email, shop_name, role)
       VALUES ($1, $2, $3, $4, $5, 'user')`,
      [userId, shopName, '$2b$10$abcdefghijklmnopqrstuu7T8WnHaoPpfFj5N5YpL8p5xF8Qxw7pG', `${shopName}@example.invalid`, shopName],
    );
    const types = ['NoMoreMeta', 'U10', 'U10Custom', 'Open'];
    for (let index = 0; index < tournamentIds.length; index += 1) {
      await pool.query(
        `INSERT INTO public.tournaments (id, name, status, type, ban_list, user_id, provider, bracket_type, settings)
         VALUES ($1, $2, 'OPEN', $3, ARRAY[]::text[], $4, 'INTERNAL', 'SINGLE', '{}'::jsonb)`,
        [tournamentIds[index], `Codex fixture ${types[index]}`, types[index], userId],
      );
    }

    const { SignJWT } = await import('jose');
    const session = await new SignJWT({ userId, username: shopName, role: 'user' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('beyx')
      .setAudience('beyx-web')
      .setSubject(userId)
      .setJti(crypto.randomUUID())
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(sessionSecret));

    const harness = path.join(rootDir, 'scripts', 'testing', 'test-server-harness.cjs');
    child = spawn(process.execPath, [harness, ...process.argv.slice(2)], {
      cwd: rootDir,
      stdio: 'inherit',
      shell: false,
      env: {
        ...process.env,
        DATA_BACKEND: 'postgres',
        AUTH_BACKEND: 'local',
        REALTIME_BACKEND: 'postgres',
        DATABASE_URL: databaseUrl.toString(),
        DATABASE_SSL: 'disable',
        APP_SESSION_SECRET: sessionSecret,
        TEST_WORKERS: process.env.TEST_WORKERS || '2',
        TEST_SESSION_COOKIE: session,
        TEST_ORGANIZER_TOURNAMENT_ID: tournamentIds[0],
        TEST_TOURNAMENT_NMM_ID: tournamentIds[0],
        TEST_TOURNAMENT_U10_ID: tournamentIds[1],
        TEST_TOURNAMENT_U10CUSTOM_ID: tournamentIds[2],
        TEST_BUCKET_TOURNAMENT_ID: tournamentIds[3],
        TEST_BUCKET_PATH: `/${shopName}/${tournamentIds[3].replace(/-/g, '').slice(-8)}`,
        TEST_REALTIME_TOURNAMENT_ID: tournamentIds[3],
      },
    });

    const exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code) => resolve(code ?? 1));
    });
    await cleanup();
    process.exit(exitCode);
  } catch (error) {
    console.error(`[POSTGRES TEST] ${error.message}`);
    if (child && child.exitCode === null) child.kill('SIGTERM');
    await cleanup().catch((cleanupError) => console.error(`[POSTGRES TEST] Cleanup failed: ${cleanupError.message}`));
    process.exit(1);
  }
}

main();

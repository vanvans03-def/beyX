import { expect, test } from '@playwright/test';
import { Pool } from 'pg';

test('PostgreSQL NOTIFY reaches the browser over SSE', async ({ page }) => {
  const tournamentId = process.env.TEST_REALTIME_TOURNAMENT_ID;
  const databaseUrl = process.env.DATABASE_URL;
  test.skip(!tournamentId || !databaseUrl, 'PostgreSQL realtime fixture is not configured');

  await page.goto('/');
  await page.evaluate(() => { (window as any).__beyxSseReady = false; });
  const received = page.evaluate((id) => new Promise<Record<string, string>>((resolve, reject) => {
    const timeout = window.setTimeout(() => { events.close(); reject(new Error('SSE timeout')); }, 10_000);
    const events = new EventSource(`/api/realtime/tournaments/${encodeURIComponent(id)}`);
    events.addEventListener('ready', () => { (window as any).__beyxSseReady = true; });
    events.addEventListener('tournament-update', (message) => {
      window.clearTimeout(timeout);
      events.close();
      resolve(JSON.parse((message as MessageEvent).data));
    });
  }), tournamentId!);

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    await expect.poll(() => page.evaluate(() => (window as any).__beyxSseReady), { timeout: 10_000 }).toBe(true);
    await pool.query('UPDATE public.tournaments SET status = status WHERE id = $1', [tournamentId]);
    await expect(received).resolves.toMatchObject({ tournamentId, table: 'tournaments', operation: 'UPDATE' });
  } finally {
    await pool.end();
  }
});

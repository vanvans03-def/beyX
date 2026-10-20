import { test, expect, generate } from '../migration/support/fixture';

test('public bracket reconnects and reconciles after an SSE stream closes', async ({ lab, page }) => {
  const id = await lab.tournament(); await lab.players(id, 4); await generate(lab, id);
  let streams = 0, snapshots = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname === `/api/public/tournaments/${id}/matches`) snapshots++;
  });
  await page.route(`**/api/realtime/tournaments/${id}`, async route => {
    streams++;
    if (streams === 1) {
      // Emulate the bounded stream lifetime: ready, then clean EOF.
      await route.fulfill({ status: 200, contentType: 'text/event-stream',
        body: 'retry: 100\nevent: ready\ndata: {}\n\n' });
    } else await route.continue();
  });
  await page.goto(`/${lab.organizer.shop}/${id}`);
  await expect.poll(() => streams).toBeGreaterThanOrEqual(2);
  await expect.poll(() => snapshots).toBeGreaterThanOrEqual(2);
  await expect(page.locator('body')).not.toContainText('Unknown Player');
  const match = (await lab.matches(id)).find(value => value.state === 'OPEN')!;
  // A browser reload after reconnect must recover the persisted latest score too.
  await lab.score(id, match);
  const update = page.waitForResponse(response => new URL(response.url()).pathname === `/api/public/tournaments/${id}/matches`);
  await page.reload();
  expect((await (await update).json()).matches.find((value: { id: string }) => value.id === match.id).winner_id).toBe(match.player1_id);
  await expect(page.locator('body')).not.toContainText('Application error');
});

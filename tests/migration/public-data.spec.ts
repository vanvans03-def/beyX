import { test, expect, jsonOK, generate, finish } from './support/fixture';

test('shared registration/players/matches/standings and public ranking readers', async ({ lab, request, page }) => {
    const id = await lab.tournament(); await lab.players(id, 4); await generate(lab, id); await finish(lab, id);
    await jsonOK(await lab.organizer.api.patch('/api/admin/tournaments', { data: { tournamentId: id, status: 'CLOSED' } }));
    for (const path of [`/api/public/tournaments/${id}`, `/api/public/tournaments/${id}/registrations`, `/api/public/tournaments/${id}/matches`, `/api/public/tournaments/${id}/standings`, `/api/admin/tournaments/${id}/standings`]) {
        const api = path.startsWith('/api/admin') ? lab.organizer.api : request;
        await jsonOK(await api.get(path));
    }
    const players = (await lab.db.query('SELECT DISTINCT player_id FROM public.tournament_results WHERE tournament_id=$1', [id])).rows;
    for (const player of players) {
        await jsonOK(await request.get(`/api/public/players/${player.player_id}/history`));
        await jsonOK(await lab.superadmin.api.get(`/api/admin/players/${player.player_id}/history`));
    }
    for (const path of ['/api/public/rankings', '/api/public/rankings/badges', `/api/public/players/suggestions?q=${lab.tag}`, '/api/public/live-matches']) await jsonOK(await request.get(path));
    for (const path of ['/rankings', `/${lab.organizer.shop}/${id.replaceAll('-', '').slice(-8)}`, `/register/${id}`]) {
        expect((await page.goto(path))?.status()).toBe(200);
        await expect(page.locator('body')).not.toContainText('Application error');
    }
    await page.goto('/unknown-shop/00000000'); await expect(page.getByText('Tournament not found', { exact: true })).toBeVisible();
});

test('proxy and external-provider validation rejects unsafe or incomplete requests', async ({ request }) => {
    for (const url of ['', 'not-a-url', 'http://127.0.0.1/private', 'https://example.com/image.png']) expect((await request.get(`/api/image-proxy?url=${encodeURIComponent(url)}`)).status()).toBe(400);
    expect((await request.get('/api/tts')).status()).toBe(400);
    expect((await request.post('/api/upload')).status()).toBe(400);
    expect((await request.post('/api/migrate-password', { data: {} })).status()).toBe(400);
    expect((await request.get('/api/setup-db')).status()).toBe(200);
    const google = await request.get('/api/auth/google', { maxRedirects: 0 }); expect(google.status()).toBe(307); expect(google.headers().location).toContain('oauth_unavailable');
    const callback = await request.get('/api/auth/callback?code=fake&state=fake', { maxRedirects: 0 }); expect(callback.status()).toBe(307); expect(callback.headers().location).toContain('oauth_failed');
    const og = await request.get('/api/og'); expect(og.status()).toBe(200); expect(og.headers()['content-type']).toContain('image/png');
});

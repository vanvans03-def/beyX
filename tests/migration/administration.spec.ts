import { randomUUID } from 'node:crypto';
import { test, expect, jsonOK, generate, finish } from './support/fixture';

test('login UI, logout, invalid password, profile and password change', async ({ lab, page, request }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Enter username').fill(lab.organizer.username);
    await page.locator('input[type="password"]').fill(lab.organizer.password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    expect((await request.post('/api/auth/login', { data: { username: lab.organizer.username, password: 'wrong-password' } })).status()).toBe(401);
    expect((await lab.organizer.api.patch('/api/admin/profile', { data: { shop_name: 'invalid shop !' } })).status()).toBe(400);
    expect((await lab.organizer.api.patch('/api/admin/profile', { data: { email: 'invalid' } })).status()).toBe(400);
    await jsonOK(await lab.organizer.api.patch('/api/admin/profile', { data: { music_volume: 0.2, tts_volume: 0.4 } }));
    expect((await jsonOK(await lab.organizer.api.get('/api/admin/profile'))).user).toMatchObject({ music_volume: 0.2, tts_volume: 0.4 });
    expect((await lab.organizer.api.post('/api/admin/profile/password', { data: { currentPassword: 'wrong', newPassword: 'new-password' } })).status()).toBe(400);
    await jsonOK(await lab.organizer.api.post('/api/admin/profile/password', { data: { currentPassword: lab.organizer.password, newPassword: `${lab.tag}Changed!` } }));
    await jsonOK(await lab.organizer.api.post('/api/auth/logout'));
    expect((await lab.organizer.api.get('/api/admin/profile')).status()).toBe(401);
    expect((await lab.organizer.api.post('/api/auth/login', { data: { username: lab.organizer.username, password: lab.organizer.password } })).status()).toBe(401);
    await jsonOK(await lab.organizer.api.post('/api/auth/login', { data: { username: lab.organizer.username.toUpperCase(), password: `${lab.tag}Changed!` } }));
});

test('superadmin menus render, user feature flags persist and forbidden catalog writes fail', async ({ lab, page }) => {
    await page.context().addCookies((await lab.superadmin.api.storageState()).cookies);
    for (const route of ['/admin', '/admin/users', '/admin/users/create', '/admin/beyblades', '/admin/players']) {
        const response = await page.goto(route); expect(response?.status()).toBe(200);
        await expect(page.locator('body')).not.toContainText('Application error');
        await expect(page).not.toHaveURL(/\/login$/);
    }
    const users = await jsonOK(await lab.superadmin.api.get('/api/admin/users/manage'));
    expect(users.users.some((u: { id: string }) => u.id === lab.organizer.id)).toBe(true);
    for (const flag of ['event_mode_enabled', 'music_enabled', 'tts_enabled', 'challonge_enabled', 'internal_bracket_enabled']) {
        await jsonOK(await lab.superadmin.api.patch('/api/admin/users/manage', { data: { userId: lab.organizer.id, [flag]: false } }));
        expect((await jsonOK(await lab.superadmin.api.get('/api/admin/users/manage'))).users.find((u: { id: string }) => u.id === lab.organizer.id)[flag]).toBe(false);
        await jsonOK(await lab.superadmin.api.patch('/api/admin/users/manage', { data: { userId: lab.organizer.id, [flag]: true } }));
    }
    for (const route of ['/api/admin/users/manage', '/api/admin/players', '/api/admin/rankings/tournaments']) expect((await lab.organizer.api.get(route)).status()).toBe(403);
    for (const method of ['post', 'patch', 'delete'] as const) expect((await lab.organizer.api[method]('/api/admin/beyblades', { data: {} })).status()).toBe(403);
    expect((await lab.organizer.api.patch('/api/admin/cx-attachments', { data: { key: 'Heavy', image_url: '/test.png' } })).status()).toBe(403);
});

test('catalog CRUD and organizer event CRUD are persisted through public APIs', async ({ lab, request, page }) => {
    const blade = (await jsonOK(await lab.superadmin.api.post('/api/admin/beyblades', { data: { name: `${lab.tag} Catalog`, image_url: '/bey-x-logo-circle.png', points_standard: 2, type: 'BX' } }))).beyblade;
    await jsonOK(await lab.superadmin.api.patch('/api/admin/beyblades', { data: { id: blade.id, points_standard: 4, is_banned: true } }));
    expect((await jsonOK(await lab.superadmin.api.get('/api/admin/beyblades'))).beyblades.find((b: { id: string }) => b.id === blade.id)).toMatchObject({ points_standard: 4, is_banned: true });
    await jsonOK(await lab.superadmin.api.delete(`/api/admin/beyblades?id=${blade.id}`));
    expect((await jsonOK(await lab.superadmin.api.get('/api/admin/beyblades'))).beyblades.some((b: { id: string }) => b.id === blade.id)).toBe(false);
    const event = (await jsonOK(await lab.organizer.api.post('/api/admin/events', { data: { title: `${lab.tag} Event`, date: '2030-01-01T10:00:00Z', location: 'Test venue', description: 'E2E fixture' } }))).data;
    await jsonOK(await lab.organizer.api.put('/api/admin/events', { data: { id: event.id, title: `${lab.tag} Updated`, date: '2030-01-02T10:00:00Z', location: 'Updated venue' } }));
    await page.goto(`/events?id=${event.id}`); await expect(page.locator('body')).toContainText(`${lab.tag} Updated`);
    await jsonOK(await lab.organizer.api.delete(`/api/admin/events?id=${event.id}`));
    expect((await jsonOK(await lab.organizer.api.get('/api/admin/events'))).data.some((e: { id: string }) => e.id === event.id)).toBe(false);
    const key = `${lab.tag}setting`;
    await jsonOK(await lab.superadmin.api.post('/api/settings', { data: { key, value: false } }));
    expect((await jsonOK(await request.get(`/api/settings?key=${key}`))).value).toBe(false);
});

test('ranking merge preserves names/points/history, rename and split persist', async ({ lab, page, request }) => {
    const first = await lab.tournament(), second = await lab.tournament();
    const p1 = randomUUID(), p2 = randomUUID();
    for (const [id, suffix] of [[p1, 'Primary'], [p2, 'Alias']]) {
        await lab.db.query('INSERT INTO public.players(id,display_name) VALUES ($1,$2)', [id, `${lab.tag} ${suffix}`]);
        await lab.db.query('INSERT INTO public.player_aliases(player_id,alias_name,normalized_name) VALUES($1,$2,$3)', [id, `${lab.tag} ${suffix}`, `${lab.tag} ${suffix}`.toLowerCase()]);
    }
    for (const [t, p, points] of [[first, p1, 5], [second, p2, 3]]) await lab.db.query("INSERT INTO public.tournament_results(tournament_id,player_id,placement,points,source,tournament_completed_at,player_name_at_award) VALUES($1,$2,1,$3,'MANUAL',now(),$4)", [t, p, points, `${lab.tag} historical`]);
    await page.context().addCookies((await lab.superadmin.api.storageState()).cookies);
    await page.goto('/admin/players');
    await page.locator('input').first().fill(lab.tag);
    await page.locator('input').first().press('Enter');
    // Use the actual selection buttons and submit the merge from the browser.
    const primary = page.getByRole('button').filter({ hasText: `${lab.tag} Primary` }).first();
    const alias = page.getByRole('button').filter({ hasText: `${lab.tag} Alias` }).first();
    await expect(primary).toBeVisible(); await primary.click({ position: { x: 5, y: 5 } }); await alias.click({ position: { x: 5, y: 5 } });
    await page.getByRole('button', { name: 'รวมชื่อและคะแนน', exact: true }).click();
    await expect(page.getByText('รวมชื่อและคะแนนเข้าชื่อหลักแล้ว', { exact: true })).toBeVisible();
    const total = await lab.db.query('SELECT total_points FROM public.player_ranking_totals WHERE player_id=$1', [p1]); expect(total.rows[0].total_points).toBe(8);
    expect((await lab.db.query('SELECT id FROM public.players WHERE id=$1', [p2])).rows).toHaveLength(0);
    const history = await jsonOK(await lab.superadmin.api.get(`/api/admin/players/${p1}/history`)); expect(history.groups.flatMap((g: { results: unknown[] }) => g.results)).toHaveLength(2);
    await jsonOK(await lab.superadmin.api.patch('/api/admin/players', { data: { action: 'rename', playerId: p1, displayName: `${lab.tag} Renamed` } }));
    await jsonOK(await lab.superadmin.api.patch('/api/admin/players', { data: { action: 'split_result', playerId: p1, tournamentId: second, displayName: `${lab.tag} Split` } }));
    expect((await lab.db.query('SELECT total_points FROM public.player_ranking_totals WHERE player_id=$1', [p1])).rows[0].total_points).toBe(5);
    expect((await request.get('/api/public/rankings')).status()).toBe(200);
});

test('organizer approval and tournament ranking exclusion round-trip', async ({ lab }) => {
    const id = await lab.tournament(); await lab.players(id, 4); await generate(lab, id); await finish(lab, id);
    await jsonOK(await lab.organizer.api.patch('/api/admin/tournaments', { data: { tournamentId: id, status: 'CLOSED' } }));
    for (const excluded of [true, false]) {
        await jsonOK(await lab.superadmin.api.patch('/api/admin/rankings/tournaments', { data: { tournamentId: id, excluded } }));
        expect((await jsonOK(await lab.superadmin.api.get('/api/admin/rankings/tournaments'))).tournaments.find((t: { id: string }) => t.id === id).is_excluded_from_rankings).toBe(excluded);
    }
    for (const enabled of [false, true]) await jsonOK(await lab.superadmin.api.patch('/api/admin/rankings/tournaments', { data: { action: 'set_organizer_enabled', organizerId: lab.organizer.id, enabled } }));
});

test('superadmin creates organizer, duplicate name is rejected and password reset works', async ({ lab, playwright, baseURL }) => {
    const username = `${lab.tag}Created`, password = `${lab.tag}Initial!`, replacement = `${lab.tag}Reset!`;
    const payload = { username, password, challongeApiKey: 'e2e-placeholder-not-a-real-key', shopName: username };
    await jsonOK(await lab.superadmin.api.post('/api/admin/users', { data: payload }));
    expect((await lab.superadmin.api.post('/api/admin/users', { data: payload })).status()).toBe(400);
    await jsonOK(await lab.superadmin.api.put('/api/admin/users', { data: { username, newPassword: replacement } }));
    const api = await playwright.request.newContext({ baseURL, ignoreHTTPSErrors: baseURL === 'https://127.0.0.1:3346' && process.env.E2E_LOCAL_TLS === '1' });
    try {
        expect((await api.post('/api/auth/login', { data: { username, password } })).status()).toBe(401);
        await jsonOK(await api.post('/api/auth/login', { data: { username, password: replacement } }));
        expect((await jsonOK(await api.get('/api/admin/profile'))).user.username).toBe(username);
    } finally { await api.dispose(); }
});

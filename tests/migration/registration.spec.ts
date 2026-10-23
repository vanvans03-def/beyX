import { randomUUID } from 'node:crypto';
import { test, expect, jsonOK, generate } from './support/fixture';

for (const [type, mode] of [['Open', 'Standard'], ['U10', 'Under10'], ['U10Custom', 'Under10Custom'], ['NoMoreMeta', 'NoMoreMeta']]) {
    test(`${type}: public registration persists, updates, validates duplicates and closes after start`, async ({ lab, request, page }) => {
        const id = await lab.tournament(type);
        for (let index = 0; index < 3; index++) await jsonOK(await lab.superadmin.api.post('/api/admin/beyblades', { data: { name: `${lab.tag} Blade${index}`, image_url: '/bey-x-logo-circle.png', points_standard: 1, type: 'BX' } }));
        const mainBeys = [0, 1, 2].map(i => `${lab.tag} Blade${i}`);
        const payload = { tournamentId: id, playerName: `${lab.tag} Registrant`, deviceUUID: randomUUID(), mode, mainBeys };
        const config = await jsonOK(await request.get(`/api/register/config?tournamentId=${id}`));
        expect(config.success).toBe(true); expect(config.beyblades.some((b: { name: string }) => b.name === mainBeys[0])).toBe(true);
        await page.goto(`/register/${id}`); await expect(page.locator('input[type="text"]').first()).toBeVisible();
        await page.locator('input[type="text"]').first().fill(payload.playerName);
        // Open is intentionally name-only; only restricted formats expose deck slots.
        if (type === 'Open') await expect(page.getByTestId('blade-slot-0')).toHaveCount(0);
        for (let i = 0; type !== 'Open' && i < mainBeys.length; i++) {
            await page.getByTestId(`blade-slot-${i}`).click();
            await page.getByPlaceholder('Search Blade...').fill(mainBeys[i]);
            await page.getByRole('button').filter({ hasText: mainBeys[i] }).last().click();
        }
        const [submitted] = await Promise.all([
            page.waitForResponse(response => response.url().endsWith('/api/register') && response.request().method() === 'POST', { timeout: 60_000 }),
            page.getByRole('button', { name: 'ยืนยันการลงทะเบียน', exact: true }).click(),
        ]);
        await jsonOK(submitted);
        // Browser owns its generated device ID. Reuse it for update/ownership checks.
        const actual = await lab.db.query('SELECT device_uuid FROM public.registrations WHERE tournament_id=$1 AND player_name=$2', [id, payload.playerName]);
        expect(actual.rows).toHaveLength(1); payload.deviceUUID = actual.rows[0].device_uuid;
        await jsonOK(await request.post('/api/register', { data: { ...payload, mainBeys: [...mainBeys].reverse() } }));
        const rows = await jsonOK(await request.get(`/api/register?tournamentId=${id}&deviceUUID=${payload.deviceUUID}`));
        expect(rows.data).toHaveLength(1); expect(rows.data[0].main_deck).toEqual([...mainBeys].reverse());
        const names = await jsonOK(await request.get(`/api/register?tournamentId=${id}&checkName=${encodeURIComponent(payload.playerName)}`)); expect(names.exists).toBe(true);
        const missingDeck = await request.post('/api/register', { data: { ...payload, mainBeys: [] } }); expect(missingDeck.ok()).toBe(false);
        const duplicatedParts = await request.post('/api/register', { data: { ...payload, mainBeys: mainBeys.map(name => `${name}|||same-ratchet|same-bit`) } }); expect(duplicatedParts.status()).toBe(400);
        await lab.players(id, 2); await generate(lab, id);
        expect((await request.post('/api/register', { data: { ...payload, playerName: `${lab.tag} Late` } })).status()).toBe(400);
        expect((await request.post('/api/register', { data: { ...payload, deviceUUID: randomUUID() } })).status()).toBe(403);
    });
}

test('Under10 rejects over ten points, NMM rejects bans, owner custom points affect config', async ({ lab, request }) => {
    const ids: string[] = [], names: string[] = [];
    for (let i = 0; i < 3; i++) {
        const name = `${lab.tag} Expensive${i}`; names.push(name);
        ids.push((await jsonOK(await lab.superadmin.api.post('/api/admin/beyblades', { data: { name, image_url: '/bey-x-logo-circle.png', points_standard: 5, is_banned: i === 0, type: 'BX' } }))).beyblade.id);
    }
    for (const [type, mode] of [['U10', 'Under10'], ['NoMoreMeta', 'NoMoreMeta']]) {
        const id = await lab.tournament(type);
        expect((await request.post('/api/register', { data: { tournamentId: id, playerName: `${lab.tag} Invalid`, deviceUUID: randomUUID(), mode, mainBeys: names } })).status()).toBe(400);
    }
    const custom = await lab.tournament('U10Custom');
    await jsonOK(await lab.organizer.api.post('/api/admin/profile/beyblades', { data: { updates: ids.map(id => ({ beyblade_id: id, points_standard: 1, is_banned: false })), cx_enabled: false } }));
    await jsonOK(await request.post('/api/register', { data: { tournamentId: custom, playerName: `${lab.tag} Custom`, deviceUUID: randomUUID(), mode: 'Under10Custom', mainBeys: names } }));
    const overrides = await jsonOK(await lab.organizer.api.get('/api/admin/profile/beyblades'));
    expect(overrides.cx_enabled).toBe(false);
    expect(overrides.beyblades.find((b: { id: string }) => b.id === ids[0]).custom_points_standard).toBe(1);
    await jsonOK(await lab.organizer.api.post('/api/admin/profile/beyblades', { data: ids.map(id => ({ beyblade_id: id, points_standard: null, is_banned: null })) }));
    expect((await jsonOK(await lab.organizer.api.get('/api/admin/profile/beyblades'))).beyblades.find((b: { id: string }) => b.id === ids[0]).custom_points_standard).toBeNull();
});

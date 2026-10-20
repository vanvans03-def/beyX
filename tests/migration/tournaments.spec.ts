import { test, expect, jsonOK, generate, finish } from './support/fixture';

for (const bracket of ['SINGLE', 'DOUBLE']) for (const count of [2, 3, 4, 5, 8, 9, 16]) for (const reset of bracket === 'DOUBLE' ? [false, true] : [false]) {
    test(`${bracket} ${count} entrants ${reset ? 'grand final reset' : 'normal final'}: persistence, progression, standings, close and reset`, async ({ lab, request, page }, info) => {
        test.setTimeout(300_000);
        const id = await lab.tournament('Open', bracket);
        const names = await lab.players(id, count);
        await generate(lab, id);
        const initial = await lab.matches(id);
        expect(initial.length).toBeGreaterThan(0);
        const ready = initial.filter(m => m.state === 'OPEN');
        expect(ready.length).toBeGreaterThan(0);
        expect(ready.every(m => m.player1_id && m.player2_id && m.player1_id !== m.player2_id)).toBe(true);
        const saved = await lab.db.query('SELECT count(*)::integer AS n FROM public.internal_matches WHERE tournament_id=$1', [id]);
        expect(saved.rows[0].n).toBe(initial.length);
        const publicData = await jsonOK(await request.get(`/api/public/tournaments/${id}?shopName=${lab.organizer.shop}`));
        expect(publicData.tournament.name).toContain(lab.tag);
        const played = await finish(lab, id, reset);
        expect(played.played).toBe(bracket === 'SINGLE' ? count - 1 : 2 * count - (reset ? 1 : 2));
        expect(played.resetPlayed).toBe(reset);
        const lossCount = new Map<string, number>();
        for (const match of played.matches.filter(m => m.state === 'COMPLETE' && !m.scores_csv.includes('BYE'))) {
            const loser = match.winner_id === match.player1_id ? match.player2_id! : match.player1_id!;
            lossCount.set(loser, (lossCount.get(loser) || 0) + 1);
            expect(lossCount.get(loser)).toBeLessThanOrEqual(bracket === 'SINGLE' ? 1 : 2);
        }
        const standings = await jsonOK(await request.get(`/api/public/tournaments/${id}/standings`));
        expect(standings.data.length).toBe(count);
        expect(standings.data[0].name).toBe(names[0]);
        const state = await lab.organizer.api.storageState();
        await page.context().addCookies(state.cookies);
        await page.goto(`/admin/tournament/${id}`);
        await expect(page.locator('body')).toContainText(lab.tag);
        await page.goto(`/${lab.organizer.shop}/${id.replaceAll('-', '').slice(-8)}`);
        await expect(page.locator('body')).toContainText(lab.tag);
        await jsonOK(await lab.organizer.api.patch('/api/admin/tournaments', { data: { tournamentId: id, status: 'CLOSED' } }));
        const ledger = await lab.db.query('SELECT points FROM public.tournament_results WHERE tournament_id=$1 ORDER BY placement', [id]);
        expect(ledger.rows.map(row => row.points)).toEqual([5, 3, 2, 1].slice(0, Math.min(count, 4)));
        await jsonOK(await lab.organizer.api.patch('/api/admin/tournaments', { data: { tournamentId: id, status: 'CLOSED' } }));
        expect((await lab.db.query('SELECT count(*)::integer AS n FROM public.tournament_results WHERE tournament_id=$1', [id])).rows[0].n).toBe(Math.min(count, 4));
        await info.attach('final-bracket.json', { body: JSON.stringify(played.matches, null, 2), contentType: 'application/json' });
        await jsonOK(await lab.organizer.api.post('/api/admin/tournaments/reset', { data: { tournamentId: id } }));
        expect(await lab.matches(id)).toHaveLength(0);
    });
}

test('registration administration: duplicate, rename, seeding order and delete', async ({ lab }) => {
    const id = await lab.tournament();
    const names = await lab.players(id, 4);
    expect((await lab.organizer.api.post('/api/admin/registrations', { data: { tournamentId: id, players: [names[0].toUpperCase()], mode: 'Standard' } })).status()).toBe(400);
    expect((await lab.organizer.api.post('/api/admin/registrations', { data: { tournamentId: id, players: ['Duplicate', 'duplicate'], mode: 'Standard' } })).status()).toBe(400);
    const regs = (await jsonOK(await lab.organizer.api.get(`/api/admin/registrations?tournamentId=${id}`))).data;
    await jsonOK(await lab.organizer.api.patch('/api/admin/registrations', { data: { id: regs[0].id, player_name: `${lab.tag} Renamed` } }));
    const order = [...names].reverse();
    await jsonOK(await lab.organizer.api.post('/api/admin/tournaments/order', { data: { tournamentId: id, order } }));
    expect((await jsonOK(await lab.organizer.api.get(`/api/admin/tournaments/order?tournamentId=${id}`))).order).toEqual(order);
    await jsonOK(await lab.organizer.api.delete(`/api/admin/tournaments/order?tournamentId=${id}`));
    await jsonOK(await lab.organizer.api.delete('/api/admin/registrations', { data: { id: regs[0].id } }));
    expect((await jsonOK(await lab.organizer.api.get(`/api/admin/registrations?tournamentId=${id}`))).data).toHaveLength(3);
});

test('judge lock/unlock and concurrent independent score writes preserve both results', async ({ lab, request }) => {
    const id = await lab.tournament(); await lab.players(id, 8); await generate(lab, id);
    const open = (await lab.matches(id)).filter(m => m.state === 'OPEN');
    await jsonOK(await lab.organizer.api.post('/api/admin/match-locks', { data: { tournamentId: id, matchId: open[0].id, action: 'lock', arenaId: 1 } }));
    expect((await jsonOK(await lab.organizer.api.get(`/api/admin/match-locks?tournamentId=${id}`))).locks).toEqual(expect.arrayContaining([expect.objectContaining({ match_id: open[0].id })]));
    await Promise.all(open.slice(0, 2).map(match => lab.score(id, match)));
    const stored = await lab.matches(id);
    for (const match of open.slice(0, 2)) expect(stored.find(row => row.id === match.id)?.winner_id).toBe(match.player1_id);
    const shared = await jsonOK(await request.get(`/api/public/tournaments/${id}/matches`));
    for (const match of open.slice(0, 2)) expect(shared.matches.find((row: { id: string }) => row.id === match.id).winner_id).toBe(match.player1_id);
    await jsonOK(await lab.organizer.api.post('/api/admin/match-locks', { data: { tournamentId: id, matchId: open[0].id, action: 'unlock' } }));
    expect((await jsonOK(await lab.organizer.api.get(`/api/admin/match-locks?tournamentId=${id}`))).locks).toHaveLength(0);
});

test('correcting a completed result clears dependent results and survives reloading', async ({ lab }) => {
    const id = await lab.tournament(); await lab.players(id, 8); await generate(lab, id);
    const first = (await lab.matches(id)).find(m => m.state === 'OPEN')!;
    await finish(lab, id);
    const before = await lab.matches(id);
    const storedFirst = before.find(m => m.id === first.id)!;
    const replacement = storedFirst.winner_id === storedFirst.player1_id ? storedFirst.player2_id! : storedFirst.player1_id!;
    await lab.score(id, storedFirst, replacement);
    const after = await lab.matches(id);
    expect(after.find(m => m.id === first.id)?.winner_id).toBe(replacement);
    expect(after.filter(m => m.state === 'COMPLETE' && !m.scores_csv.includes('BYE')).length).toBeLessThan(before.filter(m => m.state === 'COMPLETE' && !m.scores_csv.includes('BYE')).length);
    await finish(lab, id);
});

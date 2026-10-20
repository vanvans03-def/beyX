import { test, expect, generate } from './support/fixture';

const protectedMethods: [string, string][] = [
    ['GET', '/api/admin/profile'], ['PATCH', '/api/admin/profile'], ['POST', '/api/admin/profile/password'],
    ['GET', '/api/admin/users/manage'], ['PATCH', '/api/admin/users/manage'], ['POST', '/api/admin/users'], ['PUT', '/api/admin/users'],
    ['GET', '/api/admin/tournaments'], ['POST', '/api/admin/tournaments'], ['PATCH', '/api/admin/tournaments'], ['DELETE', '/api/admin/tournaments'],
    ['GET', '/api/admin/registrations'], ['POST', '/api/admin/registrations'], ['PATCH', '/api/admin/registrations'], ['DELETE', '/api/admin/registrations'],
    ['GET', '/api/admin/matches'], ['PUT', '/api/admin/matches'], ['POST', '/api/generate-bracket'],
    ['POST', '/api/admin/tournaments/reset'], ['POST', '/api/admin/tournaments/order'], ['DELETE', '/api/admin/tournaments/order'],
    ['GET', '/api/admin/match-locks'], ['POST', '/api/admin/match-locks'], ['GET', '/api/admin/players'], ['PATCH', '/api/admin/players'],
    ['GET', '/api/admin/rankings/tournaments'], ['PATCH', '/api/admin/rankings/tournaments'], ['POST', '/api/admin/events'], ['PUT', '/api/admin/events'], ['DELETE', '/api/admin/events'],
    ['POST', '/api/admin/beyblades'], ['PATCH', '/api/admin/beyblades'], ['DELETE', '/api/admin/beyblades'],
];
for (const [method, path] of protectedMethods) test(`anonymous and forged headers cannot ${method} ${path}`, async ({ request }) => {
    const response = await request.fetch(path, { method, headers: { 'x-user-id': 'forged-user', 'x-user-role': 'superadmin' }, data: method === 'GET' ? undefined : {} });
    expect(response.status()).toBe(401);
});

// These tests intentionally fail if an existing ownership gap is present. No xfail/skip.
for (const action of ['read', 'arena', 'order', 'reset', 'generate', 'score', 'rename']) test(`other organizer cannot ${action} someone else's tournament`, async ({ lab }) => {
    const id = await lab.tournament(); await lab.players(id, 4);
    if (['score', 'reset'].includes(action)) await generate(lab, id);
    const other = lab.outsider.api;
    const response = action === 'read' ? await other.get(`/api/admin/tournaments?id=${id}`)
        : action === 'arena' ? await other.patch('/api/admin/tournaments', { data: { tournamentId: id, arena_count: 99 } })
        : action === 'order' ? await other.post('/api/admin/tournaments/order', { data: { tournamentId: id, order: ['intruder'] } })
        : action === 'reset' ? await other.post('/api/admin/tournaments/reset', { data: { tournamentId: id } })
        : action === 'generate' ? await other.post('/api/generate-bracket', { data: { tournamentId: id } })
        : action === 'score' ? await other.put('/api/admin/matches', { data: { tournamentId: id, matchId: (await lab.matches(id)).find(m => m.state === 'OPEN')!.id, scoresCsv: '4-0', winnerId: (await lab.matches(id)).find(m => m.state === 'OPEN')!.player1_id } })
        : await other.patch('/api/admin/registrations', { data: { id: (await lab.db.query('SELECT id FROM public.registrations WHERE tournament_id=$1 LIMIT 1', [id])).rows[0].id, player_name: `${lab.tag} Unauthorized` } });
    expect(response.status()).toBe(403);
});

test('regular organizer cannot reset another account password', async ({ lab }) => {
    const response = await lab.organizer.api.put('/api/admin/users', { data: { username: lab.outsider.username, newPassword: `${lab.tag}Unauthorized!` } });
    expect(response.status()).toBe(403);
});

test('anonymous caller cannot overwrite system settings', async ({ lab, request }) => {
    const response = await request.post('/api/settings', { data: { key: `${lab.tag}forbidden`, value: false } });
    expect([401, 403]).toContain(response.status());
});

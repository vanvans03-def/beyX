import { test as base, expect, type APIRequestContext } from '@playwright/test';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

export type Account = { id: string; username: string; password: string; shop: string; api: APIRequestContext };
export type Match = { id: string; player1_id: string | null; player2_id: string | null; winner_id: string | null; state: string; scores_csv: string; round: number; is_grand_final?: boolean; is_reset_match?: boolean; player1: { name: string }; player2: { name: string } };
export type Lab = { tag: string; db: Pool; superadmin: Account; organizer: Account; outsider: Account; tournament: (type?: string, bracket?: string) => Promise<string>; players: (id: string, count: number) => Promise<string[]>; matches: (id: string) => Promise<Match[]>; score: (id: string, match: Match, winner?: string) => Promise<void> };

export async function jsonOK(response: { ok: () => boolean; status: () => number; url: () => string; text: () => Promise<string> }) {
    const text = await response.text();
    expect(response.ok(), `${new URL(response.url()).pathname}: HTTP ${response.status()} ${text.slice(0, 1000)}`).toBeTruthy();
    return JSON.parse(text);
}

export const test = base.extend<{ lab: Lab }>({
    lab: async ({ playwright, baseURL }, provide) => {
        if (!process.env.E2E_DATABASE_URL || !process.env.E2E_DATABASE_NAME || process.env.E2E_ALLOW_WRITES !== '1') throw new Error('Use npm run test:e2e:migration with an isolated E2E_DATABASE_URL, E2E_DATABASE_NAME and E2E_ALLOW_WRITES=1.');
        if (!/(test|e2e|rehearsal)/i.test(process.env.E2E_DATABASE_NAME) || decodeURIComponent(new URL(process.env.E2E_DATABASE_URL).pathname.slice(1)) !== process.env.E2E_DATABASE_NAME) throw new Error('Fixture requires an explicitly named test/e2e/rehearsal database matching its URL.');
        const allowedStaging = baseURL === 'https://beyx-rehearsal-638873004771.us-central1.run.app'
            && process.env.E2E_STAGING_BASE_URL === baseURL && process.env.E2E_DATABASE_NAME === 'beyx_rehearsal';
        if (!baseURL || (!['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname) && !allowedStaging)) throw new Error('Migration fixture refuses application URLs outside localhost or the explicitly approved GCP rehearsal.');
        const db = new Pool({ connectionString: process.env.E2E_DATABASE_URL, max: 2, connectionTimeoutMillis: 10_000 });
        const tag = `e2e${randomUUID().replaceAll('-', '')}`;
        const accounts: Account[] = [];
        const ids: string[] = [];
        let verified = false;
        try {
            const identity = await db.query('SELECT current_database() AS name');
            expect(identity.rows[0].name).toBe(process.env.E2E_DATABASE_NAME);
            verified = true;
            const hash = await bcrypt.hash(`${tag}Password!`, 10);
            for (const role of ['superadmin', 'user', 'user']) {
                const id = randomUUID(), username = `${tag}${accounts.length}`, shop = username;
                await db.query(`INSERT INTO public.users (id, username, password_hash, shop_name, email, role, event_mode_enabled, internal_bracket_enabled, ranking_organizer_enabled) VALUES ($1,$2,$3,$4,$5,$6,true,true,true)`, [id, username, hash, shop, `${username}@example.invalid`, role]);
                const api = await playwright.request.newContext({ baseURL, ignoreHTTPSErrors: baseURL === 'https://127.0.0.1:3346' && process.env.E2E_LOCAL_TLS === '1' });
                const account = { id, username, shop, password: `${tag}Password!`, api }; accounts.push(account);
                await jsonOK(await api.post('/api/auth/login', { data: { username, password: account.password } }));
                const profile = await jsonOK(await api.get('/api/admin/profile'));
                expect(profile.user.username, 'App must authenticate the unique account created only in this isolated DB').toBe(username);
                expect(profile.user.role).toBe(role);
            }
            const [superadmin, organizer, outsider] = accounts;
            const lab: Lab = {
                tag, db, superadmin, organizer, outsider,
                async tournament(type = 'Open', bracket = 'SINGLE') {
                    const result = await jsonOK(await organizer.api.post('/api/admin/tournaments', { data: { name: `${tag} ${type} ${bracket}`, type, bracket_type: bracket, provider: 'INTERNAL', ban_list: [] } }));
                    ids.push(result.data.id); return result.data.id;
                },
                async players(id, count) {
                    const names = Array.from({ length: count }, (_, i) => `${tag} P${String(i + 1).padStart(3, '0')}`);
                    await jsonOK(await organizer.api.post('/api/admin/registrations', { data: { tournamentId: id, players: names, mode: 'Standard' } })); return names;
                },
                async matches(id) { return (await jsonOK(await organizer.api.get(`/api/admin/matches?tournamentId=${id}`))).matches; },
                async score(id, match, winner = match.player1_id!) { await jsonOK(await organizer.api.put('/api/admin/matches', { data: { tournamentId: id, matchId: match.id, winnerId: winner, scoresCsv: winner === match.player1_id ? '4-1' : '1-4' } })); },
            };
            await provide(lab);
        } finally {
            // Only this test's UUID-owned records. Never TRUNCATE a migrated database.
            await Promise.all(accounts.map(account => account.api.dispose()));
            try {
                if (verified) {
                const users = (await db.query('SELECT id FROM public.users WHERE username LIKE $1', [`${tag}%`])).rows.map(row => row.id);
                const tournaments = await db.query('SELECT id FROM public.tournaments WHERE user_id = ANY($1::uuid[])', [users]);
                const tids = [...new Set([...ids, ...tournaments.rows.map(row => row.id)])];
                await db.query('DELETE FROM public.system_settings WHERE key = ANY($1::text[])', [tids.map(id => `participant_order_${id}`)]);
                await db.query('DELETE FROM public.match_locks WHERE tournament_id = ANY($1::uuid[])', [tids]);
                await db.query('DELETE FROM public.tournament_results WHERE tournament_id = ANY($1::uuid[])', [tids]);
                await db.query('DELETE FROM public.internal_matches WHERE tournament_id = ANY($1::uuid[])', [tids]);
                await db.query('DELETE FROM public.tournaments WHERE id = ANY($1::uuid[])', [tids]);
                await db.query('DELETE FROM public.players WHERE display_name LIKE $1', [`${tag}%`]);
                await db.query('DELETE FROM public.events WHERE title LIKE $1', [`${tag}%`]);
                await db.query('DELETE FROM public.user_beyblade_points WHERE user_id = ANY($1::uuid[])', [users]);
                await db.query('DELETE FROM public.beyblades WHERE name LIKE $1', [`${tag}%`]);
                await db.query('DELETE FROM public.system_settings WHERE key LIKE $1', [`${tag}%`]);
                await db.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [users]);
                }
            } finally { await db.end(); }
        }
    },
});
export { expect };

export async function generate(lab: Lab, id: string) {
    await jsonOK(await lab.organizer.api.post('/api/generate-bracket', { data: { tournamentId: id, arenaCount: 2, shuffle: false } }));
}

export async function finish(lab: Lab, id: string, resetFinal = false) {
    let played = 0, resetPlayed = false;
    for (let guard = 0; guard < 200; guard++) {
        const matches = await lab.matches(id);
        const open = matches.find(match => match.state === 'OPEN' && match.player1_id && match.player2_id);
        if (!open) {
            expect(matches.filter(match => match.state !== 'COMPLETE' && !match.is_reset_match), 'Bracket must not deadlock').toHaveLength(0);
            return { played, resetPlayed, matches };
        }
        const winner = resetFinal && open.is_grand_final ? open.player2_id! : [open.player1_id!, open.player2_id!].sort((a, b) => {
            const names = new Map([[open.player1_id, open.player1.name], [open.player2_id, open.player2.name]]);
            return names.get(a)!.localeCompare(names.get(b)!);
        })[0];
        await lab.score(id, open, winner); played++; resetPlayed ||= Boolean(open.is_reset_match);
    }
    throw new Error('Bracket did not finish within 200 playable matches');
}

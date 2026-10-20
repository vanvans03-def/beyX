/** Real v1 API, independent from the app's Challonge wrapper. Never log credentials. */
export type RemoteMatch = { id: number; player1_id: number; player2_id: number; winner_id: number | null; state: string; round: number; scores_csv: string };
export type RemoteParticipant = { id: number; name: string; seed: number; final_rank: number | null };
export class ChallongeOracle {
    private authorization: string;
    constructor() {
        const username = process.env.E2E_CHALLONGE_USERNAME, key = process.env.E2E_CHALLONGE_API_KEY;
        if (process.env.E2E_CHALLONGE_LIVE !== '1' || !username || !key) throw new Error('Use npm run test:e2e:challonge with test-account credentials.');
        this.authorization = `Basic ${Buffer.from(`${username}:${key}`).toString('base64')}`;
    }
    async call<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
        await new Promise(resolve => setTimeout(resolve, 350));
        const response = await fetch(`https://api.challonge.com/v1/${path}.json`, {
            method, headers: { Authorization: this.authorization, 'Content-Type': 'application/json' },
            body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(60_000),
        });
        // Report status/path only: errors can echo credentials supplied by third parties.
        if (!response.ok) throw new Error(`Challonge ${method} ${path}: HTTP ${response.status}`);
        const text = await response.text(); return (text ? JSON.parse(text) : undefined) as T;
    }
    async create(slug: string, bracket: string) {
        const result = await this.call<{ tournament: { id: number } }>('tournaments', 'POST', { tournament: { name: `BEYX E2E ${slug}`, url: slug, tournament_type: bracket === 'DOUBLE' ? 'double elimination' : 'single elimination', open_signup: false, private: true, quick_advance: false } });
        return result.tournament.id;
    }
    async participants(id: number) { return (await this.call<{ participant: RemoteParticipant }[]>(`tournaments/${id}/participants`)).map(row => row.participant); }
    async matches(id: number) { return (await this.call<{ match: RemoteMatch }[]>(`tournaments/${id}/matches`)).map(row => row.match); }
    async destroy(id: number) { await this.call(`tournaments/${id}`, 'DELETE'); }
}

export function pairKey(a: string, b: string) { return [a, b].sort().join(' <> '); }

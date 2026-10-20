import { test, expect, jsonOK, generate } from './support/fixture';
import { ChallongeOracle, pairKey } from './support/challonge';

// Run sequentially against a test Challonge account, never an existing tournament.
const sizes = (process.env.E2E_CHALLONGE_SIZES || '3,4,5,8,9,16').split(',').map(Number);
if (sizes.some(size => !Number.isInteger(size) || size < 2 || size > 64)) throw new Error('Challonge sizes must be integers between 2 and 64.');
for (const bracket of ['SINGLE', 'DOUBLE']) for (const count of sizes) for (const reset of bracket === 'DOUBLE' ? [false, true] : [false]) {
    test(`Challonge parity ${bracket} ${count} ${reset ? 'reset' : 'normal'}`, async ({ lab, request }, info) => {
        test.setTimeout(1_200_000);
        const oracle = new ChallongeOracle();
        const id = await lab.tournament('Open', bracket), names = await lab.players(id, count);
        await generate(lab, id);
        const slug = `${lab.tag}${bracket.toLowerCase()}${count}`;
        const remoteId = await oracle.create(slug, bracket);
        const tape: unknown[] = [];
        let cleanupError: unknown;
        try {
            await oracle.call(`tournaments/${remoteId}/participants/bulk_add`, 'POST', { participants: names.map((name, i) => ({ name, seed: i + 1 })) });
            await oracle.call(`tournaments/${remoteId}/start`, 'POST', {});
            const remotePlayers = await oracle.participants(remoteId);
            const nameById = new Map(remotePlayers.map(player => [player.id, player.name]));
            let done = false;
            for (let step = 0; step < count * 3; step++) {
                const internal = await lab.matches(id), external = await oracle.matches(remoteId);
                const localOpen = internal.filter(match => match.state === 'OPEN' && match.player1_id && match.player2_id);
                const remoteOpen = external.filter(match => match.state === 'open' && match.player1_id && match.player2_id);
                const localPairs = localOpen.map(match => pairKey(match.player1.name, match.player2.name)).sort();
                const remotePairs = remoteOpen.map(match => pairKey(nameById.get(match.player1_id)!, nameById.get(match.player2_id)!)).sort();
                tape.push({ step, localPairs, remotePairs, internal, external });
                expect(localPairs, `Playable match frontier differs at step ${step}`).toEqual(remotePairs);
                if (!localOpen.length) { expect(internal.filter(m => m.state !== 'COMPLETE' && !m.is_reset_match)).toHaveLength(0); done = true; break; }
                const match = [...localOpen].sort((a, b) => pairKey(a.player1.name, a.player2.name).localeCompare(pairKey(b.player1.name, b.player2.name)))[0];
                const remote = remoteOpen.find(row => pairKey(nameById.get(row.player1_id)!, nameById.get(row.player2_id)!) === pairKey(match.player1.name, match.player2.name))!;
                const winnerName = reset && match.is_grand_final ? match.player2.name : [match.player1.name, match.player2.name].sort()[0];
                const winner = winnerName === match.player1.name ? match.player1_id! : match.player2_id!;
                const remoteWinner = remotePlayers.find(player => player.name === winnerName)!.id;
                await lab.score(id, match, winner);
                await oracle.call(`tournaments/${remoteId}/matches/${remote.id}`, 'PUT', { match: { scores_csv: remoteWinner === remote.player1_id ? '4-1' : '1-4', winner_id: remoteWinner } });
            }
            expect(done, 'Both brackets must finish before the guard limit').toBe(true);
            await oracle.call(`tournaments/${remoteId}/finalize`, 'POST', {});
            const externalStandings = await oracle.participants(remoteId);
            const localStandings = (await jsonOK(await request.get(`/api/public/tournaments/${id}/standings`))).data;
            for (const rank of [1, 2]) expect(localStandings[rank - 1].name).toBe(externalStandings.find(player => player.final_rank === rank)?.name);
            // Single elimination may assign both semifinal losers rank 3. Compare tied groups as sets.
            expect(localStandings.slice(0, Math.min(4, count)).map((p: { name: string }) => p.name).sort()).toEqual(externalStandings.filter(player => player.final_rank && player.final_rank <= 4).map(player => player.name).sort());
            if (bracket === 'DOUBLE') expect((await lab.matches(id)).some(m => m.is_reset_match && m.state === 'COMPLETE' && !m.scores_csv.includes('BYE'))).toBe(reset);
            tape.push({ externalStandings, localStandings });
        } finally {
            await info.attach('challonge-comparison.json', { body: JSON.stringify({ source: 'Challonge v1 live API', remoteId, bracket, count, reset, tape }, null, 2), contentType: 'application/json' });
            try { await oracle.destroy(remoteId); } catch (error) { cleanupError = error; }
            if (cleanupError) throw new Error(`Could not remove this run's Challonge tournament ${remoteId}. Remove it from the TEST account. ${String(cleanupError)}`);
        }
    });
}

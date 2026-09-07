import { NextResponse } from 'next/server';
import { getMatches, updateMatch } from '@/lib/challonge';
import { adminDb as supabaseAdmin } from '@/lib/db/admin';
import { getTournament, getUserApiKey, getMatchesFromDB } from "@/lib/repository";
import { publishTournamentUpdate } from '@/lib/realtime-server';
import { propagateWinners, type InternalMatch } from "@/lib/brackets";
import { invalidateCacheKeys, invalidateTournamentCache, setCachedData } from "@/lib/redis";
import { withTournamentMutationLock } from '@/lib/tournament-mutation-lock';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const userId = request.headers.get('x-user-id');

    const { searchParams } = new URL(request.url);
    const tournamentUrl = searchParams.get('tournamentUrl');
    const tournamentId = searchParams.get('tournamentId');

    if (!tournamentUrl && !tournamentId) {
        return NextResponse.json({ error: 'Missing tournamentUrl or tournamentId' }, { status: 400 });
    }

    const tId = tournamentId || (tournamentUrl?.includes('-') ? tournamentUrl : null);
    let tournament;
    if (tId) {
        tournament = await getTournament(tId);
    }

    if (tournament?.provider === 'INTERNAL') {
        const { data: internalMatches, error } = await supabaseAdmin
            .from('internal_matches')
            .select('*')
            .eq('tournament_id', tournament.id)
            .order('suggested_play_order', { ascending: true });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        const { data: regs } = await supabaseAdmin
            .from('registrations')
            .select('id, player_name')
            .eq('tournament_id', tournament.id);

        const playerMap = new Map((regs || []).map(r => [r.id, r.player_name]));

        const enrichedMatches = (internalMatches || []).map(m => ({
            ...m,
            player1: { name: m.player1_id ? (playerMap.get(m.player1_id) || 'Unknown Player') : null },
            player2: { name: m.player2_id ? (playerMap.get(m.player2_id) || 'Unknown Player') : null },
        }));

        return NextResponse.json({ matches: enrichedMatches });
    }

    // --- CHALLONGE ---
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const apiKey = await getUserApiKey(userId);
    if (!apiKey) return NextResponse.json({ error: 'Challonge API Key not configured' }, { status: 403 });
    if (!tournamentUrl) return NextResponse.json({ error: 'Missing tournamentUrl' }, { status: 400 });

    let identifier = tournamentUrl;
    if (identifier.includes('challonge.com/')) {
        identifier = identifier.split('challonge.com/').pop()!;
    }

    try {
        const matches = await getMatches(apiKey, identifier);

        if (matches.length > 0) {
            const matchesToUpsert = matches.map((m: any) => {
                const upsertData: any = {
                    id: m.id,
                    tournament_id: m.tournament_id,
                    player1_id: m.player1_id,
                    player2_id: m.player2_id,
                    score_csv: m.scores_csv,
                    state: m.state,
                    winner_id: m.winner_id,
                    round: m.round,
                    identifier: m.identifier,
                    suggested_play_order: m.suggested_play_order,
                    underway_at: m.underway_at,
                    completed_at: m.completed_at,
                    updated_at: m.updated_at,
                };
                if (m.player1?.name) upsertData.player1_name = m.player1.name;
                if (m.player2?.name) upsertData.player2_name = m.player2.name;
                return upsertData;
            });

            const { error: upsertError } = await supabaseAdmin
                .from('matches')
                .upsert(matchesToUpsert, { onConflict: 'id' });
            if (upsertError) console.error('Supabase Sync Error:', upsertError);
        }

        return NextResponse.json({ matches });
    } catch (error: any) {
        console.error('GET Matches Error (Challonge):', error.message);
        try {
            const fallbackMatches = await getMatchesFromDB(identifier);
            if (fallbackMatches?.length > 0) {
                return NextResponse.json({ matches: fallbackMatches, isFallback: true });
            }
            throw new Error('No local matches found for fallback.');
        } catch (dbError: any) {
            const errorDetail = error.response?.data
                ? JSON.stringify(error.response.data)
                : error.message;
            return NextResponse.json({
                error: error.message,
                details: errorDetail,
                fallbackFailed: true,
            }, { status: 500 });
        }
    }
}

export async function PUT(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { tournamentUrl, matchId, scoresCsv, winnerId, tournamentId } = await request.json();

        const tournament = await getTournament(tournamentId);

        if (tournament?.provider === 'INTERNAL') {
            return await withTournamentMutationLock(tournamentId, async () => {
            // ── 1. Load all matches for this tournament ───────────────────────
            const { data: rows, error: fetchErr } = await supabaseAdmin
                .from('internal_matches')
                .select('*')
                .eq('tournament_id', tournamentId);

            if (fetchErr || !rows) {
                throw new Error(fetchErr?.message || 'Failed to fetch matches');
            }

            // Work on in-memory copies so mutations don't touch the DB mid-loop
            const ms = rows.map(m => ({ ...m })) as InternalMatch[];

            // ── 2. Apply the human result to the target match ─────────────────
            const target = ms.find(m => m.id === matchId);
            if (!target) throw new Error(`Match ${matchId} not found`);

            target.scores_csv = scoresCsv;
            target.winner_id = winnerId;
            target.state = 'COMPLETE';

            // ── 3. Run propagation ───────────────────────────────────────────
            propagateWinners(ms);

            // ── 4. Persist only rows changed by this result/propagation ───────
            const now = new Date().toISOString();
            const originalById = new Map(rows.map(row => [row.id, row]));
            const changedMatches = ms.filter(m => {
                const original = originalById.get(m.id);
                return !original ||
                    original.state !== m.state ||
                    original.winner_id !== m.winner_id ||
                    original.scores_csv !== m.scores_csv ||
                    original.player1_id !== m.player1_id ||
                    original.player2_id !== m.player2_id;
            });
            const changedIds = new Set(changedMatches.map(match => match.id));
            const { data: regs, error: registrationsError } = await supabaseAdmin
                .from('registrations')
                .select('id, player_name')
                .eq('tournament_id', tournamentId);
            if (registrationsError) throw new Error(registrationsError.message);

            const playerMap = new Map((regs || []).map(r => [r.id, r.player_name]));
            const missingPlayer = ms.some(match =>
                (match.player1_id && !playerMap.has(match.player1_id)) ||
                (match.player2_id && !playerMap.has(match.player2_id))
            );
            if (missingPlayer) throw new Error('Player data is incomplete; match result was not saved');

            const persistedRows = changedMatches.map(m => ({
                            id: m.id,
                            tournament_id: m.tournament_id,
                            player1_id: m.player1_id,
                            player2_id: m.player2_id,
                            winner_id: m.winner_id,
                            state: m.state,
                            scores_csv: m.scores_csv,
                            round: m.round,
                            player1_prereq_match_id: m.player1_prereq_match_id,
                            player2_prereq_match_id: m.player2_prereq_match_id,
                            loser_to_match_id: m.loser_to_match_id,
                            player1_loser_feeder_id: m.player1_loser_feeder_id,
                            player2_loser_feeder_id: m.player2_loser_feeder_id,
                            is_grand_final: m.is_grand_final,
                            is_reset_match: m.is_reset_match,
                            suggested_play_order: m.suggested_play_order,
                            updated_at: now,
                        }));

            const { error: upsertErr } = persistedRows.length
                ? await supabaseAdmin.from('internal_matches').upsert(persistedRows, { onConflict: 'id' })
                : { error: null };

            if (upsertErr) {
                throw new Error(`Failed to save propagated matches: ${upsertErr.message}`);
            }

            // Build the new snapshot once. All public viewers receive deltas and
            // new/reconnecting viewers read this snapshot from Redis.
            const enrich = (match: any) => ({
                ...match,
                player1: { name: match.player1_id ? (playerMap.get(match.player1_id) || 'Unknown Player') : null },
                player2: { name: match.player2_id ? (playerMap.get(match.player2_id) || 'Unknown Player') : null },
                updated_at: changedIds.has(match.id)
                    ? now
                    : originalById.get(match.id)?.updated_at,
            });
            const snapshot = ms.map(enrich);
            // Keep NOTIFY payload comfortably below PostgreSQL's 8KB limit.
            // The browser merges these mutable fields into its existing snapshot.
            const deltas = changedMatches.map(match => {
                const enriched = enrich(match);
                return {
                    id: enriched.id,
                    player1_id: enriched.player1_id,
                    player2_id: enriched.player2_id,
                    winner_id: enriched.winner_id,
                    state: enriched.state,
                    scores_csv: enriched.scores_csv,
                    player1: enriched.player1,
                    player2: enriched.player2,
                    updated_at: enriched.updated_at,
                };
            });
            await setCachedData(`tournament:${tournamentId}:matches`, { matches: snapshot, version: now }, 3600);
            await invalidateCacheKeys(`tournament:${tournamentId}:standings`);

            try {
                for (let index = 0; index < deltas.length; index += 5) {
                    await publishTournamentUpdate({
                        tournamentId,
                        event: 'match-update',
                        matchId,
                        matches: deltas.slice(index, index + 5),
                        version: now,
                    });
                }
            } catch (notifyError) {
                // The score is already committed; do not invite a duplicate admin retry.
                console.error('[realtime] Failed to broadcast match delta', notifyError);
            }

            return NextResponse.json({ success: true, changedMatches: deltas.length, version: now });
            });
        }

        // --- CHALLONGE ---
        const apiKey = await getUserApiKey(userId);
        if (!apiKey) return NextResponse.json({ error: 'Challonge API Key not configured' }, { status: 403 });
        if (!tournamentUrl) return NextResponse.json({ error: 'Missing tournamentUrl' }, { status: 400 });

        let identifier = tournamentUrl;
        if (identifier.includes('challonge.com/')) {
            identifier = identifier.split('challonge.com/').pop()!;
        }

        await updateMatch(apiKey, identifier, matchId, scoresCsv, winnerId);

        if (tournamentId) {
            await invalidateTournamentCache(tournamentId);

            await publishTournamentUpdate({ tournamentId, event: 'match-update', matchId });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        const errorDetail = error.response?.data
            ? JSON.stringify(error.response.data)
            : error.message;
        return NextResponse.json({ error: error.message, details: errorDetail }, { status: 500 });
    }
}

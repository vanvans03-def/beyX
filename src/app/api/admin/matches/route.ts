import { NextResponse } from 'next/server';
import { getMatches, updateMatch } from '@/lib/challonge';
import { supabaseAdmin } from '@/lib/supabase';
import { getTournament, getUserApiKey, getMatchesFromDB } from "@/lib/repository";
import { propagateWinners, type InternalMatch } from "@/lib/brackets";

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

            // Sanity-check: match must be OPEN and have both players
            if (target.state !== 'OPEN') {
                return NextResponse.json(
                    { error: `Match ${matchId} is not OPEN (state=${target.state})` },
                    { status: 400 },
                );
            }
            if (!target.player1_id || !target.player2_id) {
                return NextResponse.json(
                    { error: `Match ${matchId} does not have two players yet` },
                    { status: 400 },
                );
            }
            if (winnerId !== target.player1_id && winnerId !== target.player2_id) {
                return NextResponse.json(
                    { error: `Winner ${winnerId} is not a participant of match ${matchId}` },
                    { status: 400 },
                );
            }

            target.scores_csv = scoresCsv;
            target.winner_id = winnerId;
            target.state = 'COMPLETE';

            // ── 3. Propagate the result through the full bracket ──────────────
            //
            // propagateWinners (from bracket.ts) handles:
            //   • opening matches once both players arrive
            //   • auto-BYE for single-player slots
            //   • forwarding winners via player1/2_prereq_match_id
            //   • dropping losers via loser_to_match_id (WB AND LB)
            //   • Grand Final reset activation / cancellation
            //
            // It is the single source of truth — do NOT add a second propagation
            // loop here; that caused state divergence in the original code.
            propagateWinners(ms);

            // ── 4. Persist all mutated matches in one bulk upsert ─────────────
            //
            // We upsert EVERY match, not just the changed ones, so the DB stays
            // perfectly in sync with the in-memory state after propagation.
            const now = new Date().toISOString();
            const { error: upsertErr } = await supabaseAdmin
                .from('internal_matches')
                .upsert(
                    ms.map(m => ({
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
                        is_grand_final: m.is_grand_final,
                        is_reset_match: m.is_reset_match,
                        suggested_play_order: m.suggested_play_order,
                        updated_at: now,
                    })),
                    { onConflict: 'id' },
                );

            if (upsertErr) {
                throw new Error(`Failed to save propagated matches: ${upsertErr.message}`);
            }

            return NextResponse.json({ success: true });
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
            await supabaseAdmin
                .channel(`admin-tournament-${tournamentId}`)
                .send({
                    type: 'broadcast',
                    event: 'match-update',
                    payload: { matchId },
                });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        const errorDetail = error.response?.data
            ? JSON.stringify(error.response.data)
            : error.message;
        return NextResponse.json({ error: error.message, details: errorDetail }, { status: 500 });
    }
}
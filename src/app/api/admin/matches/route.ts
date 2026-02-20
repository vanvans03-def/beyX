import { NextResponse } from 'next/server';
import { getMatches, updateMatch } from '@/lib/challonge';
import { supabaseAdmin } from '@/lib/supabase';
import { createTournament, getTournaments, getTournament, updateTournamentStatus, getUserApiKey, getMatchesFromDB } from "@/lib/repository";

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: Request) {
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = await getUserApiKey(userId);
    if (!apiKey) return NextResponse.json({ error: 'Challonge API Key not configured' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const tournamentUrl = searchParams.get('tournamentUrl'); // e.g. bb_1739...

    if (!tournamentUrl) {
        return NextResponse.json({ error: 'Missing tournamentUrl' }, { status: 400 });
    }

    let identifier = tournamentUrl;
    if (identifier.includes('challonge.com/')) {
        identifier = identifier.split('challonge.com/').pop()!;
    }

    try {
        const matches = await getMatches(apiKey, identifier);

        // Sync to Supabase
        if (matches.length > 0) {
            const matchesToUpsert = matches.map((m: any) => ({
                id: m.id,
                tournament_id: m.tournament_id,
                player1_id: m.player1_id,
                player2_id: m.player2_id,
                player1_name: m.player1?.name ?? null,  // Cache name to avoid re-fetching from Challonge
                player2_name: m.player2?.name ?? null,
                score_csv: m.scores_csv, // Note mapping difference
                state: m.state,
                winner_id: m.winner_id,
                round: m.round,
                identifier: m.identifier,
                suggested_play_order: m.suggested_play_order,
                underway_at: m.underway_at,
                completed_at: m.completed_at,
                updated_at: m.updated_at
            }));

            const { error } = await supabaseAdmin
                .from('matches')
                .upsert(matchesToUpsert, { onConflict: 'id' });

            if (error) {
                console.error("Supabase Sync Error:", error);
            } else {
                console.log(`Synced ${matches.length} matches to Supabase.`);
            }
        }

        return NextResponse.json({ matches });
    } catch (error: any) {
        console.error("GET Matches Error (Challonge):", error.message);

        try {
            console.log("Attempting fallback to local DB matches...");
            const fallbackMatches = await getMatchesFromDB(identifier);

            if (fallbackMatches && fallbackMatches.length > 0) {
                console.log(`Served ${fallbackMatches.length} matches from Fallback DB.`);
                return NextResponse.json({ matches: fallbackMatches, isFallback: true });
            } else {
                throw new Error("No local matches found for fallback.");
            }
        } catch (dbError: any) {
            console.error("Fallback Failed:", dbError.message);
            const errorDetail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            return NextResponse.json({
                error: error.message,
                details: errorDetail,
                stack: error.stack,
                fallbackFailed: true
            }, { status: 500 });
        }
    }
}

export async function PUT(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const apiKey = await getUserApiKey(userId);
        if (!apiKey) return NextResponse.json({ error: 'Challonge API Key not configured' }, { status: 403 });

        const { tournamentUrl, matchId, scoresCsv, winnerId, tournamentId } = await request.json();

        let identifier = tournamentUrl;
        if (identifier.includes('challonge.com/')) {
            identifier = identifier.split('challonge.com/').pop()!;
        }

        await updateMatch(apiKey, identifier, matchId, scoresCsv, winnerId);

        // Broadcast realtime update if we have the tournament ID
        if (tournamentId) {
            await supabaseAdmin
                .channel(`admin-tournament-${tournamentId}`)
                .send({
                    type: 'broadcast',
                    event: 'match-update',
                    payload: { matchId }
                });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

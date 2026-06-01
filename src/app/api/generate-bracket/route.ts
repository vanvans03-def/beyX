import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { setupAndStartTournament } from '@/lib/challonge';
import { getUserApiKey, getTournament, getRegistrations, getParticipantOrder } from '@/lib/repository';
import { generateSingleElimination, generateDoubleElimination } from '@/lib/brackets';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User ID' }, { status: 401 });
        }

        const { roomName, players, type, shuffle, tournamentId, quickAdvance, arenaCount } = await request.json(); // tournamentId is our DB UUID

        // 1. Fetch Tournament to check provider
        const tournament = await getTournament(tournamentId);
        if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });

        if (tournament.provider === 'INTERNAL') {
            // --- INTERNAL GENERATION ---
            const registrations = await getRegistrations(tournamentId);
            const savedOrder = await getParticipantOrder(tournamentId);
            
            let orderedRegistrations = [...registrations];
            if (savedOrder && savedOrder.length > 0) {
                const orderMap = new Map(savedOrder.map((name, index) => [name, index]));
                orderedRegistrations.sort((a, b) => {
                    const indexA = orderMap.has(a.player_name) ? orderMap.get(a.player_name)! : Infinity;
                    const indexB = orderMap.has(b.player_name) ? orderMap.get(b.player_name)! : Infinity;
                    return indexA - indexB;
                });
            } else {
                orderedRegistrations.reverse();
            }

            const participants = orderedRegistrations.map(r => ({ id: r.id, name: r.player_name }));

            let matches = [];
            if (tournament.bracket_type === 'DOUBLE') {
                matches = generateDoubleElimination(tournamentId, participants);
            } else {
                matches = generateSingleElimination(tournamentId, participants);
            }

            // Save Matches to internal_matches
            // NOTE: suggested_play_order is already computed by generateDoubleElimination /
            // generateSingleElimination with correct phase-interleaved ordering — do NOT
            // override it with the flat array index here.
            if (matches.length > 0) {
                const { error } = await supabase
                    .from('internal_matches')
                    .insert(matches.map(m => ({
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
                    })));

                if (error) {
                    console.error("Failed to save internal matches:", error);
                    return NextResponse.json({ error: 'Failed to save bracket matches' }, { status: 500 });
                }
            }

            // Update Tournament Status & Arena Count
            await supabase
                .from('tournaments')
                .update({ 
                    status: 'STARTED',
                    arena_count: arenaCount || 0
                })
                .eq('id', tournamentId);

            return NextResponse.json({ success: true, url: `/tournament/${tournamentId}/bracket` });
        }

        // --- CHALLONGE GENERATION (Legacy) ---
        const apiKey = await getUserApiKey(userId);
        if (!apiKey) {
            return NextResponse.json({ error: 'Challonge API Key not configured. Please add it in the admin dashboard.' }, { status: 403 });
        }

        if (!roomName) {
            return NextResponse.json({ error: 'Room name is required' }, { status: 400 });
        }

        if (!players || !Array.isArray(players)) {
            return NextResponse.json({ error: 'Players list is required and must be an array' }, { status: 400 });
        }

        const result = await setupAndStartTournament(apiKey, roomName, players, { type, shuffle, quickAdvance });

        // Save to Database if tournamentId provided
        if (tournamentId) {
            const { error } = await supabase
                .from('tournaments')
                .update({
                    challonge_url: result.url,
                    tournament_type: type, // Save the type too
                    arena_count: arenaCount || 0,
                    status: 'STARTED'
                })
                .eq('id', tournamentId);

            if (error) console.error("Failed to save URL to DB:", error);
        }

        return NextResponse.json({ url: result.url, raw_url: result.raw_url });
    } catch (error: any) {
        console.error('API Error:', error);

        // Handle Axios 401 specifically
        if (error.response?.status === 401) {
            return NextResponse.json(
                { error: 'Invalid Challonge API Key. Please check your settings.' },
                { status: 401 }
            );
        }

        // Handle Axios 422 (Unprocessable Entity) - Validation Errors
        if (error.response?.status === 422) {
            const validationErrors = error.response.data?.errors;
            const errorMessage = Array.isArray(validationErrors)
                ? validationErrors.join(', ')
                : 'Validation failed on Challonge side.';

            return NextResponse.json(
                { error: `Challonge Validation Error: ${errorMessage}` },
                { status: 422 }
            );
        }

        return NextResponse.json(
            { error: error.message || 'Failed to generate bracket' },
            { status: 500 }
        );
    }
}

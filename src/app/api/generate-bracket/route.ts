import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { setupAndStartTournament } from '@/lib/challonge';
import { getUserApiKey, getTournament, getRegistrations, getParticipantOrder } from '@/lib/repository';
import { generateSingleElimination, generateDoubleElimination, type InternalMatch } from '@/lib/brackets';

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
            
            const orderedRegistrations = [...registrations];
            if (savedOrder && savedOrder.length > 0) {
                const orderMap = new Map(savedOrder.map((name, index) => [name, index]));
                orderedRegistrations.sort((a, b) => {
                    const indexA = orderMap.has(a.player_name) ? orderMap.get(a.player_name)! : Infinity;
                    const indexB = orderMap.has(b.player_name) ? orderMap.get(b.player_name)! : Infinity;
                    return indexA - indexB;
                });
            }

            const participants = orderedRegistrations.map(r => ({ id: r.id, name: r.player_name }));

            let matches: InternalMatch[] = [];
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
                const toDbMatch = (m: InternalMatch, includeSelfReferences: boolean) => ({
                    id: m.id,
                    tournament_id: m.tournament_id,
                    player1_id: m.player1_id,
                    player2_id: m.player2_id,
                    winner_id: m.winner_id,
                    state: m.state,
                    scores_csv: m.scores_csv,
                    round: m.round,
                    player1_prereq_match_id: includeSelfReferences ? m.player1_prereq_match_id : null,
                    player2_prereq_match_id: includeSelfReferences ? m.player2_prereq_match_id : null,
                    loser_to_match_id: includeSelfReferences ? m.loser_to_match_id : null,
                    player1_loser_feeder_id: includeSelfReferences ? m.player1_loser_feeder_id : null,
                    player2_loser_feeder_id: includeSelfReferences ? m.player2_loser_feeder_id : null,
                    is_grand_final: m.is_grand_final,
                    is_reset_match: m.is_reset_match,
                    suggested_play_order: m.suggested_play_order,
                });

                const { error: deleteError } = await supabase
                    .from('internal_matches')
                    .delete()
                    .eq('tournament_id', tournamentId);

                if (deleteError) {
                    console.error("Failed to clear previous internal matches:", deleteError);
                    return NextResponse.json(
                        { error: `Failed to clear previous bracket matches: ${deleteError.message}` },
                        { status: 500 }
                    );
                }

                // Insert without match-to-match references first. Some rows point
                // forward to generated matches that do not exist until later rows.
                const { error: insertError } = await supabase
                    .from('internal_matches')
                    .insert(matches.map(m => toDbMatch(m, false)));

                if (insertError) {
                    console.error("Failed to save internal matches:", insertError);
                    return NextResponse.json(
                        { error: `Failed to save bracket matches: ${insertError.message}` },
                        { status: 500 }
                    );
                }

                const { error: referenceError } = await supabase
                    .from('internal_matches')
                    .upsert(matches.map(m => toDbMatch(m, true)), { onConflict: 'id' });

                if (referenceError) {
                    console.error("Failed to save internal match references:", referenceError);
                    await supabase
                        .from('internal_matches')
                        .delete()
                        .eq('tournament_id', tournamentId);

                    return NextResponse.json(
                        { error: `Failed to save bracket match references: ${referenceError.message}` },
                        { status: 500 }
                    );
                }
            }

            // Update Tournament Status & Arena Count
            const { error: tournamentUpdateError } = await supabase
                .from('tournaments')
                .update({ 
                    status: 'STARTED',
                    arena_count: arenaCount || 0
                })
                .eq('id', tournamentId);

            if (tournamentUpdateError) {
                console.error("Failed to update internal tournament status:", tournamentUpdateError);
                return NextResponse.json(
                    { error: `Failed to update tournament status: ${tournamentUpdateError.message}` },
                    { status: 500 }
                );
            }

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
    } catch (error: unknown) {
        console.error('API Error:', error);
        const apiError = error as {
            response?: { status?: number; data?: { errors?: unknown } };
            message?: string;
        };

        // Handle Axios 401 specifically
        if (apiError.response?.status === 401) {
            return NextResponse.json(
                { error: 'Invalid Challonge API Key. Please check your settings.' },
                { status: 401 }
            );
        }

        // Handle Axios 422 (Unprocessable Entity) - Validation Errors
        if (apiError.response?.status === 422) {
            const validationErrors = apiError.response.data?.errors;
            const errorMessage = Array.isArray(validationErrors)
                ? validationErrors.join(', ')
                : 'Validation failed on Challonge side.';

            return NextResponse.json(
                { error: `Challonge Validation Error: ${errorMessage}` },
                { status: 422 }
            );
        }

        return NextResponse.json(
            { error: apiError.message || 'Failed to generate bracket' },
            { status: 500 }
        );
    }
}

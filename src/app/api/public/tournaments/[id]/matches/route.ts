import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getTournament } from "@/lib/repository";
import { getCachedData, setCachedData } from "@/lib/redis";

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    const params = await context.params;
    const tournamentId = params.id;

    if (!tournamentId) {
        return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });
    }

    try {
        const cacheKey = `tournament:${tournamentId}:matches`;
        const cachedResponse = await getCachedData<{ matches: any[] }>(cacheKey);
        if (cachedResponse) {
            return NextResponse.json(cachedResponse);
        }

        const tournament = await getTournament(tournamentId);

        if (!tournament) {
            return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
        }

        if (tournament.provider === 'INTERNAL') {
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

            const responseData = { matches: enrichedMatches };

            // Store in Redis (1 hour TTL, explicitly invalidated on match updates)
            await setCachedData(cacheKey, responseData, 3600);

            return NextResponse.json(responseData);
        }

        return NextResponse.json({ error: 'Not an internal tournament' }, { status: 400 });

    } catch (error: any) {
        console.error('GET Public Matches Error:', error.message);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}


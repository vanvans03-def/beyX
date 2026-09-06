import { NextResponse } from 'next/server';
import { adminDb as supabaseAdmin } from '@/lib/db/admin';
import { getTournament } from "@/lib/repository";
import { getCachedData, setCachedData, singleFlight } from "@/lib/redis";

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    const params = await context.params;
    const tournamentId = params.id;

    if (!tournamentId) {
        return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });
    }

    try {
        const cacheKey = `tournament:${tournamentId}:matches`;
        const cachedResponse = await getCachedData<{ matches: any[]; version?: string }>(cacheKey);
        if (cachedResponse) {
            return NextResponse.json(cachedResponse);
        }

        const responseData = await singleFlight(cacheKey, async () => {
            // Another request may have filled Redis while this request waited.
            const filled = await getCachedData<{ matches: any[]; version?: string }>(cacheKey);
            if (filled) return filled;

            const tournament = await getTournament(tournamentId);
            if (!tournament) throw Object.assign(new Error('Tournament not found'), { status: 404 });
            if (tournament.provider !== 'INTERNAL') {
                throw Object.assign(new Error('Not an internal tournament'), { status: 400 });
            }

            const { data: internalMatches, error } = await supabaseAdmin
                .from('internal_matches')
                .select('*')
                .eq('tournament_id', tournament.id)
                .order('suggested_play_order', { ascending: true });

            if (error) throw new Error(error.message);

            const { data: regs, error: registrationsError } = await supabaseAdmin
                .from('registrations')
                .select('id, player_name')
                .eq('tournament_id', tournament.id);

            if (registrationsError) throw new Error(registrationsError.message);

            const playerMap = new Map((regs || []).map(r => [r.id, r.player_name]));
            const missingPlayerIds = new Set<string>();
            for (const match of internalMatches || []) {
                if (match.player1_id && !playerMap.has(match.player1_id)) missingPlayerIds.add(match.player1_id);
                if (match.player2_id && !playerMap.has(match.player2_id)) missingPlayerIds.add(match.player2_id);
            }
            if (missingPlayerIds.size) {
                throw Object.assign(new Error('Player data is temporarily unavailable'), { status: 503 });
            }

            const enrichedMatches = (internalMatches || []).map(m => ({
                ...m,
                player1: { name: m.player1_id ? (playerMap.get(m.player1_id) || 'Unknown Player') : null },
                player2: { name: m.player2_id ? (playerMap.get(m.player2_id) || 'Unknown Player') : null },
            }));

            const version = (internalMatches || []).reduce((latest, match) => {
                const value = match.updated_at ? new Date(match.updated_at).toISOString() : '';
                return value > latest ? value : latest;
            }, '');
            const freshResponse = { matches: enrichedMatches, version };

            // Store in Redis (1 hour TTL, explicitly invalidated on match updates)
            await setCachedData(cacheKey, freshResponse, 3600);
            return freshResponse;
        });

        return NextResponse.json(responseData);

    } catch (error: any) {
        console.error('GET Public Matches Error:', error.message);
        return NextResponse.json(
            { error: error.status ? error.message : 'Internal Server Error' },
            { status: error.status || 500 },
        );
    }
}


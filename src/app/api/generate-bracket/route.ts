import { NextResponse } from 'next/server';
import { setupAndStartTournament } from '@/lib/challonge';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
    try {
        const { roomName, players, type, shuffle, tournamentId, quickAdvance } = await request.json(); // tournamentId is our DB UUID

        if (!roomName) {
            return NextResponse.json({ error: 'Room name is required' }, { status: 400 });
        }

        if (!players || !Array.isArray(players)) {
            return NextResponse.json({ error: 'Players list is required and must be an array' }, { status: 400 });
        }

        const result = await setupAndStartTournament(roomName, players, { type, shuffle, quickAdvance });

        // Save to Database if tournamentId provided
        if (tournamentId) {
            const { error } = await supabase
                .from('tournaments')
                .update({
                    challonge_url: result.url,
                    tournament_type: type // Save the type too
                })
                .eq('id', tournamentId);

            if (error) console.error("Failed to save URL to DB:", error);
        }

        return NextResponse.json({ url: result.url, raw_url: result.raw_url });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate bracket' },
            { status: 500 }
        );
    }
}

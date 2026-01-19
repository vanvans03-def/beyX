import { NextResponse } from 'next/server';
import { getMatches, updateMatch } from '@/lib/challonge';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
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
        const matches = await getMatches(identifier);
        return NextResponse.json({ matches });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const { tournamentUrl, matchId, scoresCsv, winnerId, tournamentId } = await request.json();

        let identifier = tournamentUrl;
        if (identifier.includes('challonge.com/')) {
            identifier = identifier.split('challonge.com/').pop()!;
        }

        await updateMatch(identifier, matchId, scoresCsv, winnerId);

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

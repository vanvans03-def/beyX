import { NextResponse } from 'next/server';
import { getMatches, updateMatch } from '@/lib/challonge';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const tournamentUrl = searchParams.get('tournamentUrl'); // e.g. bb_1739...

    if (!tournamentUrl) {
        return NextResponse.json({ error: 'Missing tournamentUrl' }, { status: 400 });
    }

    // Extract the ID part if full URL is passed? No, we need the identifier (url path) or ID.
    // Challonge API accepts the URL path (e.g., 'bb_1234') as identifier.
    // The frontend should extract it or store it. Let's assume frontend passes the identifier.
    // But wait, our DB stores the full URL 'https://challonge.com/bb_...'.
    // We should parse it.

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
        const { tournamentUrl, matchId, scoresCsv, winnerId } = await request.json();

        let identifier = tournamentUrl;
        if (identifier.includes('challonge.com/')) {
            identifier = identifier.split('challonge.com/').pop()!;
        }

        await updateMatch(identifier, matchId, scoresCsv, winnerId);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

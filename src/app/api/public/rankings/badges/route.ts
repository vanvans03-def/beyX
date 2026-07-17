import { NextResponse } from 'next/server';
import { getRankingBadgesForNames } from '@/lib/ranking-badges';
import { getOrCreateTournamentBadgeSnapshot, selectRequestedBadges } from '@/lib/tournament-badge-snapshot';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const searchParams = new URL(request.url).searchParams;
        const names = searchParams.getAll('name').map(name => name.trim()).filter(Boolean).slice(0, 256);
        const tournamentId = searchParams.get('tournamentId');
        if (tournamentId) {
            const snapshot = await getOrCreateTournamentBadgeSnapshot(tournamentId);
            return NextResponse.json({ badges: selectRequestedBadges(snapshot, names), source: 'tournament-snapshot' });
        }
        return NextResponse.json({ badges: await getRankingBadgesForNames(names), source: 'live' });
    } catch (error: unknown) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load ranking badges' }, { status: 500 });
    }
}

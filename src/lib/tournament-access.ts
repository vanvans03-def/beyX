import 'server-only';
import { NextResponse } from 'next/server';
import { getTournament } from '@/lib/repository';

export function tournamentOwnershipError(request: Request, tournament: { user_id?: string | null } | null | undefined): NextResponse | null {
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    if (tournament.user_id !== userId) return NextResponse.json({ error: 'Tournament belongs to another organizer' }, { status: 403 });
    return null;
}

export async function requireTournamentOwner(request: Request, tournamentId: string): Promise<NextResponse | null> {
    if (!tournamentId) return NextResponse.json({ error: 'Tournament ID required' }, { status: 400 });
    return tournamentOwnershipError(request, await getTournament(tournamentId));
}

import { NextResponse } from 'next/server';
import { getPublicRegistrationTournament } from '@/lib/public-tournament-cache';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tournament = await getPublicRegistrationTournament(id);
  return tournament
    ? NextResponse.json({ tournament })
    : NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
}

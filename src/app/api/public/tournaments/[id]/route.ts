import { NextResponse } from 'next/server';
import { getPublicRegistrationTournament } from '@/lib/public-tournament-cache';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const shopName = new URL(request.url).searchParams.get('shopName') || undefined;
  const tournament = await getPublicRegistrationTournament(id, shopName);
  return tournament
    ? NextResponse.json({ tournament })
    : NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
}

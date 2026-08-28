import { NextResponse } from 'next/server';
import { getTournament } from '@/lib/repository';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tournament = await getTournament(id);
  return tournament
    ? NextResponse.json({ tournament })
    : NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
}

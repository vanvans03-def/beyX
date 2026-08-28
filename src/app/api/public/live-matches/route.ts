import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/db/admin';

export async function GET(request: Request) {
  const value = new URL(request.url).searchParams.get('tournamentId');
  let builder = adminDb.from('matches').select('*').order('updated_at', { ascending: false }).limit(20);
  if (value) {
    const tournamentId = Number(value);
    if (!Number.isSafeInteger(tournamentId)) return NextResponse.json({ error: 'Invalid tournamentId' }, { status: 400 });
    builder = builder.eq('tournament_id', tournamentId);
  }
  const { data, error } = await builder;
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ matches: data });
}

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/db/admin';
import { getTournament } from '@/lib/repository';

async function authorize(request: Request, tournamentId: string) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const tournament = await getTournament(tournamentId);
  if (!tournament || (tournament.user_id && tournament.user_id !== userId)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { userId };
}

export async function GET(request: Request) {
  const tournamentId = new URL(request.url).searchParams.get('tournamentId');
  if (!tournamentId) return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
  const auth = await authorize(request, tournamentId);
  if (auth.error) return auth.error;
  const { data, error } = await adminDb.from('match_locks').select('*').eq('tournament_id', tournamentId);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ locks: data });
}

export async function POST(request: Request) {
  const body = await request.json();
  const tournamentId = String(body.tournamentId || '');
  const auth = await authorize(request, tournamentId);
  if (auth.error || !auth.userId) return auth.error;

  if (body.action === 'unlock') {
    const { error } = await adminDb.from('match_locks').delete()
      .eq('match_id', body.matchId).eq('tournament_id', tournamentId);
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ success: true });
  }
  if (body.action !== 'lock') return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  const { data: user, error: userError } = await adminDb.from('users')
    .select('username, shop_name').eq('id', auth.userId).single();
  if (userError || !user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const { error } = await adminDb.from('match_locks').upsert({
    match_id: body.matchId,
    tournament_id: tournamentId,
    judge_name: user.username,
    judge_shop: user.shop_name,
    user_id: user.username,
    arena_number: body.arenaId || null,
  }, { onConflict: 'match_id' });
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ success: true });
}

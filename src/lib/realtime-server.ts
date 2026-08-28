import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { query } from '@/lib/db/pool';

const CHANNEL = 'beyx_tournament_updates';

export type TournamentUpdate = {
  tournamentId: string;
  event: 'match-update' | 'bracket-update' | 'registration-update';
  matchId?: string | number;
  occurredAt: string;
};

export async function publishTournamentUpdate(
  update: Omit<TournamentUpdate, 'occurredAt'>,
): Promise<void> {
  const payload: TournamentUpdate = { ...update, occurredAt: new Date().toISOString() };
  if (process.env.REALTIME_BACKEND === 'postgres' || process.env.DATA_BACKEND === 'postgres') {
    await query('SELECT pg_notify($1, $2)', [CHANNEL, JSON.stringify(payload)]);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;
  const client = createClient(url, serviceKey, { auth: { persistSession: false } });
  const channel = client.channel(`admin-tournament-${update.tournamentId}`);
  await channel.send({ type: 'broadcast', event: update.event, payload });
  await client.removeChannel(channel);
}

export const tournamentUpdateChannel = CHANNEL;

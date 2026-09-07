import 'server-only';
import { getCachedData, setCachedData, singleFlight } from '@/lib/redis';
import {
  getTournament,
  type Tournament,
} from '@/lib/repository';

type SerializedTournament = Omit<Tournament, 'created_at'> & { created_at: string };

function serializeTournament(tournament: Tournament): SerializedTournament {
  return { ...tournament, created_at: tournament.created_at.toISOString() };
}

function reviveTournament(tournament: SerializedTournament): Tournament {
  return { ...tournament, created_at: new Date(tournament.created_at) };
}

export async function getPublicRegistrationTournament(id: string): Promise<Tournament | null> {
  const key = `public:registration:tournament:${id.toLowerCase()}`;
  const cached = await getCachedData<SerializedTournament>(key);
  if (cached) return reviveTournament(cached);

  return singleFlight(key, async () => {
    const filled = await getCachedData<SerializedTournament>(key);
    if (filled) return reviveTournament(filled);
    const tournament = await getTournament(id);
    if (!tournament) return null;
    await setCachedData(key, serializeTournament(tournament), tournament.status === 'OPEN' ? 5 : 60);
    return tournament;
  });
}

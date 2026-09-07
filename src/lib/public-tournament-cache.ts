import 'server-only';
import { getCachedData, setCachedData, singleFlight } from '@/lib/redis';
import {
  getRegistrations,
  getTournament,
  getTournamentByShortId,
  type Registration,
  type Tournament,
} from '@/lib/repository';

type SerializedTournament = Omit<Tournament, 'created_at'> & { created_at: string };
type PublicPagePayload = { tournament: SerializedTournament; registrations: Registration[] };

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

export async function getPublicTournamentPage(
  shopName: string,
  id: string,
): Promise<{ tournament: Tournament; registrations: Registration[] } | null> {
  const routeKey = `${decodeURIComponent(shopName).trim().toLocaleLowerCase('th-TH')}:${id.trim().toLowerCase()}`;
  const key = `public:tournament-page:${routeKey}`;
  const cached = await getCachedData<PublicPagePayload>(key);
  if (cached) return { tournament: reviveTournament(cached.tournament), registrations: cached.registrations };

  return singleFlight(key, async () => {
    const filled = await getCachedData<PublicPagePayload>(key);
    if (filled) return { tournament: reviveTournament(filled.tournament), registrations: filled.registrations };
    const tournament = await getTournamentByShortId(shopName, id);
    if (!tournament) return null;
    const registrations = await getRegistrations(tournament.id);
    await setCachedData(key, { tournament: serializeTournament(tournament), registrations }, tournament.status === 'OPEN' ? 5 : 60);
    return { tournament, registrations };
  });
}

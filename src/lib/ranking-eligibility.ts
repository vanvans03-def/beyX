import { supabaseAdmin } from '@/lib/supabase';

export const EXCLUDED_RANKING_USERNAMES = new Set(['test', 'admin2', 'admin', 'superadmin']);

export function isExcludedRankingUsername(username: string | null | undefined) {
    return EXCLUDED_RANKING_USERNAMES.has((username || '').trim().toLocaleLowerCase('en-US'));
}

export async function getExcludedTournamentIds(tournamentIds: string[]) {
    const uniqueIds = [...new Set(tournamentIds)];
    if (uniqueIds.length === 0) return new Set<string>();
    const tournaments: { id: string; user_id: string; is_excluded_from_rankings: boolean }[] = [];
    for (let index = 0; index < uniqueIds.length; index += 100) {
        const { data, error } = await supabaseAdmin
            .from('tournaments')
            .select('id, user_id, is_excluded_from_rankings')
            .in('id', uniqueIds.slice(index, index + 100));
        if (error) throw new Error(error.message);
        tournaments.push(...(data || []));
    }

    const organizerIds = [...new Set(tournaments.map(tournament => tournament.user_id).filter(Boolean))];
    const organizers: { id: string; username: string; ranking_organizer_enabled: boolean }[] = [];
    for (let index = 0; index < organizerIds.length; index += 100) {
        const { data, error } = await supabaseAdmin.from('users').select('id, username, ranking_organizer_enabled').in('id', organizerIds.slice(index, index + 100));
        if (error) throw new Error(error.message);
        organizers.push(...(data || []));
    }
    const organizersById = new Map(organizers.map(organizer => [organizer.id, organizer]));

    return new Set(tournaments
        .filter(tournament => {
            const organizer = organizersById.get(tournament.user_id);
            return tournament.is_excluded_from_rankings
                || !organizer?.ranking_organizer_enabled
                || isExcludedRankingUsername(organizer.username);
        })
        .map(tournament => tournament.id));
}

export async function isTournamentExcludedFromRankings(tournamentId: string) {
    return (await getExcludedTournamentIds([tournamentId])).has(tournamentId);
}

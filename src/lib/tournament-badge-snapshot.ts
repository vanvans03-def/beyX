import { supabaseAdmin } from '@/lib/supabase';
import { getRankingBadgesForNames, type RankingBadges } from '@/lib/ranking-badges';
import { normalizePlayerName } from '@/lib/player-rankings';

export type TournamentBadgeSnapshot = Record<string, RankingBadges>;

export async function createTournamentBadgeSnapshot(
    tournamentId: string,
    playerNames: string[],
): Promise<TournamentBadgeSnapshot> {
    const badges = await getRankingBadgesForNames(playerNames);
    const { error } = await supabaseAdmin
        .from('tournaments')
        .update({
            ranking_badges_snapshot: badges,
            ranking_badges_snapshotted_at: new Date().toISOString(),
        })
        .eq('id', tournamentId);
    if (error) throw new Error(`Unable to save ranking badge snapshot: ${error.message}`);
    return badges;
}

export async function getOrCreateTournamentBadgeSnapshot(
    tournamentId: string,
): Promise<TournamentBadgeSnapshot> {
    const { data, error } = await supabaseAdmin
        .from('tournaments')
        .select('status, ranking_badges_snapshot')
        .eq('id', tournamentId)
        .single();
    if (error) throw new Error(`Unable to load ranking badge snapshot: ${error.message}`);

    const existing = data?.ranking_badges_snapshot;
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
        return existing as TournamentBadgeSnapshot;
    }
    if (data.status === 'OPEN') return {};

    // Backfill legacy tournaments deterministically from their registrations.
    // Never trust query-string names when persisting a tournament snapshot.
    const { data: registrations, error: registrationsError } = await supabaseAdmin
        .from('registrations')
        .select('player_name')
        .eq('tournament_id', tournamentId);
    if (registrationsError) throw new Error(`Unable to load registered players for badge snapshot: ${registrationsError.message}`);
    return createTournamentBadgeSnapshot(
        tournamentId,
        (registrations || []).map(registration => registration.player_name),
    );
}

export function selectRequestedBadges(snapshot: TournamentBadgeSnapshot, playerNames: string[]) {
    return Object.fromEntries(playerNames.flatMap(name => {
        const normalizedName = normalizePlayerName(name);
        return normalizedName && snapshot[normalizedName] ? [[normalizedName, snapshot[normalizedName]]] : [];
    }));
}

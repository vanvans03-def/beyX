import { supabaseAdmin } from '@/lib/supabase';
import { isTournamentExcludedFromRankings } from '@/lib/ranking-eligibility';

export type TournamentStanding = {
    name: string;
    rank?: number;
};

type RegistrationRecord = { id: string; player_name: string };
type InternalMatchRecord = {
    id: string;
    round: number;
    state: string;
    winner_id: string | null;
    player1_id: string | null;
    player2_id: string | null;
    scores_csv: string | null;
    is_grand_final: boolean | null;
    is_reset_match: boolean | null;
    updated_at: string | null;
};

const POINTS_BY_PLACEMENT: Record<number, number> = { 1: 5, 2: 3, 3: 2, 4: 1 };

export function normalizePlayerName(name: string): string {
    return name.normalize('NFKC').trim().toLocaleLowerCase('th-TH').replace(/\s+/g, ' ');
}

async function resolvePlayerId(name: string): Promise<string> {
    const normalizedName = normalizePlayerName(name);
    if (!normalizedName) throw new Error('Player name is required to award ranking points');

    const { data: alias, error: aliasError } = await supabaseAdmin
        .from('player_aliases')
        .select('player_id')
        .eq('normalized_name', normalizedName)
        .maybeSingle();
    if (aliasError) throw new Error(aliasError.message);
    if (alias) return alias.player_id;

    const { data: player, error: playerError } = await supabaseAdmin
        .from('players')
        .insert({ display_name: name.trim() })
        .select('id')
        .single();
    if (playerError || !player) throw new Error(playerError?.message || 'Failed to create player profile');

    const { error: insertAliasError } = await supabaseAdmin
        .from('player_aliases')
        .insert({ player_id: player.id, alias_name: name.trim(), normalized_name: normalizedName });
    if (!insertAliasError) return player.id;

    // A concurrent request may have claimed this alias. Reuse that identity instead.
    const { data: existingAlias, error: retryError } = await supabaseAdmin
        .from('player_aliases')
        .select('player_id')
        .eq('normalized_name', normalizedName)
        .maybeSingle();
    if (retryError || !existingAlias) throw new Error(retryError?.message || insertAliasError.message);
    return existingAlias.player_id;
}

export async function recordTournamentResults(
    tournamentId: string,
    source: 'INTERNAL' | 'CHALLONGE' | 'MANUAL',
    standings: TournamentStanding[],
    completedAt = new Date(),
): Promise<number> {
    if (await isTournamentExcludedFromRankings(tournamentId)) {
        const [{ error: deleteError }, { error: tournamentError }] = await Promise.all([
            supabaseAdmin.from('tournament_results').delete().eq('tournament_id', tournamentId),
            supabaseAdmin.from('tournaments').update({ completed_at: completedAt.toISOString() }).eq('id', tournamentId),
        ]);
        if (deleteError) throw new Error(deleteError.message);
        if (tournamentError) throw new Error(tournamentError.message);
        return 0;
    }
    const uniqueNames = new Set<string>();
    const topFour = standings
        .filter((standing) => standing.name?.trim())
        .filter((standing) => {
            const key = normalizePlayerName(standing.name);
            if (uniqueNames.has(key)) return false;
            uniqueNames.add(key);
            return true;
        })
        .slice(0, 4);

    if (topFour.length === 0) throw new Error('Cannot award ranking points without final standings');

    const rows = await Promise.all(topFour.map(async (standing, index) => {
        const placement = index + 1;
        return {
            tournament_id: tournamentId,
            player_id: await resolvePlayerId(standing.name),
            player_name_at_award: standing.name.trim(),
            placement,
            points: POINTS_BY_PLACEMENT[placement],
            source,
            tournament_completed_at: completedAt.toISOString(),
            awarded_at: new Date().toISOString(),
        };
    }));

    // Replacing a tournament's ledger makes a retry or an approved result correction idempotent.
    const { error: deleteError } = await supabaseAdmin
        .from('tournament_results')
        .delete()
        .eq('tournament_id', tournamentId);
    if (deleteError) throw new Error(deleteError.message);

    const { error: insertError } = await supabaseAdmin.from('tournament_results').insert(rows);
    if (insertError) throw new Error(insertError.message);

    const { error: tournamentError } = await supabaseAdmin
        .from('tournaments')
        .update({ completed_at: completedAt.toISOString() })
        .eq('id', tournamentId);
    if (tournamentError) throw new Error(tournamentError.message);

    return rows.length;
}

export async function getInternalTopFour(tournamentId: string): Promise<TournamentStanding[]> {
    const [{ data: matches, error: matchesError }, { data: registrations, error: registrationsError }] = await Promise.all([
        supabaseAdmin.from('internal_matches').select('*').eq('tournament_id', tournamentId),
        supabaseAdmin.from('registrations').select('id, player_name').eq('tournament_id', tournamentId),
    ]);
    if (matchesError) throw new Error(matchesError.message);
    if (registrationsError) throw new Error(registrationsError.message);

    const playerNames = new Map(((registrations || []) as RegistrationRecord[]).map((registration) => [registration.id, registration.player_name]));
    const completed = ((matches || []) as InternalMatchRecord[]).filter((match) =>
        match.state === 'COMPLETE' && match.winner_id && !String(match.scores_csv || '').includes('BYE'),
    );
    const playedWinners = completed.filter((match) => match.round > 0);
    // A completed reset match is the actual championship decider. Prefer it even
    // if an older bracket stored its round incorrectly, then fall back to the
    // Grand Final or the highest completed winners-bracket round.
    const finalMatch = completed.filter((match) => match.is_reset_match)
        .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())[0]
        || completed.filter((match) => match.is_grand_final)
            .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())[0]
        || playedWinners.sort((a, b) => b.round - a.round || new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())[0];
    if (!finalMatch) return [];

    const result: TournamentStanding[] = [];
    const used = new Set<string>();
    const add = (id: string | null | undefined) => {
        const name = id ? playerNames.get(id) : null;
        if (name && !used.has(id!)) {
            used.add(id!);
            result.push({ name, rank: result.length + 1 });
        }
    };

    add(finalMatch.winner_id);
    add(finalMatch.winner_id === finalMatch.player1_id ? finalMatch.player2_id : finalMatch.player1_id);

    // Elimination order yields the remaining podium places for both single and double brackets.
    completed
        .filter((match) => match.id !== finalMatch.id)
        .sort((a, b) => Math.abs(b.round) - Math.abs(a.round) || new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())
        .forEach((match) => add(match.winner_id === match.player1_id ? match.player2_id : match.player1_id));

    return result.slice(0, 4);
}

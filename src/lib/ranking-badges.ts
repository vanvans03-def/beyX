import { supabaseAdmin } from '@/lib/supabase';
import { getExcludedTournamentIds } from '@/lib/ranking-eligibility';
import { normalizePlayerName } from '@/lib/player-rankings';

type ResultRow = { tournament_id: string; tournament_completed_at: string; points: number; placement: number; player_id: string };
type PlayerRow = { id: string; display_name: string };
type WinRateRow = { player_id: string; period_month: string; win_rate: number; wins: number; matches: number };
export type BadgePeriod = { rank: number; period: string };

export type RankingBadges = { monthly?: number; yearly?: number; winrate?: number; monthlyPeriods?: BadgePeriod[]; winratePeriods?: BadgePeriod[] };

function rankTopFour(rows: ResultRow[], names: Map<string, string>, excludedIds: Set<string>) {
    const totals = new Map<string, { points: number; championships: number; topFour: number; name: string }>();
    for (const row of rows) {
        if (excludedIds.has(row.tournament_id)) continue;
        const name = names.get(row.player_id);
        if (!name) continue;
        const total = totals.get(row.player_id) || { name, points: 0, championships: 0, topFour: 0 };
        total.points += row.points;
        total.topFour += 1;
        if (row.placement === 1) total.championships += 1;
        totals.set(row.player_id, total);
    }
    return [...totals.entries()]
        .sort(([, a], [, b]) => b.points - a.points || b.championships - a.championships || b.topFour - a.topFour || a.name.localeCompare(b.name, 'th'))
        .slice(0, 4)
        .map(([playerId], index) => [playerId, index + 1] as const);
}

function rankWinRateByMonth(rows: WinRateRow[]): Map<string, BadgePeriod[]> {
    const awards = new Map<string, BadgePeriod[]>();
    const byPeriod = new Map<string, WinRateRow[]>();
    rows.forEach(row => {
        const period = row.period_month.slice(0, 7);
        byPeriod.set(period, [...(byPeriod.get(period) || []), row]);
    });
    byPeriod.forEach((periodRows, period) => {
        const sorted = [...periodRows].sort((a, b) => Number(b.win_rate) - Number(a.win_rate) || b.wins - a.wins || b.matches - a.matches);
        const fourthRate = sorted[3]?.win_rate;
        sorted.forEach((row, index) => {
            const rank = index < 4 ? index + 1 : Number(row.win_rate) === Number(fourthRate) ? 4 : undefined;
            if (!rank) return;
            awards.set(row.player_id, [...(awards.get(row.player_id) || []), { rank, period }]);
        });
    });
    return awards;
}

export async function getRankingBadgesForNames(rawNames: string[]): Promise<Record<string, RankingBadges>> {
    const requestedNames = [...new Set(rawNames.map(name => name.trim()).filter(Boolean))];
    const normalizedNames = [...new Set(requestedNames.map(normalizePlayerName).filter(Boolean))];
    if (!normalizedNames.length) return {};
    const now = new Date();
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const [{ data: aliases, error: aliasesError }, { data: directPlayers, error: directPlayersError }, { data: results, error: resultsError }, { data: winRateRows, error: winRateError }] = await Promise.all([
        supabaseAdmin.from('player_aliases').select('normalized_name, player_id').in('normalized_name', normalizedNames),
        // Older ranking imports created player profiles before aliases existed.
        // Match their canonical display name too, then normalize it below.
        supabaseAdmin.from('players').select('id, display_name').in('display_name', requestedNames),
        supabaseAdmin.from('tournament_results').select('tournament_id, tournament_completed_at, points, placement, player_id'),
        supabaseAdmin.from('player_win_rate_totals').select('player_id, period_month, win_rate, wins, matches'),
    ]);
    if (aliasesError) throw new Error(aliasesError.message);
    if (directPlayersError) throw new Error(directPlayersError.message);
    if (resultsError) throw new Error(resultsError.message);
    if (winRateError) throw new Error(winRateError.message);

    const resultRows = (results || []) as ResultRow[];
    const allPlayerIds = [...new Set(resultRows.map(row => row.player_id))];
    const { data: players, error: playersError } = allPlayerIds.length
        ? await supabaseAdmin.from('players').select('id, display_name').in('id', allPlayerIds).eq('is_hidden_from_rankings', false)
        : { data: [], error: null };
    if (playersError) throw new Error(playersError.message);

    const names = new Map((players || []).map((player: PlayerRow) => [player.id, player.display_name]));
    const excludedIds = await getExcludedTournamentIds(resultRows.map(row => row.tournament_id));
    const monthlyAwards = new Map<string, BadgePeriod[]>();
    const rowsByMonth = new Map<string, ResultRow[]>();
    resultRows.forEach(row => {
        const period = row.tournament_completed_at.slice(0, 7);
        rowsByMonth.set(period, [...(rowsByMonth.get(period) || []), row]);
    });
    rowsByMonth.forEach((monthRows, period) => rankTopFour(monthRows, names, excludedIds).forEach(([playerId, rank]) => {
        monthlyAwards.set(playerId, [...(monthlyAwards.get(playerId) || []), { rank, period }]);
    }));
    const yearlyRanks = new Map(rankTopFour(resultRows.filter(row => new Date(row.tournament_completed_at) >= yearStart), names, excludedIds));
    const winRateAwards = rankWinRateByMonth((winRateRows || []) as WinRateRow[]);

    const playerIdByName = new Map<string, string>();
    (aliases || []).forEach(alias => playerIdByName.set(alias.normalized_name, alias.player_id));
    (directPlayers || []).forEach((player: PlayerRow) => playerIdByName.set(normalizePlayerName(player.display_name), player.id));

    return Object.fromEntries(normalizedNames.flatMap(normalizedName => {
        const playerId = playerIdByName.get(normalizedName);
        if (!playerId) return [];
        const monthlyPeriods = (monthlyAwards.get(playerId) || []).sort((a, b) => a.period.localeCompare(b.period));
        const winratePeriods = (winRateAwards.get(playerId) || []).sort((a, b) => a.period.localeCompare(b.period));
        return [[normalizedName, {
            ...(monthlyPeriods.length ? { monthly: Math.min(...monthlyPeriods.map(award => award.rank)), monthlyPeriods } : {}),
            ...(yearlyRanks.has(playerId) ? { yearly: yearlyRanks.get(playerId) } : {}),
            ...(winratePeriods.length ? { winrate: Math.min(...winratePeriods.map(award => award.rank)), winratePeriods } : {}),
        }]];
    }));
}

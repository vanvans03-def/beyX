import { supabaseAdmin } from '@/lib/supabase';
import { getExcludedTournamentIds } from '@/lib/ranking-eligibility';
import { normalizePlayerName } from '@/lib/player-rankings';
import { assignCompetitionRanks } from '@/lib/competition-ranking';

type ResultRow = { tournament_id: string; tournament_completed_at: string; points: number; placement: number; player_id: string };
type PlayerRow = { id: string; display_name: string };
type WinRateRow = { player_id: string; period_month: string; win_rate: number; wins: number; matches: number };
type MatchTotals = Map<string, { wins: number; matches: number }>;
type PointsRanking = {
    playerId: string;
    rank: number;
    points: number;
    championships: number;
    topFour: number;
    wins: number;
    matches: number;
};

export type BadgePeriod = { rank: number; period: string };
export type BadgeHistoryEntry = {
    type: 'monthly' | 'yearly' | 'winrate';
    rank: number;
    period: string;
    points?: number;
    championships?: number;
    topFour?: number;
    wins: number;
    matches: number;
    winRate?: number;
};

export type RankingBadges = {
    monthly?: number;
    yearly?: number;
    winrate?: number;
    monthlyPeriods?: BadgePeriod[];
    winratePeriods?: BadgePeriod[];
    history?: BadgeHistoryEntry[];
};

const PAGE_SIZE = 1000;

async function fetchAllResults(): Promise<ResultRow[]> {
    const rows: ResultRow[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabaseAdmin.from('tournament_results')
            .select('tournament_id, tournament_completed_at, points, placement, player_id')
            .order('tournament_completed_at', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);
        if (error) throw new Error(error.message);
        const page = (data || []) as ResultRow[];
        rows.push(...page);
        if (page.length < PAGE_SIZE) return rows;
    }
}

async function fetchAllWinRateRows(): Promise<WinRateRow[]> {
    const rows: WinRateRow[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabaseAdmin.from('player_win_rate_totals')
            .select('player_id, period_month, win_rate, wins, matches')
            .order('period_month', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);
        if (error) throw new Error(error.message);
        const page = (data || []) as WinRateRow[];
        rows.push(...page);
        if (page.length < PAGE_SIZE) return rows;
    }
}

function sumMatchTotals(rows: WinRateRow[]): MatchTotals {
    const totals: MatchTotals = new Map();
    rows.forEach(row => {
        const current = totals.get(row.player_id) || { wins: 0, matches: 0 };
        current.wins += row.wins;
        current.matches += row.matches;
        totals.set(row.player_id, current);
    });
    return totals;
}

function rankTopFour(rows: ResultRow[], names: Map<string, string>, excludedIds: Set<string>, matchTotals: MatchTotals): PointsRanking[] {
    const totals = new Map<string, { points: number; championships: number; topFour: number; wins: number; matches: number; name: string }>();
    for (const row of rows) {
        if (excludedIds.has(row.tournament_id)) continue;
        const name = names.get(row.player_id);
        if (!name) continue;
        const total = totals.get(row.player_id) || { name, points: 0, championships: 0, topFour: 0, ...(matchTotals.get(row.player_id) || { wins: 0, matches: 0 }) };
        total.points += row.points;
        total.topFour += 1;
        if (row.placement === 1) total.championships += 1;
        totals.set(row.player_id, total);
    }
    const sorted = [...totals.entries()]
        .map(([playerId, total]) => ({ playerId, ...total }))
        .sort((a, b) => b.points - a.points || b.wins - a.wins || b.matches - a.matches || a.name.localeCompare(b.name, 'th'));
    return assignCompetitionRanks(sorted, (current, previous) =>
        current.points === previous.points
        && current.wins === previous.wins
        && current.matches === previous.matches,
    ).filter(({ rank }) => rank <= 4);
}

function groupByPeriod<T>(rows: T[], getPeriod: (row: T) => string): Map<string, T[]> {
    const grouped = new Map<string, T[]>();
    rows.forEach(row => {
        const period = getPeriod(row);
        grouped.set(period, [...(grouped.get(period) || []), row]);
    });
    return grouped;
}

function addHistoryEntry(historyByPlayer: Map<string, BadgeHistoryEntry[]>, playerId: string, entry: BadgeHistoryEntry) {
    historyByPlayer.set(playerId, [...(historyByPlayer.get(playerId) || []), entry]);
}

export async function getRankingBadgesForNames(rawNames: string[]): Promise<Record<string, RankingBadges>> {
    const requestedNames = [...new Set(rawNames.map(name => name.trim()).filter(Boolean))];
    const normalizedNames = [...new Set(requestedNames.map(normalizePlayerName).filter(Boolean))];
    if (!normalizedNames.length) return {};

    const now = new Date();
    const currentPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const currentYear = String(now.getUTCFullYear());
    const [{ data: aliases, error: aliasesError }, { data: directPlayers, error: directPlayersError }, resultRows, winRateRows] = await Promise.all([
        supabaseAdmin.from('player_aliases').select('normalized_name, player_id').in('normalized_name', normalizedNames),
        // Older ranking imports created player profiles before aliases existed.
        supabaseAdmin.from('players').select('id, display_name').in('display_name', requestedNames),
        fetchAllResults(),
        fetchAllWinRateRows(),
    ]);
    if (aliasesError) throw new Error(aliasesError.message);
    if (directPlayersError) throw new Error(directPlayersError.message);

    const allPlayerIds = [...new Set(resultRows.map(row => row.player_id))];
    const { data: players, error: playersError } = allPlayerIds.length
        ? await supabaseAdmin.from('players').select('id, display_name').in('id', allPlayerIds).eq('is_hidden_from_rankings', false)
        : { data: [], error: null };
    if (playersError) throw new Error(playersError.message);

    const names = new Map((players || []).map((player: PlayerRow) => [player.id, player.display_name]));
    const excludedIds = await getExcludedTournamentIds(resultRows.map(row => row.tournament_id));
    const resultsByMonth = groupByPeriod(resultRows, row => row.tournament_completed_at.slice(0, 7));
    const resultsByYear = groupByPeriod(resultRows, row => row.tournament_completed_at.slice(0, 4));
    const winRatesByMonth = groupByPeriod(winRateRows, row => row.period_month.slice(0, 7));
    const winRatesByYear = groupByPeriod(winRateRows, row => row.period_month.slice(0, 4));
    const historyByPlayer = new Map<string, BadgeHistoryEntry[]>();

    resultsByMonth.forEach((periodRows, period) => {
        rankTopFour(periodRows, names, excludedIds, sumMatchTotals(winRatesByMonth.get(period) || [])).forEach(ranking => {
            addHistoryEntry(historyByPlayer, ranking.playerId, {
                type: 'monthly', period, rank: ranking.rank, points: ranking.points,
                championships: ranking.championships, topFour: ranking.topFour,
                wins: ranking.wins, matches: ranking.matches,
            });
        });
    });

    resultsByYear.forEach((periodRows, period) => {
        rankTopFour(periodRows, names, excludedIds, sumMatchTotals(winRatesByYear.get(period) || [])).forEach(ranking => {
            addHistoryEntry(historyByPlayer, ranking.playerId, {
                type: 'yearly', period, rank: ranking.rank, points: ranking.points,
                championships: ranking.championships, topFour: ranking.topFour,
                wins: ranking.wins, matches: ranking.matches,
            });
        });
    });

    winRatesByMonth.forEach((periodRows, period) => {
        const sorted = [...periodRows].sort((a, b) => Number(b.win_rate) - Number(a.win_rate) || b.wins - a.wins || b.matches - a.matches);
        assignCompetitionRanks(sorted, (current, previous) =>
            Number(current.win_rate) === Number(previous.win_rate)
            && current.wins === previous.wins
            && current.matches === previous.matches,
        ).filter(({ rank }) => rank <= 4).forEach(({ rank, ...row }) => {
            addHistoryEntry(historyByPlayer, row.player_id, {
                type: 'winrate', period, rank, winRate: Number(row.win_rate), wins: row.wins, matches: row.matches,
            });
        });
    });

    const playerIdByName = new Map<string, string>();
    (aliases || []).forEach(alias => playerIdByName.set(alias.normalized_name, alias.player_id));
    (directPlayers || []).forEach((player: PlayerRow) => playerIdByName.set(normalizePlayerName(player.display_name), player.id));

    return Object.fromEntries(normalizedNames.flatMap(normalizedName => {
        const playerId = playerIdByName.get(normalizedName);
        if (!playerId) return [];
        const history = [...(historyByPlayer.get(playerId) || [])].sort((a, b) =>
            b.period.localeCompare(a.period) || a.type.localeCompare(b.type) || a.rank - b.rank,
        );
        const monthly = history.find(entry => entry.type === 'monthly' && entry.period === currentPeriod);
        const yearly = history.find(entry => entry.type === 'yearly' && entry.period === currentYear);
        const winrate = history.find(entry => entry.type === 'winrate' && entry.period === currentPeriod);
        return [[normalizedName, {
            ...(monthly ? { monthly: monthly.rank, monthlyPeriods: [{ rank: monthly.rank, period: monthly.period }] } : {}),
            ...(yearly ? { yearly: yearly.rank } : {}),
            ...(winrate ? { winrate: winrate.rank, winratePeriods: [{ rank: winrate.rank, period: winrate.period }] } : {}),
            ...(history.length ? { history } : {}),
        }]];
    }));
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getExcludedTournamentIds } from '@/lib/ranking-eligibility';
import { assignCompetitionRanks } from '@/lib/competition-ranking';

export const dynamic = 'force-dynamic';

type RankingResultRow = {
    tournament_id: string;
    placement: number;
    points: number;
    player_id: string;
};

type PlayerRow = { id: string; display_name: string };
type MatchTotalRow = { player_id: string; wins: number; matches: number };

async function getWinRateRankings(period: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('period must use YYYY-MM for Win Rate rankings');
    const { data, error } = await supabaseAdmin
        .from('player_win_rate_totals')
        .select('player_id, display_name, wins, matches, win_rate')
        .eq('period_month', `${period}-01`)
        .order('win_rate', { ascending: false })
        .order('wins', { ascending: false })
        .order('matches', { ascending: false })
        .order('display_name', { ascending: true });
    if (error) throw new Error(error.message);
    const rows = (data || []).map(row => ({
        playerId: row.player_id,
        name: row.display_name,
        wins: row.wins,
        matches: row.matches,
        winRate: Number(row.win_rate),
    }));
    return assignCompetitionRanks(rows, (current, previous) =>
        current.winRate === previous.winRate
        && current.wins === previous.wins
        && current.matches === previous.matches,
    );
}

function getPeriod(searchParams: URLSearchParams): { start: Date; end: Date; period: string } {
    const now = new Date();
    const scope = searchParams.get('scope') === 'year' ? 'year' : 'month';
    const requested = searchParams.get('period');
    const fallback = scope === 'year'
        ? String(now.getUTCFullYear())
        : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const period = requested || fallback;

    if (scope === 'year') {
        if (!/^\d{4}$/.test(period)) throw new Error('period must use YYYY for yearly rankings');
        const year = Number(period);
        return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)), period };
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('period must use YYYY-MM for monthly rankings');
    const [year, month] = period.split('-').map(Number);
    return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)), period };
}

export async function GET(request: Request) {
    try {
        const searchParams = new URL(request.url).searchParams;
        if (searchParams.get('scope') === 'winrate') {
            const now = new Date();
            const period = searchParams.get('period') || `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
            return NextResponse.json({ success: true, period, rankings: await getWinRateRankings(period) });
        }
        const { start, end, period } = getPeriod(searchParams);
        const [{ data, error }, { data: matchTotalRows, error: matchTotalsError }] = await Promise.all([
            supabaseAdmin
                .from('tournament_results')
                .select('tournament_id, placement, points, player_id')
                .gte('tournament_completed_at', start.toISOString())
                .lt('tournament_completed_at', end.toISOString()),
            supabaseAdmin
                .from('player_win_rate_totals')
                .select('player_id, wins, matches')
                .gte('period_month', start.toISOString().slice(0, 10))
                .lt('period_month', end.toISOString().slice(0, 10)),
        ]);
        if (error) throw new Error(error.message);
        if (matchTotalsError) throw new Error(matchTotalsError.message);
        const excludedTournamentIds = await getExcludedTournamentIds((data || []).map(row => row.tournament_id));

        const playerIds = [...new Set((data || []).map((row: RankingResultRow) => row.player_id))];
        const { data: players, error: playersError } = playerIds.length
            ? await supabaseAdmin.from('players').select('id, display_name').in('id', playerIds).eq('is_hidden_from_rankings', false)
            : { data: [], error: null };
        if (playersError) throw new Error(playersError.message);
        const names = new Map((players || []).map((player: PlayerRow) => [player.id, player.display_name]));

        const matchTotals = new Map<string, { wins: number; matches: number }>();
        for (const row of (matchTotalRows || []) as MatchTotalRow[]) {
            const current = matchTotals.get(row.player_id) || { wins: 0, matches: 0 };
            current.wins += row.wins;
            current.matches += row.matches;
            matchTotals.set(row.player_id, current);
        }

        const totals = new Map<string, { playerId: string; name: string; points: number; championships: number; topFour: number; wins: number; matches: number }>();
        for (const row of (data || []) as RankingResultRow[]) {
            if (excludedTournamentIds.has(row.tournament_id)) continue;
            const name = names.get(row.player_id);
            if (!name) continue;
            const matchTotal = matchTotals.get(row.player_id) || { wins: 0, matches: 0 };
            const current = totals.get(row.player_id) || { playerId: row.player_id, name, points: 0, championships: 0, topFour: 0, ...matchTotal };
            current.points += row.points;
            current.topFour += 1;
            if (row.placement === 1) current.championships += 1;
            totals.set(row.player_id, current);
        }

        const sortedRankings = [...totals.values()].sort((a, b) =>
            b.points - a.points || b.wins - a.wins || b.matches - a.matches || a.name.localeCompare(b.name, 'th'),
        );
        const rankings = assignCompetitionRanks(sortedRankings, (current, previous) =>
            current.points === previous.points
            && current.wins === previous.wins
            && current.matches === previous.matches,
        );

        return NextResponse.json({ success: true, period, rankings });
    } catch (error: unknown) {
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Invalid ranking request' }, { status: 400 });
    }
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getExcludedTournamentIds } from '@/lib/ranking-eligibility';

export const dynamic = 'force-dynamic';

function getPeriod(searchParams: URLSearchParams) {
    const scope = searchParams.get('scope') === 'year' ? 'year' : 'month';
    const period = searchParams.get('period');
    if (!period) return null;
    if (scope === 'year') {
        if (!/^\d{4}$/.test(period)) throw new Error('Invalid year');
        const year = Number(period);
        return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)) };
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Invalid month');
    const [year, month] = period.split('-').map(Number);
    return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const requestedPeriod = getPeriod(new URL(request.url).searchParams);
    const { id } = await params;
    const { data: player, error: playerError } = await supabaseAdmin
        .from('players')
        .select('display_name, is_hidden_from_rankings')
        .eq('id', id)
        .maybeSingle();
    if (playerError || !player || player.is_hidden_from_rankings) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    let resultsQuery = supabaseAdmin
        .from('tournament_results')
        .select('tournament_id, placement, points, tournament_completed_at, player_name_at_award')
        .eq('player_id', id)
        .order('tournament_completed_at', { ascending: false });
    if (requestedPeriod) {
        resultsQuery = resultsQuery
            .gte('tournament_completed_at', requestedPeriod.start.toISOString())
            .lt('tournament_completed_at', requestedPeriod.end.toISOString());
    }
    const { data: results, error } = await resultsQuery;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const excludedTournamentIds = await getExcludedTournamentIds((results || []).map(result => result.tournament_id));
    const visibleResults = (results || []).filter(result => !excludedTournamentIds.has(result.tournament_id));
    const ids = [...new Set(visibleResults.map(result => result.tournament_id))];
    const { data: tournaments } = ids.length ? await supabaseAdmin.from('tournaments').select('id, name, user_id, provider, challonge_url').in('id', ids) : { data: [] };
    const organizerIds = [...new Set((tournaments || []).map(tournament => tournament.user_id).filter(Boolean))];
    const { data: organizers } = organizerIds.length ? await supabaseAdmin.from('users').select('id, shop_name, username').in('id', organizerIds) : { data: [] };
    const organizerDetails = new Map((organizers || []).map(organizer => {
        const urlName = organizer.shop_name?.trim() || organizer.username || '';
        return [organizer.id, { name: urlName || 'Unknown organizer', urlName }];
    }));
    const details = new Map((tournaments || []).map(tournament => [tournament.id, {
        name: tournament.name,
        organizerName: organizerDetails.get(tournament.user_id)?.name || 'Unknown organizer',
        url: tournament.provider === 'CHALLONGE' && tournament.challonge_url
            ? tournament.challonge_url
            : tournament.provider === 'INTERNAL' && organizerDetails.get(tournament.user_id)?.urlName
                ? `/${encodeURIComponent(organizerDetails.get(tournament.user_id)!.urlName)}/${tournament.id.replace(/-/g, '').slice(-8)}`
                : `/register/${tournament.id}`,
        external: tournament.provider === 'CHALLONGE' && Boolean(tournament.challonge_url),
    }]));
    const grouped = new Map<string, typeof visibleResults>();
    for (const result of visibleResults) {
        const name = result.player_name_at_award || player.display_name;
        const rows = grouped.get(name) || [];
        rows.push(result);
        grouped.set(name, rows);
    }
    return NextResponse.json({
        player: player.display_name,
        groups: [...grouped.entries()].map(([name, rows]) => ({ name, results: rows.map(result => ({
            ...result,
            tournament_name: details.get(result.tournament_id)?.name || 'Unknown tournament',
            organizer_name: details.get(result.tournament_id)?.organizerName || 'Unknown organizer',
            tournament_url: details.get(result.tournament_id)?.url || null,
            tournament_external: details.get(result.tournament_id)?.external || false,
        })) })),
    });
}

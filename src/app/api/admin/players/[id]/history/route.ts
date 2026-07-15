import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getExcludedTournamentIds } from '@/lib/ranking-eligibility';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    if (request.headers.get('x-user-role') !== 'superadmin') return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    const { id } = await params;
    const { data: player, error: playerError } = await supabaseAdmin.from('players').select('display_name').eq('id', id).maybeSingle();
    if (playerError || !player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    const { data: results, error } = await supabaseAdmin
        .from('tournament_results')
        .select('tournament_id, placement, points, tournament_completed_at, source, player_name_at_award')
        .eq('player_id', id)
        .order('tournament_completed_at', { ascending: false });
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
        const label = result.player_name_at_award || player.display_name;
        const rows = grouped.get(label) || [];
        rows.push(result);
        grouped.set(label, rows);
    }
    return NextResponse.json({
        player: player.display_name,
        groups: [...grouped.entries()].map(([name, rows]) => ({
            name,
            results: rows.map(result => ({
                ...result,
                tournament_name: details.get(result.tournament_id)?.name || 'Unknown tournament',
                organizer_name: details.get(result.tournament_id)?.organizerName || 'Unknown organizer',
                tournament_url: details.get(result.tournament_id)?.url || null,
                tournament_external: details.get(result.tournament_id)?.external || false,
            })),
        })),
    });
}

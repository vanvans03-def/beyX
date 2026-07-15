import { NextResponse } from 'next/server';
import { isExcludedRankingUsername } from '@/lib/ranking-eligibility';
import { supabaseAdmin } from '@/lib/supabase';
import { refreshPlayerWinRateTotals } from '@/lib/player-win-rate-totals';

export const dynamic = 'force-dynamic';

function isSuperAdmin(request: Request) {
    return request.headers.get('x-user-role') === 'superadmin';
}

export async function GET(request: Request) {
    if (!isSuperAdmin(request)) return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    const { data: tournaments, error } = await supabaseAdmin
        .from('tournaments')
        .select('id, name, user_id, provider, status, created_at, completed_at, challonge_url, is_excluded_from_rankings')
        .order('created_at', { ascending: false })
        .limit(300);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const organizerIds = [...new Set((tournaments || []).map(tournament => tournament.user_id).filter(Boolean))];
    const { data: organizers, error: organizersError } = organizerIds.length
        ? await supabaseAdmin.from('users').select('id, username, ranking_organizer_enabled').in('id', organizerIds)
        : { data: [], error: null };
    if (organizersError) return NextResponse.json({ error: organizersError.message }, { status: 500 });
    const organizersById = new Map((organizers || []).map(organizer => [organizer.id, organizer]));
    return NextResponse.json({ tournaments: (tournaments || []).map(tournament => ({
        ...tournament,
        organizer_id: tournament.user_id,
        organizer_username: organizersById.get(tournament.user_id)?.username || 'Unknown',
        organizer_enabled: Boolean(organizersById.get(tournament.user_id)?.ranking_organizer_enabled),
        automatically_excluded: isExcludedRankingUsername(organizersById.get(tournament.user_id)?.username),
    })) });
}

export async function PATCH(request: Request) {
    if (!isSuperAdmin(request)) return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    try {
        const { action, tournamentId, excluded, organizerId, enabled } = await request.json();
        if (action === 'set_organizer_enabled') {
            if (!organizerId || typeof enabled !== 'boolean') throw new Error('Organizer and approval status are required');
            const { data: organizer, error: organizerError } = await supabaseAdmin
                .from('users').select('id, username').eq('id', organizerId).maybeSingle();
            if (organizerError || !organizer) throw new Error('Organizer not found');
            if (enabled && isExcludedRankingUsername(organizer.username)) throw new Error('Test organizer cannot be approved for rankings');
            const { error: updateError } = await supabaseAdmin
                .from('users').update({ ranking_organizer_enabled: enabled }).eq('id', organizerId);
            if (updateError) throw new Error(updateError.message);
            await refreshPlayerWinRateTotals();
            return NextResponse.json({ success: true });
        }
        if (!tournamentId || typeof excluded !== 'boolean') throw new Error('Tournament and exclusion status are required');
        const { data: tournament, error: tournamentError } = await supabaseAdmin.from('tournaments').select('user_id').eq('id', tournamentId).maybeSingle();
        if (tournamentError || !tournament) throw new Error('Tournament not found');
        const { data: organizer } = await supabaseAdmin.from('users').select('username, ranking_organizer_enabled').eq('id', tournament.user_id).maybeSingle();
        if (!excluded && isExcludedRankingUsername(organizer?.username)) throw new Error('Test organizer tournaments are always excluded from rankings');
        if (!excluded && !organizer?.ranking_organizer_enabled) throw new Error('Approve this organizer before including its tournaments in rankings');
        const { error } = await supabaseAdmin.from('tournaments').update({ is_excluded_from_rankings: excluded }).eq('id', tournamentId);
        if (error) throw new Error(error.message);
        await refreshPlayerWinRateTotals();
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update tournament' }, { status: 400 });
    }
}

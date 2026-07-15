import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { refreshPlayerWinRateTotals } from '@/lib/player-win-rate-totals';

export const dynamic = 'force-dynamic';

function isSuperAdmin(request: Request) {
    return request.headers.get('x-user-role') === 'superadmin';
}

function normalizePlayerName(name: string) {
    return name.normalize('NFKC').trim().toLocaleLowerCase('th-TH').replace(/\s+/g, ' ');
}

export async function GET(request: Request) {
    if (!isSuperAdmin(request)) return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    const query = new URL(request.url).searchParams.get('q')?.trim() || '';
    let builder = supabaseAdmin
        .from('player_ranking_totals')
        .select('player_id, display_name, total_points, championships, top_four_finishes')
        .order('total_points', { ascending: false })
        .order('display_name', { ascending: true })
        .limit(100);
    if (query) builder = builder.ilike('display_name', `%${query}%`);
    const { data, error } = await builder;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ players: data || [] });
}

export async function PATCH(request: Request) {
    if (!isSuperAdmin(request)) return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    try {
        const body = await request.json();
        if (body.action === 'merge') {
            if (!body.sourcePlayerId || !body.targetPlayerId) throw new Error('Choose both players');
            const { error } = await supabaseAdmin.rpc('merge_player_profiles', {
                source_player_id: body.sourcePlayerId,
                target_player_id: body.targetPlayerId,
            });
            if (error) throw new Error(error.message);
            await refreshPlayerWinRateTotals();
            return NextResponse.json({ success: true });
        }
        if (body.action === 'rename') {
            const name = String(body.displayName || '').trim();
            if (!body.playerId || !name) throw new Error('Player and primary name are required');
            const { error } = await supabaseAdmin
                .from('players')
                .update({ display_name: name, updated_at: new Date().toISOString() })
                .eq('id', body.playerId);
            if (error) throw new Error(error.message);
            await refreshPlayerWinRateTotals();
            return NextResponse.json({ success: true });
        }
        if (body.action === 'split_result') {
            const displayName = String(body.displayName || '').trim();
            const normalizedName = normalizePlayerName(displayName);
            if (!body.playerId || !body.tournamentId || !displayName) throw new Error('Player, tournament, and new primary name are required');

            const { data: result, error: resultError } = await supabaseAdmin
                .from('tournament_results')
                .select('id')
                .eq('player_id', body.playerId)
                .eq('tournament_id', body.tournamentId)
                .maybeSingle();
            if (resultError || !result) throw new Error(resultError?.message || 'Tournament result not found for this player');

            const { data: existingAlias, error: aliasLookupError } = await supabaseAdmin
                .from('player_aliases')
                .select('player_id')
                .eq('normalized_name', normalizedName)
                .maybeSingle();
            if (aliasLookupError) throw new Error(aliasLookupError.message);
            if (existingAlias) throw new Error('ชื่อนี้มีอยู่แล้ว กรุณาตั้งชื่อหลักใหม่ที่แตกต่าง เช่น ซัน Junior');

            const { data: newPlayer, error: playerError } = await supabaseAdmin
                .from('players')
                .insert({ display_name: displayName })
                .select('id, display_name')
                .single();
            if (playerError || !newPlayer) throw new Error(playerError?.message || 'Unable to create the new player profile');

            try {
                const { error: aliasError } = await supabaseAdmin.from('player_aliases').insert({
                    player_id: newPlayer.id,
                    alias_name: displayName,
                    normalized_name: normalizedName,
                });
                if (aliasError) throw new Error(aliasError.message);
                const { error: moveError } = await supabaseAdmin
                    .from('tournament_results')
                    .update({ player_id: newPlayer.id, updated_at: new Date().toISOString() })
                    .eq('id', result.id);
                if (moveError) throw new Error(moveError.message);
                await refreshPlayerWinRateTotals();
            } catch (error) {
                await supabaseAdmin.from('player_aliases').delete().eq('player_id', newPlayer.id);
                await supabaseAdmin.from('players').delete().eq('id', newPlayer.id);
                throw error;
            }
            return NextResponse.json({ success: true, player: newPlayer });
        }
        throw new Error('Unsupported player action');
    } catch (error: unknown) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Player update failed' }, { status: 400 });
    }
}

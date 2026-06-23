import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get('tournamentId');

    if (!tournamentId) {
        return NextResponse.json({ error: "Missing tournamentId" }, { status: 400 });
    }

    try {
        // Fetch tournament to find its user_id and tournament format type
        let query = supabaseAdmin.from('tournaments').select('user_id, ban_list, type');
        const looksLikeUUID = tournamentId.includes('-') || (tournamentId.length === 36 || tournamentId.length === 32);
        
        if (looksLikeUUID) {
            query = query.eq('id', tournamentId);
        } else {
            query = query.ilike('name', tournamentId);
        }

        const { data: tournament, error: tErr } = await query.maybeSingle();
        if (tErr || !tournament) {
            return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
        }

        const userId = tournament.user_id;
        const isCustomPointMode = tournament.type === 'U10Custom'; // U10Custom is Custom Point format

        // Fetch user config for cx_enabled
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('cx_enabled')
            .eq('id', userId)
            .single();

        const cxEnabled = user?.cx_enabled ?? true;

        // Fetch all global beyblades
        const { data: beyblades, error: bErr } = await supabaseAdmin
            .from('beyblades')
            .select('*');

        if (bErr) throw bErr;

        // Fetch custom overrides for this user
        const { data: overrides, error: oErr } = await supabaseAdmin
            .from('user_beyblade_points')
            .select('*')
            .eq('user_id', userId);

        if (oErr) throw oErr;

        // Merge overrides
        const resolved = beyblades.map((b: any) => {
            const o = overrides?.find((up: any) => up.beyblade_id === b.id);
            return {
                name: b.name,
                image_url: b.image_url,
                type: b.type || 'BX',
                points_standard: isCustomPointMode && o?.points_standard !== undefined && o?.points_standard !== null 
                    ? o.points_standard 
                    : b.points_standard,
                is_banned: o?.is_banned !== undefined && o?.is_banned !== null ? o.is_banned : b.is_banned
            };
        });

        // Resolved ban list
        const resolvedBanList = resolved.filter(b => b.is_banned).map(b => b.name);

        return NextResponse.json({
            success: true,
            beyblades: resolved,
            banList: resolvedBanList,
            cxEnabled: cxEnabled
        });
    } catch (e: any) {
        console.error("GET register config error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

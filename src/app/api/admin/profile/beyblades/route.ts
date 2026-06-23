import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET all global beyblades merged with user custom overrides
export async function GET(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        // Fetch all global beyblades
        const { data: beyblades, error: bErr } = await supabaseAdmin
            .from('beyblades')
            .select('*')
            .order('name', { ascending: true });

        if (bErr) throw bErr;

        // Fetch custom overrides for this user
        const { data: overrides, error: oErr } = await supabaseAdmin
            .from('user_beyblade_points')
            .select('*')
            .eq('user_id', userId);

        if (oErr) throw oErr;

        // Fetch user config for cx_enabled
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('cx_enabled')
            .eq('id', userId)
            .single();

        const cxEnabled = user?.cx_enabled ?? true;

        // Merge them
        const merged = beyblades.map((b: any) => {
            const override = overrides?.find((o: any) => o.beyblade_id === b.id);
            return {
                ...b,
                custom_points_standard: override ? override.points_standard : null,
                custom_points_south: null, // Removed
                custom_is_banned: override ? override.is_banned : null
            };
        });

        return NextResponse.json({ success: true, beyblades: merged, cx_enabled: cxEnabled });
    } catch (e: any) {
        console.error("GET user beyblades error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST/PUT to upsert custom overrides for a single or multiple beyblades
export async function POST(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        let updates = [];
        let cxEnabled: boolean | undefined = undefined;

        if (Array.isArray(body)) {
            updates = body;
        } else if (body && typeof body === 'object') {
            updates = body.updates || [];
            if (body.cx_enabled !== undefined) {
                cxEnabled = !!body.cx_enabled;
            }
        }

        // 1. Update user settings if cx_enabled is passed
        if (cxEnabled !== undefined) {
            const { error: userErr } = await supabaseAdmin
                .from('users')
                .update({ cx_enabled: cxEnabled })
                .eq('id', userId);
            if (userErr) throw userErr;
        }

        // 2. Update custom points/bans
        for (const item of updates) {
            const { beyblade_id, points_standard, is_banned } = item;
            if (!beyblade_id) continue;

            // If everything is set to null, delete the override row to save space/clean database
            if (points_standard === null && is_banned === null) {
                const { error } = await supabaseAdmin
                    .from('user_beyblade_points')
                    .delete()
                    .eq('user_id', userId)
                    .eq('beyblade_id', beyblade_id);

                if (error) throw error;
            } else {
                // Determine values, keeping them null if explicitly set to null, otherwise parsing
                const valStandard = points_standard === null ? null : (points_standard !== undefined ? Number(points_standard) : undefined);
                const valBanned = is_banned === null ? null : (is_banned !== undefined ? !!is_banned : undefined);

                // Build upsert payload
                const upsertData: any = {
                    user_id: userId,
                    beyblade_id: beyblade_id
                };

                if (valStandard !== undefined) upsertData.points_standard = valStandard;
                if (valBanned !== undefined) upsertData.is_banned = valBanned;

                const { error } = await supabaseAdmin
                    .from('user_beyblade_points')
                    .upsert(upsertData);

                if (error) throw error;
            }
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("POST user beyblades error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

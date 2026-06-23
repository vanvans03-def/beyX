import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET all users (Super Admin only)
export async function GET(req: Request) {
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'superadmin') {
        return NextResponse.json({ error: 'Unauthorized: Super Admin access required' }, { status: 403 });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('users')
            .select('id, username, shop_name, email, role, event_mode_enabled, music_enabled, tts_enabled, challonge_enabled, internal_bracket_enabled')
            .order('username', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ success: true, users: data });
    } catch (e: any) {
        console.error("GET users error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// PATCH update user settings/toggles (Super Admin only)
export async function PATCH(req: Request) {
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'superadmin') {
        return NextResponse.json({ error: 'Unauthorized: Super Admin access required' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const {
            userId,
            event_mode_enabled,
            music_enabled,
            tts_enabled,
            challonge_enabled,
            internal_bracket_enabled,
            role
        } = body;

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const updates: any = {};
        if (event_mode_enabled !== undefined) updates.event_mode_enabled = event_mode_enabled;
        if (music_enabled !== undefined) updates.music_enabled = music_enabled;
        if (tts_enabled !== undefined) updates.tts_enabled = tts_enabled;
        if (challonge_enabled !== undefined) updates.challonge_enabled = challonge_enabled;
        if (internal_bracket_enabled !== undefined) updates.internal_bracket_enabled = internal_bracket_enabled;
        if (role !== undefined) updates.role = role;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('users')
            .update(updates)
            .eq('id', userId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("PATCH user error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

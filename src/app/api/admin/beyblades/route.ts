import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET all global beyblades
export async function GET(req: Request) {
    try {
        const { data, error } = await supabaseAdmin
            .from('beyblades')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ success: true, beyblades: data });
    } catch (e: any) {
        console.error("GET beyblades error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST create new global beyblade (Super Admin only)
export async function POST(req: Request) {
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'superadmin') {
        return NextResponse.json({ error: 'Unauthorized: Super Admin access required' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { name, image_url, points_standard, points_south, is_banned, type } = body;

        if (!name || !image_url) {
            return NextResponse.json({ error: 'Name and image URL are required' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('beyblades')
            .insert({
                name: name.trim(),
                image_url,
                points_standard: Number(points_standard) || 0,
                points_south: Number(points_south) || 0,
                is_banned: !!is_banned,
                type: type || 'BX'
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, beyblade: data });
    } catch (e: any) {
        console.error("POST beyblade error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// PATCH update global beyblade (Super Admin only)
export async function PATCH(req: Request) {
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'superadmin') {
        return NextResponse.json({ error: 'Unauthorized: Super Admin access required' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { id, name, image_url, points_standard, points_south, is_banned, type } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing beyblade ID' }, { status: 400 });
        }

        const updates: any = {};
        if (name !== undefined) updates.name = name.trim();
        if (image_url !== undefined) updates.image_url = image_url;
        if (points_standard !== undefined) updates.points_standard = Number(points_standard);
        if (points_south !== undefined) updates.points_south = Number(points_south);
        if (is_banned !== undefined) updates.is_banned = !!is_banned;
        if (type !== undefined) updates.type = type;

        const { data, error } = await supabaseAdmin
            .from('beyblades')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, beyblade: data });
    } catch (e: any) {
        console.error("PATCH beyblade error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE global beyblade (Super Admin only)
export async function DELETE(req: Request) {
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'superadmin') {
        return NextResponse.json({ error: 'Unauthorized: Super Admin access required' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing beyblade ID' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('beyblades')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("DELETE beyblade error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

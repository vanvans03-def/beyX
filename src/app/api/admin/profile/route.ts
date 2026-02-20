import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'edge';

export async function GET(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabaseAdmin
        .from('users')
        .select('username, shop_name, challonge_api_key')
        .eq('id', userId)
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Don't return full sensitive data if not needed, but here we might need to show if key is set
    return NextResponse.json({ success: true, user: data });
}

export async function PATCH(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { shop_name, challonge_api_key } = body;

        const updates: any = {};
        if (shop_name !== undefined) updates.shop_name = shop_name;
        if (challonge_api_key !== undefined) updates.challonge_api_key = challonge_api_key;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "No fields to update" }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('users')
            .update(updates)
            .eq('id', userId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

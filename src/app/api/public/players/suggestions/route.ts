import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const query = new URL(request.url).searchParams.get('q')?.trim() || '';
    if (query.length < 1) return NextResponse.json({ suggestions: [] });

    const { data, error } = await supabaseAdmin
        .from('player_ranking_totals')
        .select('player_id, display_name, total_points')
        .gt('total_points', 0)
        .ilike('display_name', `%${query}%`)
        .order('total_points', { ascending: false })
        .order('display_name', { ascending: true })
        .limit(8);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ suggestions: data || [] });
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        // Authorization check (optional: strictly restrict to 'admin' username if needed)
        // For now, relying on Middleware which ensures user is logged in.

        const body = await request.json();
        const { username, password, challongeApiKey, shopName } = body;

        if (!username || !password || !challongeApiKey || !shopName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check if username exists
        const { data: existing } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('username', username)
            .single();

        if (existing) {
            return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
        }

        const passwordHash = await hashPassword(password);

        const { error } = await supabaseAdmin
            .from('users')
            .insert({
                username,
                password_hash: passwordHash,
                challonge_api_key: challongeApiKey,
                shop_name: shopName
            });

        if (error) {
            throw new Error(error.message);
        }

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error("Create User Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

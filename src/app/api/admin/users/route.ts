import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword } from '@/lib/auth';


export async function POST(request: Request) {
    try {
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

// Reset password — re-hashes using PBKDF2 (Edge-compatible format)
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { username, newPassword } = body;

        if (!username || !newPassword) {
            return NextResponse.json({ error: 'Missing username or newPassword' }, { status: 400 });
        }

        const passwordHash = await hashPassword(newPassword);

        const { error } = await supabaseAdmin
            .from('users')
            .update({ password_hash: passwordHash })
            .eq('username', username);

        if (error) {
            throw new Error(error.message);
        }

        return NextResponse.json({ success: true, message: 'Password updated successfully' });

    } catch (err: any) {
        console.error("Reset Password Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}


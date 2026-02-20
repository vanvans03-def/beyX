import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyPassword, createSession } from '@/lib/auth';

export const runtime = 'edge';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username, password } = body;

        console.log("Login attempt for:", username);

        if (!username || !password) {
            return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
        }

        // Fetch user from DB
        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !user) {
            console.error("User fetch error:", error);
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        // Verify password
        const isValid = await verifyPassword(password, user.password_hash);
        if (!isValid) {
            console.log("Password mismatch for:", username);
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        // Create Session
        await createSession(user.id, user.username);
        console.log("Session created for:", username);

        return NextResponse.json({ success: true, redirectTo: '/admin' });

    } catch (err) {
        console.error("Login Error:", err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

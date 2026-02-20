import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword } from '@/lib/auth';

// Edge Runtime compatible — does NOT use bcrypt
// Security: only works if the stored hash is a legacy bcrypt hash ($2...)
// Once migrated to PBKDF2, this endpoint rejects the request automatically.
export const runtime = 'edge';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { username, newPassword } = body;

        if (!username || !newPassword) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
        }

        // Fetch user
        const { data, error } = await supabaseAdmin
            .from('users')
            .select('id, password_hash')
            .eq('username', username.trim())
            .single();

        if (error || !data) {
            return NextResponse.json({ error: 'User not found' }, { status: 400 });
        }

        const stored = data.password_hash as string;

        // Only allow migration if the stored hash is a legacy bcrypt hash
        if (!stored.startsWith('$2')) {
            return NextResponse.json(
                { error: 'Your account has already been migrated. Please login normally.' },
                { status: 400 }
            );
        }

        // Re-hash with PBKDF2 (Edge-compatible)
        const newHash = await hashPassword(newPassword);

        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ password_hash: newHash })
            .eq('id', data.id);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true });

    } catch (e: any) {
        console.error('Migrate Password Error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// Node.js runtime needed to run bcryptjs for legacy hash verification
export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { username, currentPassword, newPassword } = body;

        if (!username || !currentPassword || !newPassword) {
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
            // Don't reveal if user exists or not
            return NextResponse.json({ error: 'Invalid username or password' }, { status: 400 });
        }

        const stored = data.password_hash as string;
        let isValid = false;

        if (stored.startsWith('pbkdf2:')) {
            // Already migrated — also allow re-migration via this page
            // Verify with PBKDF2 manually (duplicate logic here to keep nodejs isolation)
            return NextResponse.json(
                { error: 'Your password is already using the new format. Please login normally.' },
                { status: 400 }
            );
        } else if (stored.startsWith('$2')) {
            // Legacy bcrypt hash
            isValid = await bcrypt.compare(currentPassword, stored);
        } else {
            return NextResponse.json({ error: 'Unknown password format' }, { status: 400 });
        }

        if (!isValid) {
            return NextResponse.json({ error: 'Invalid username or password' }, { status: 400 });
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

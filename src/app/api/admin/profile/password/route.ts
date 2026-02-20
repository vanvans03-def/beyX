import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword, verifyPassword } from '@/lib/auth';


export async function POST(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
        }

        // Fetch current hash
        const { data, error } = await supabaseAdmin
            .from('users')
            .select('password_hash')
            .eq('id', userId)
            .single();

        if (error || !data) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Verify current password
        const isValid = await verifyPassword(currentPassword, data.password_hash);
        if (!isValid) {
            return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
        }

        // Hash new password with PBKDF2
        const newHash = await hashPassword(newPassword);

        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ password_hash: newHash })
            .eq('id', userId);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true });

    } catch (e: any) {
        console.error('Change Password Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

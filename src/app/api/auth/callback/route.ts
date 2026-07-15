import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createSession } from '@/lib/auth';
import { hashPassword } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const next = requestUrl.searchParams.get('next') || '/admin';

    // Get the base URL for redirection
    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (!baseUrl) {
        const forwardedHost = request.headers.get('x-forwarded-host');
        const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
        if (forwardedHost) {
            baseUrl = `${forwardedProto}://${forwardedHost}`;
        } else {
            baseUrl = requestUrl.origin;
        }
    }

    if (code) {
        try {
            const supabase = await createServerSideClient();
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;

            const user = data.user;
            if (!user || !user.email) {
                return NextResponse.redirect(new URL('/login?error=no_email', baseUrl));
            }

            const email = user.email.toLowerCase();
            const fullName = user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0];

            // 1. Query the users table for an existing user with this email
            const { data: dbUserResult, error: dbError } = await supabaseAdmin
                .from('users')
                .select('*')
                .eq('email', email)
                .maybeSingle();

            if (dbError) throw dbError;
            let dbUser = dbUserResult;

            // 2. If user with email doesn't exist, create a new one
            if (!dbUser) {
                // Generate a unique username
                const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
                let username = baseUsername;
                let isTaken = true;
                let attempts = 0;

                while (isTaken && attempts < 10) {
                    const checkUsername = attempts > 0 ? `${baseUsername}${attempts}` : baseUsername;
                    const { data: existing } = await supabaseAdmin
                        .from('users')
                        .select('id')
                        .ilike('username', checkUsername)
                        .maybeSingle();

                    if (!existing) {
                        username = checkUsername;
                        isTaken = false;
                    } else {
                        attempts++;
                    }
                }

                // If still taken, generate random suffix
                if (isTaken) {
                    username = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
                }

                // Clean shop name (only allow thai/eng, digits, - and _)
                let shopName = fullName.replace(/[^a-zA-Z0-9\u0E00-\u0E7F_-]/g, '').trim().slice(0, 30);
                if (!shopName) {
                    shopName = username;
                }

                // Generate random password hash
                const randomPassword = uuidv4();
                const passwordHash = await hashPassword(randomPassword);

                // Insert new user
                const { data: newUser, error: insertError } = await supabaseAdmin
                    .from('users')
                    .insert({
                        username,
                        password_hash: passwordHash,
                        email,
                        shop_name: shopName,
                        role: 'user',
                    })
                    .select()
                    .single();

                if (insertError) throw insertError;
                dbUser = newUser;
            }

            // 3. Create Session
            if (dbUser) {
                await createSession(dbUser.id, dbUser.username, dbUser.role);
            }

        } catch (err) {
            console.error('OAuth Callback Error:', err);
            return NextResponse.redirect(new URL('/login?error=oauth_failed', baseUrl));
        }
    }

    return NextResponse.redirect(new URL(next, baseUrl));
}

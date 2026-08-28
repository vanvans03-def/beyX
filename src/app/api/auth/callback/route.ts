import { randomUUID, timingSafeEqual } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/db/admin';
import { createSession, hashPassword } from '@/lib/auth';
import { createServerSideClient } from '@/utils/supabase/server';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
const OAUTH_STATE_COOKIE = 'beyx_oauth_state';

function configuredBaseUrl(request: Request): string {
    return process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

function googleCallbackUrl(request: Request): string {
    return new URL('/api/auth/callback', configuredBaseUrl(request)).toString();
}

function statesMatch(expected: string | undefined, received: string | null): boolean {
    if (!expected || !received || expected.length !== received.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export async function GET(request: Request) {
    if (process.env.AUTH_BACKEND !== 'local') return legacySupabaseCallback(request);

    const requestUrl = new URL(request.url);
    const redirectBase = configuredBaseUrl(request);
    const code = requestUrl.searchParams.get('code');
    const state = requestUrl.searchParams.get('state');
    const requestedNext = requestUrl.searchParams.get('next');
    const next = requestedNext?.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/admin';
    const cookieStore = await cookies();
    const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
    cookieStore.delete(OAUTH_STATE_COOKIE);

    if (!code || !statesMatch(expectedState, state)) {
        return NextResponse.redirect(new URL('/login?error=oauth_failed', redirectBase));
    }

    try {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        if (!clientId || !clientSecret) throw new Error('Google OAuth is not configured');
        const oauth = new OAuth2Client(clientId, clientSecret, googleCallbackUrl(request));
        const { tokens } = await oauth.getToken({ code, redirect_uri: googleCallbackUrl(request) });
        if (!tokens.id_token) throw new Error('Google did not return an ID token');
        const ticket = await oauth.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
        const profile = ticket.getPayload();
        if (!profile?.email || !profile.email_verified) {
            return NextResponse.redirect(new URL('/login?error=no_email', redirectBase));
        }

        const email = profile.email.toLowerCase();
        const fullName = profile.name || email.split('@')[0];
        const { data: existingUser, error: lookupError } = await adminDb.from('users').select('*').eq('email', email).maybeSingle();
        if (lookupError) throw lookupError;
        let user = existingUser;

        if (!user) {
            const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'user';
            let username = baseUsername;
            for (let attempt = 0; attempt < 10; attempt += 1) {
                const candidate = attempt ? `${baseUsername}${attempt}` : baseUsername;
                const { data } = await adminDb.from('users').select('id').ilike('username', candidate).maybeSingle();
                if (!data) { username = candidate; break; }
                username = `${baseUsername}_${randomUUID().slice(0, 8)}`;
            }

            const shopName = fullName.replace(/[^a-zA-Z0-9\u0E00-\u0E7F_-]/g, '').trim().slice(0, 30) || username;
            const { data: newUser, error: insertError } = await adminDb.from('users').insert({
                username,
                password_hash: await hashPassword(randomUUID()),
                email,
                shop_name: shopName,
                role: 'user',
            }).select().single();
            if (insertError) throw insertError;
            user = newUser;
        }

        await createSession(user.id, user.username, user.role);
        return NextResponse.redirect(new URL(next, redirectBase));
    } catch (error) {
        console.error('OAuth Callback Error:', error);
        return NextResponse.redirect(new URL('/login?error=oauth_failed', redirectBase));
    }
}

async function legacySupabaseCallback(request: Request) {
    const supabaseAdmin = adminDb;
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

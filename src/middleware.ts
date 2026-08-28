import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_AUDIENCE, SESSION_COOKIE_NAME, SESSION_ISSUER } from '@/lib/session-config';

//export const runtime = 'edge';

const SECRET = process.env.APP_SESSION_SECRET || process.env.SUPABASE_JWT_SECRET;

// Native Web Crypto JWT verification — no library, zero bundle cost
async function verifyJWT(token: string): Promise<Record<string, any> | null> {
    try {
        if (!SECRET || SECRET.length < 32) return null;
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const [header, payload, signature] = parts;

        const key = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(SECRET),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );

        const sigBytes = Uint8Array.from(
            atob(signature.replace(/-/g, '+').replace(/_/g, '/')),
            c => c.charCodeAt(0)
        );

        const valid = await crypto.subtle.verify(
            'HMAC',
            key,
            sigBytes,
            new TextEncoder().encode(`${header}.${payload}`)
        );
        if (!valid) return null;

        const decoded = JSON.parse(
            atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
        );

        // Check token expiry
        if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
        if (decoded.iss !== SESSION_ISSUER || decoded.aud !== SESSION_AUDIENCE) return null;
        if (!decoded.userId || !decoded.username || !['admin', 'user'].includes(decoded.role)) return null;

        return decoded;
    } catch {
        return null;
    }
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const isAdminRoute = pathname.startsWith('/admin');
    const isAdminApiRoute = pathname.startsWith('/api/admin') || pathname.startsWith('/api/generate-bracket');

    if (isAdminRoute || isAdminApiRoute) {
        const session = request.cookies.get(SESSION_COOKIE_NAME)?.value;

        if (!session) {
            if (isAdminApiRoute) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            return NextResponse.redirect(new URL('/login', request.url));
        }

        const payload = await verifyJWT(session);

        if (!payload) {
            if (isAdminApiRoute) {
                return NextResponse.json({ error: 'Invalid Token' }, { status: 401 });
            }
            const response = NextResponse.redirect(new URL('/login', request.url));
            response.cookies.delete(SESSION_COOKIE_NAME);
            return response;
        }

        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-user-id', payload.userId as string);
        requestHeaders.set('x-user-role', payload.role as string);
        requestHeaders.set('x-username', payload.username as string);

        return NextResponse.next({ request: { headers: requestHeaders } });
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*', '/api/admin/:path*', '/api/generate-bracket'],
};

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

//export const runtime = 'edge';

const SECRET = process.env.SUPABASE_JWT_SECRET || 'fallback-secret-key-change-me';

// Native Web Crypto JWT verification — no library, zero bundle cost
async function verifyJWT(token: string): Promise<Record<string, any> | null> {
    try {
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
        const session = request.cookies.get('session')?.value;

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
            response.cookies.delete('session');
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

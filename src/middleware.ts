import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export const runtime = 'edge';

const SECRET_KEY = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET || 'fallback-secret-key-change-me');
const ALG = 'HS256';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Identify Protected Routes
    const isAdminRoute = pathname.startsWith('/admin');
    const isAdminApiRoute = pathname.startsWith('/api/admin') || pathname.startsWith('/api/generate-bracket');

    if (isAdminRoute || isAdminApiRoute) {
        const session = request.cookies.get('session')?.value;

        // 2. Validate Session
        if (!session) {
            if (isAdminApiRoute) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            const loginUrl = new URL('/login', request.url);
            return NextResponse.redirect(loginUrl);
        }

        try {
            const { payload } = await jwtVerify(session, SECRET_KEY, {
                algorithms: [ALG],
            });

            // 3. Pass user info to backend via headers (optional but useful)
            const requestHeaders = new Headers(request.headers);
            requestHeaders.set('x-user-id', payload.userId as string);
            requestHeaders.set('x-user-role', payload.role as string);
            requestHeaders.set('x-username', payload.username as string);

            return NextResponse.next({
                request: {
                    headers: requestHeaders,
                },
            });

        } catch (error) {
            // Invalid Token
            if (isAdminApiRoute) {
                return NextResponse.json({ error: 'Invalid Token' }, { status: 401 });
            }
            const loginUrl = new URL('/login', request.url);
            // Clear invalid cookie
            const response = NextResponse.redirect(loginUrl);
            response.cookies.delete('session');
            return response;
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*', '/api/admin/:path*', '/api/generate-bracket'],
};

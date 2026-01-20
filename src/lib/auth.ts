import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

const SECRET_KEY = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET || 'fallback-secret-key-change-me');
const ALG = 'HS256';

export type SessionPayload = {
    userId: string;
    username: string;
    role: 'admin' | 'user';
    exp: number; // Expiry
}

export async function createSession(userId: string, username: string) {
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
    const token = await new SignJWT({ userId, username, role: 'user' })
        .setProtectedHeader({ alg: ALG })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(SECRET_KEY);

    // Set cookie
    (await cookies()).set('session', token, {
        expires,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    });
}

export async function getSession() {
    const session = (await cookies()).get('session')?.value;
    if (!session) return null;

    try {
        const { payload } = await jwtVerify(session, SECRET_KEY, {
            algorithms: [ALG],
        });
        return payload as SessionPayload;
    } catch (error) {
        return null;
    }
}

export async function clearSession() {
    (await cookies()).delete('session');
}

export function hashPassword(password: string) {
    return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
}

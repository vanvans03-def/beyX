import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
if (!SUPABASE_JWT_SECRET) {
    throw new Error('SUPABASE_JWT_SECRET is not defined in environment variables');
}
const SECRET_KEY = new TextEncoder().encode(SUPABASE_JWT_SECRET);
const ALG = 'HS256';

export type SessionPayload = {
    userId: string;
    username: string;
    role: 'admin' | 'user';
    exp: number; // Expiry
}

export async function createSession(userId: string, username: string, role: string = 'user') {
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
    const token = await new SignJWT({ userId, username, role })
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

// --- PBKDF2 helper functions for backward-compatibility fallback ---
const PBKDF2_ITERATIONS = 100000;
const HASH_LENGTH = 32;

async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );
    return crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        keyMaterial,
        HASH_LENGTH * 8
    );
}

function toHex(buf: ArrayBuffer): string {
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
    const buf = new ArrayBuffer(hex.length / 2);
    const arr = new Uint8Array(buf);
    for (let i = 0; i < hex.length; i += 2) {
        arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return arr;
}

// --- Password hashing using bcryptjs ---
export async function hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
    if (!password || !stored) return false;

    // Standard bcrypt format ($2a$, $2b$, $2y$, etc.)
    if (stored.startsWith('$2')) {
        try {
            return await bcrypt.compare(password, stored);
        } catch (e) {
            console.error('Bcrypt comparison error:', e);
            return false;
        }
    }

    // Fallback: PBKDF2 format (for any accounts hashed during interim)
    if (stored.startsWith('pbkdf2:')) {
        try {
            const parts = stored.split(':');
            if (parts.length !== 3) return false;
            const salt = fromHex(parts[1]);
            const expectedHash = parts[2];
            const derivedHash = toHex(await deriveKey(password, salt));
            if (derivedHash.length !== expectedHash.length) return false;
            let diff = 0;
            for (let i = 0; i < derivedHash.length; i++) {
                diff |= derivedHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
            }
            return diff === 0;
        } catch {
            return false;
        }
    }

    return false;
}


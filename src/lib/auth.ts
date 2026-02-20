import { SignJWT, jwtVerify } from 'jose';
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

// --- Web Crypto API password hashing (Edge Runtime compatible) ---
// Hash format: "pbkdf2:<hex-salt>:<hex-hash>"
const PBKDF2_ITERATIONS = 100000;
const HASH_LENGTH = 32; // bytes (256-bit)

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
        { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        keyMaterial,
        HASH_LENGTH * 8
    );
}

function toHex(buf: ArrayBuffer): string {
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
    const arr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return arr;
}

export async function hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await deriveKey(password, salt);
    return `pbkdf2:${toHex(salt.buffer)}:${toHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
    // Support PBKDF2 format
    if (stored.startsWith('pbkdf2:')) {
        const parts = stored.split(':');
        if (parts.length !== 3) return false;
        const salt = fromHex(parts[1]);
        const expectedHash = parts[2];
        const derivedHash = toHex(await deriveKey(password, salt));
        // Constant-time comparison
        if (derivedHash.length !== expectedHash.length) return false;
        let diff = 0;
        for (let i = 0; i < derivedHash.length; i++) {
            diff |= derivedHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
        }
        return diff === 0;
    }
    // Legacy bcrypt hashes — not supported in Edge Runtime
    // Users with bcrypt hashes must reset their password
    return false;
}


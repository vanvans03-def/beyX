import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
    redis: Redis | null;
};

function createRedisInstance(): Redis | null {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        return null;
    }

    try {
        const client = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            retryStrategy(times) {
                if (times > 3) {
                    console.warn('[Redis] Max reconnect attempts reached. Falling back to DB.');
                    return null; // Stop reconnecting
                }
                return Math.min(times * 100, 2000);
            },
        });

        client.on('error', (err) => {
            console.warn('[Redis Error]:', err.message);
        });

        return client;
    } catch (e: any) {
        console.warn('[Redis Setup Failed]:', e.message);
        return null;
    }
}

export const redis = globalForRedis.redis ?? createRedisInstance();

if (process.env.NODE_ENV !== 'production' && redis) {
    globalForRedis.redis = redis;
}

/**
 * Fetch cached data from Redis. Returns null on Cache Miss or Error.
 */
export async function getCachedData<T>(key: string): Promise<T | null> {
    if (!redis) return null;
    try {
        const cached = await redis.get(key);
        if (!cached) return null;
        return JSON.parse(cached) as T;
    } catch (error: any) {
        console.warn(`[Redis Get Error] key ${key}:`, error.message);
        return null;
    }
}

/**
 * Store data in Redis with optional TTL (default: 3600 seconds / 1 hour).
 */
export async function setCachedData(key: string, data: any, ttlSeconds: number = 3600): Promise<void> {
    if (!redis) return;
    try {
        const serialized = JSON.stringify(data);
        if (ttlSeconds > 0) {
            await redis.set(key, serialized, 'EX', ttlSeconds);
        } else {
            await redis.set(key, serialized);
        }
    } catch (error: any) {
        console.warn(`[Redis Set Error] key ${key}:`, error.message);
    }
}

/**
 * Invalidate one or more exact keys from Redis.
 */
export async function invalidateCacheKeys(...keys: string[]): Promise<void> {
    if (!redis || keys.length === 0) return;
    try {
        const validKeys = keys.filter(Boolean);
        if (validKeys.length > 0) {
            await redis.del(...validKeys);
        }
    } catch (error: any) {
        console.warn(`[Redis Del Error] keys ${keys.join(', ')}:`, error.message);
    }
}

/**
 * Invalidate all keys for a given tournament (matches & standings).
 */
export async function invalidateTournamentCache(tournamentId: string): Promise<void> {
    if (!tournamentId) return;
    await invalidateCacheKeys(
        `tournament:${tournamentId}:matches`,
        `tournament:${tournamentId}:standings`,
        `register:config:${tournamentId}`
    );
}

/**
 * Invalidate registration config cache for a specific tournament or all tournaments.
 */
export async function invalidateRegisterConfigCache(tournamentId?: string): Promise<void> {
    if (!redis) return;
    try {
        if (tournamentId) {
            await invalidateCacheKeys(`register:config:${tournamentId}`);
        } else {
            const keys = await redis.keys('register:config:*');
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        }
    } catch (error: any) {
        console.warn(`[Redis Invalidate Config Error]:`, error.message);
    }
}

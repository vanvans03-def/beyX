import 'server-only';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __beyxPostgresPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __beyxRealtimePostgresPool: Pool | undefined;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function createPool(connectionString = process.env.DATABASE_URL, max?: number): Pool {
  if (!connectionString) {
    throw new Error('DATA_BACKEND=postgres requires DATABASE_URL');
  }

  const urlSslMode = (() => {
    try { return new URL(connectionString).searchParams.get('sslmode')?.toLowerCase(); }
    catch { return undefined; }
  })();
  const sslMode = process.env.DATABASE_SSL?.toLowerCase() || urlSslMode || 'disable';
  return new Pool({
    connectionString,
    max: max ?? positiveInteger(process.env.DATABASE_POOL_MAX, 8),
    min: 0,
    idleTimeoutMillis: positiveInteger(process.env.DATABASE_IDLE_TIMEOUT_MS, 30_000),
    connectionTimeoutMillis: positiveInteger(process.env.DATABASE_CONNECT_TIMEOUT_MS, 15_000),
    statement_timeout: positiveInteger(process.env.DATABASE_STATEMENT_TIMEOUT_MS, 15_000),
    query_timeout: positiveInteger(process.env.DATABASE_QUERY_TIMEOUT_MS, 20_000),
    application_name: process.env.DATABASE_APPLICATION_NAME || 'beyx-nextjs',
    ssl: sslMode === 'disable' ? false : { rejectUnauthorized: sslMode !== 'no-verify' },
  });
}

/**
 * LISTEN requires a direct PostgreSQL connection (not a transaction pooler).
 * The pool contains at most one connection and is only used while SSE viewers
 * are connected.
 */
export function getRealtimePool(): Pool {
  if (!globalThis.__beyxRealtimePostgresPool) {
    globalThis.__beyxRealtimePostgresPool = createPool(
      process.env.REALTIME_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
      1,
    );
    globalThis.__beyxRealtimePostgresPool.on('error', (error) => {
      console.error('[postgres-realtime] idle client error', error);
    });
  }
  return globalThis.__beyxRealtimePostgresPool;
}

export function getPool(): Pool {
  if (!globalThis.__beyxPostgresPool) {
    globalThis.__beyxPostgresPool = createPool();
    globalThis.__beyxPostgresPool.on('error', (error) => {
      console.error('[postgres] idle client error', error);
    });
  }
  return globalThis.__beyxPostgresPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, [...values]);
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

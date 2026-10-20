import 'server-only';
import { getMutationPool } from '@/lib/db/pool';

type LockState = Map<string, Promise<void>>;

declare global {
  // eslint-disable-next-line no-var
  var __beyxTournamentMutationLocks: LockState | undefined;
}

const locks = globalThis.__beyxTournamentMutationLocks ?? new Map<string, Promise<void>>();
globalThis.__beyxTournamentMutationLocks = locks;

/** Serialize bracket mutations locally and across autoscaled PostgreSQL app instances. */
export async function withTournamentMutationLock<T>(
  tournamentId: string,
  work: () => Promise<T>,
): Promise<T> {
  const previous = locks.get(tournamentId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.catch(() => undefined).then(() => gate);
  locks.set(tournamentId, tail);

  await previous.catch(() => undefined);
  try {
    if (process.env.DATA_BACKEND !== 'postgres') return await work();
    const client = await getMutationPool().connect();
    let acquired = false;
    try {
      await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [tournamentId]);
      acquired = true;
      return await work();
    } finally {
      try {
        if (acquired) await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [tournamentId]);
        client.release();
      } catch (error) {
        client.release(true);
        throw error;
      }
    }
  } finally {
    release();
    if (locks.get(tournamentId) === tail) locks.delete(tournamentId);
  }
}

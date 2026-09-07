import 'server-only';

type LockState = Map<string, Promise<void>>;

declare global {
  // eslint-disable-next-line no-var
  var __beyxTournamentMutationLocks: LockState | undefined;
}

const locks = globalThis.__beyxTournamentMutationLocks ?? new Map<string, Promise<void>>();
globalThis.__beyxTournamentMutationLocks = locks;

/** Serialize bracket mutations for one tournament inside this app process. */
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
    return await work();
  } finally {
    release();
    if (locks.get(tournamentId) === tail) locks.delete(tournamentId);
  }
}

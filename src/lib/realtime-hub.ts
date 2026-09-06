import 'server-only';
import type { PoolClient } from 'pg';
import { getRealtimePool } from '@/lib/db/pool';
import { tournamentUpdateChannel } from '@/lib/realtime-server';

type Subscriber = (payload: string) => void;
type HubState = {
  client: PoolClient | null;
  connecting: Promise<void> | null;
  subscribers: Set<Subscriber>;
  retryTimer: ReturnType<typeof setTimeout> | null;
  releaseTimer: ReturnType<typeof setTimeout> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __beyxRealtimeHub: HubState | undefined;
}

const hub: HubState = globalThis.__beyxRealtimeHub || {
  client: null,
  connecting: null,
  subscribers: new Set(),
  retryTimer: null,
  releaseTimer: null,
};
globalThis.__beyxRealtimeHub = hub;

function scheduleRelease() {
  if (hub.releaseTimer || hub.subscribers.size) return;
  hub.releaseTimer = setTimeout(() => {
    hub.releaseTimer = null;
    void releaseListener();
  }, 10_000);
}

async function releaseListener() {
  if (hub.subscribers.size || !hub.client) return;
  const client = hub.client;
  hub.client = null;
  try {
    await client.query(`UNLISTEN ${tournamentUpdateChannel}`);
  } catch (error) {
    console.warn('[realtime] PostgreSQL UNLISTEN failed', error);
  } finally {
    client.removeAllListeners('notification');
    client.removeAllListeners('error');
    client.removeAllListeners('end');
    client.release();
  }
}

function scheduleReconnect() {
  if (hub.retryTimer || !hub.subscribers.size) return;
  hub.retryTimer = setTimeout(() => {
    hub.retryTimer = null;
    void ensureListener();
  }, 1_000);
}

async function ensureListener(): Promise<void> {
  if (hub.releaseTimer) {
    clearTimeout(hub.releaseTimer);
    hub.releaseTimer = null;
  }
  if (hub.client) return;
  if (hub.connecting) return hub.connecting;
  hub.connecting = (async () => {
    let client: PoolClient | null = null;
    try {
      client = await getRealtimePool().connect();
      client.on('notification', (message) => {
        if (!message.payload) return;
        for (const subscriber of hub.subscribers) subscriber(message.payload);
      });
      client.on('error', () => {
        if (hub.client === client) hub.client = null;
        scheduleReconnect();
      });
      client.on('end', () => {
        if (hub.client === client) hub.client = null;
        scheduleReconnect();
      });
      await client.query(`LISTEN ${tournamentUpdateChannel}`);
      hub.client = client;
      if (!hub.subscribers.size) scheduleRelease();
    } catch (error) {
      console.error('[realtime] PostgreSQL listener failed', error);
      if (client && hub.client !== client) client.release(true);
      scheduleReconnect();
    } finally {
      hub.connecting = null;
    }
  })();
  return hub.connecting;
}

export async function subscribeToTournamentUpdates(subscriber: Subscriber): Promise<() => void> {
  hub.subscribers.add(subscriber);
  await ensureListener();
  return () => {
    hub.subscribers.delete(subscriber);
    scheduleRelease();
  };
}

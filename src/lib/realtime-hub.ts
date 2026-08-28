import 'server-only';
import type { PoolClient } from 'pg';
import { getPool } from '@/lib/db/pool';
import { tournamentUpdateChannel } from '@/lib/realtime-server';

type Subscriber = (payload: string) => void;
type HubState = {
  client: PoolClient | null;
  connecting: Promise<void> | null;
  subscribers: Set<Subscriber>;
  retryTimer: ReturnType<typeof setTimeout> | null;
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
};
globalThis.__beyxRealtimeHub = hub;

function scheduleReconnect() {
  if (hub.retryTimer || !hub.subscribers.size) return;
  hub.retryTimer = setTimeout(() => {
    hub.retryTimer = null;
    void ensureListener();
  }, 1_000);
}

async function ensureListener(): Promise<void> {
  if (hub.client) return;
  if (hub.connecting) return hub.connecting;
  hub.connecting = (async () => {
    try {
      const client = await getPool().connect();
      client.on('notification', (message) => {
        if (!message.payload) return;
        for (const subscriber of hub.subscribers) subscriber(message.payload);
      });
      client.on('error', () => {
        hub.client = null;
        scheduleReconnect();
      });
      client.on('end', () => {
        hub.client = null;
        scheduleReconnect();
      });
      await client.query(`LISTEN ${tournamentUpdateChannel}`);
      hub.client = client;
    } catch (error) {
      console.error('[realtime] PostgreSQL listener failed', error);
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
  return () => hub.subscribers.delete(subscriber);
}

import { subscribeToTournamentUpdates } from '@/lib/realtime-hub';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (process.env.REALTIME_BACKEND !== 'postgres' && process.env.DATA_BACKEND !== 'postgres') {
    return new Response('PostgreSQL realtime is not enabled', { status: 409 });
  }

  const { id } = await context.params;
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let lifetime: ReturnType<typeof setTimeout> | null = null;
  let unsubscribe: (() => void) | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const close = async () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        if (lifetime) clearTimeout(lifetime);
        unsubscribe?.();
        unsubscribe = null;
        try { controller.close(); } catch { /* stream already closed */ }
      };

      request.signal.addEventListener('abort', () => { void close(); }, { once: true });
      if (request.signal.aborted) { await close(); return; }
      try {
        unsubscribe = await subscribeToTournamentUpdates((rawPayload) => {
          if (closed) return;
          try {
            const payload = JSON.parse(rawPayload);
            if (String(payload.tournamentId) !== id) return;
            controller.enqueue(encoder.encode(`event: tournament-update\ndata: ${JSON.stringify(payload)}\n\n`));
          } catch { /* ignore malformed payloads */ }
        });
        if (closed) { unsubscribe(); unsubscribe = null; return; }
        controller.enqueue(encoder.encode('event: ready\ndata: {}\n\n'));
        heartbeat = setInterval(() => {
          if (!closed) {
            try { controller.enqueue(encoder.encode(': heartbeat\n\n')); }
            catch { void close(); }
          }
        }, 20_000);
        // A proxy may retain an upstream request after its browser disconnects.
        // Bound that slot/resource lifetime. EventSource reconnects automatically;
        // the public UI reconciles the snapshot on each subsequent ready event.
        lifetime = setTimeout(() => { void close(); }, 5 * 60_000);
      } catch (error) {
        controller.error(error);
        await close();
      }
    },
    async cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      if (lifetime) clearTimeout(lifetime);
      unsubscribe?.();
      unsubscribe = null;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

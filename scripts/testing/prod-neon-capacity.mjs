import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';

const baseUrl = (process.env.TEST_BASE_URL || 'https://beyx-system.com').replace(/\/$/, '');
const session = process.env.TEST_SESSION_COOKIE;
const publicShop = process.env.TEST_PUBLIC_SHOP || 'admin';
const tournamentType = process.env.PERF_TOURNAMENT_TYPE || 'Standard';
const registrationMode = process.env.PERF_REGISTRATION_MODE || 'Standard';
const mainBeys = JSON.parse(process.env.PERF_MAIN_BEYS_JSON || '["DranSword","HellsScythe","WizardArrow"]');
const playerPrefix = process.env.PERF_PLAYER_PREFIX || 'CAPACITY_PLAYER_';
const reportPath = process.env.PERF_REPORT_PATH || 'performance-results/prod-neon-capacity.json';
if (!session) throw new Error('TEST_SESSION_COOKIE is required');

const cookie = `session=${session}`;
const report = { startedAt: new Date().toISOString(), target: baseUrl, results: {} };
// Bound TLS connection churn in a single Node load generator. There are still
// 300 concurrent viewer jobs, and deadlines include time queued by this agent.
// SSE deliberately uses a separate dispatcher so streams cannot starve reads.
const httpClient = process.env.PERF_FETCH_CONNECTIONS ? await import('undici') : undefined;
const httpDispatcher = httpClient
  ? new httpClient.Agent({ connections: Number(process.env.PERF_FETCH_CONNECTIONS) }) : undefined;
const httpFetch = httpClient?.fetch || fetch;
report.transport = { concurrentViewerJobs: 300, httpConnections: Number(process.env.PERF_FETCH_CONNECTIONS) || 'default' };
let tournamentId = '';
let realtimeClients = [];
let adminPolling = true;

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] || 0;
}

async function request(path, options = {}) {
  const started = performance.now();
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`${options.method || 'GET'} ${path}: deadline exceeded`));
    }, options.timeoutMs || 20_000);
  });
  try {
    return await Promise.race([deadline, (async () => {
      const response = await httpFetch(`${baseUrl}${path}`, {
        ...options,
        ...(httpDispatcher ? { dispatcher: httpDispatcher } : {}),
        headers: { ...(options.headers || {}) },
        signal: controller.signal,
      });
      const text = await response.text();
      let body;
      try { body = JSON.parse(text); } catch { body = text; }
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${path}: ${response.status} ${text.slice(0, 300)}`);
      return { body, ms: performance.now() - started, status: response.status };
    })()]);
  } finally {
    clearTimeout(timer);
  }
}

async function mapConcurrent(items, concurrency, worker) {
  let cursor = 0;
  const results = new Array(items.length);
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try { results[index] = { ok: true, value: await worker(items[index], index) }; }
      catch (error) { results[index] = { ok: false, error: error.message }; }
    }
  }));
  return results;
}

function summarize(results) {
  const good = results.filter(x => x.ok);
  const timings = good.map(x => x.value.ms).filter(Number.isFinite);
  return {
    total: results.length,
    passed: good.length,
    failed: results.length - good.length,
    p95Ms: Number(percentile(timings, 0.95).toFixed(1)),
    maxMs: Number(Math.max(0, ...timings).toFixed(1)),
    errors: [...new Set(results.filter(x => !x.ok).map(x => x.error))].slice(0, 5),
  };
}

async function connectRealtime(index) {
  const controller = new AbortController();
  const started = performance.now();
  async function openStream() {
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`${baseUrl}/api/realtime/tournaments/${tournamentId}`, {
        headers: { accept: 'text/event-stream', 'x-capacity-client': String(index) }, signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(`SSE ${response.status}`);
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let buffer = '';
      while (!buffer.includes('event: ready')) {
        const { value, done } = await reader.read();
        if (done) throw new Error('SSE closed before ready');
        buffer += decoder.decode(value, { stream: true });
      }
      return { reader, decoder, buffer };
    } finally { clearTimeout(timeout); }
  }
  let stream = await openStream();
  const client = { controller, ms: performance.now() - started, events: 0,
    disconnects: 0, reconnects: 0, reconciliations: 0, disconnectReasons: [], winners: new Map() };
  client.pump = (async () => {
    while (!controller.signal.aborted && adminPolling) {
      try {
        while (true) {
          const { value, done } = await stream.reader.read();
          if (done) throw new Error('SSE closed before tournament completion');
          stream.buffer += stream.decoder.decode(value, { stream: true });
          let boundary;
          while ((boundary = stream.buffer.indexOf('\n\n')) >= 0) {
            const frame = stream.buffer.slice(0, boundary); stream.buffer = stream.buffer.slice(boundary + 2);
            const data = frame.split('\n').find(line => line.startsWith('data: '));
            if (frame.includes('event: tournament-update') && data) {
              const update = JSON.parse(data.slice(6));
              if (update.event === 'match-update' && update.matches?.length) {
                client.events++;
                for (const match of update.matches) client.winners.set(String(match.id), match.winner_id);
              }
            }
          }
        }
      } catch (error) {
        if (controller.signal.aborted || !adminPolling) break;
        client.disconnects++;
        client.disconnectReasons.push(error.message);
        await stream.reader.cancel().catch(() => {});
        let recovered = false;
        // Match native EventSource behavior, and the UI's ready-event reconciliation.
        // Keep transient disconnects visible; unrecovered streams still fail the gate.
        for (let attempt = 0; attempt < 3 && adminPolling && !controller.signal.aborted; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          try {
            stream = await openStream();
            const snapshot = await request(`/api/public/tournaments/${tournamentId}/matches`);
            for (const match of snapshot.body.matches || []) client.winners.set(String(match.id), match.winner_id);
            client.reconnects++; client.reconciliations++; recovered = true; break;
          } catch (retryError) { client.disconnectReasons.push(retryError.message); }
        }
        if (!recovered && adminPolling) { client.error = 'SSE reconnect/reconciliation failed'; break; }
      }
    }
  })();
  return client;
}

async function adminPoller() {
  let requests = 0;
  let errors = 0;
  while (adminPolling) {
    try {
      await request(`/api/admin/matches?tournamentId=${tournamentId}`, { headers: { cookie } });
      requests++;
    } catch { errors++; }
    await new Promise(resolve => setTimeout(resolve, 700));
  }
  return { requests, errors };
}

async function cleanup() {
  adminPolling = false;
  for (const client of realtimeClients) client.controller.abort();
  await Promise.allSettled(realtimeClients.map(client => client.pump));
  if (!tournamentId) return;
  try {
    await request('/api/admin/tournaments/reset', {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ tournamentId }), timeoutMs: 60_000,
    });
  } catch {}
  try {
    await request(`/api/admin/tournaments?id=${encodeURIComponent(tournamentId)}`, {
      method: 'DELETE', headers: { cookie },
    });
  } catch (error) { report.cleanupError = error.message; }
}

try {
  const created = await request('/api/admin/tournaments', {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      name: `CODEX_NEON_CAPACITY_${Date.now()}`,
      type: tournamentType, provider: 'INTERNAL', bracket_type: 'DOUBLE', ban_list: [],
    }),
  });
  tournamentId = created.body.data.id;
  report.tournamentId = tournamentId;
  console.log(`Fixture created: ${tournamentId}`);

  const pageResults = await mapConcurrent(Array.from({ length: 100 }), 100, async () => {
    const page = await request(`/register/${tournamentId}`);
    const config = await request(`/api/register/config?tournamentId=${tournamentId}`);
    return { ms: page.ms + config.ms };
  });
  report.results.registrationPage100 = summarize(pageResults);
  console.log('Registration page x100:', report.results.registrationPage100);

  const registrations = await mapConcurrent(Array.from({ length: 300 }), 25, async (_, index) => {
    return request('/api/register', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        deviceUUID: `codex-neon-${Date.now()}-${index}`,
        playerName: `${playerPrefix}${String(index + 1).padStart(3, '0')}`,
        mode: registrationMode, mainBeys,
        totalPoints: 0, tournamentId,
      }),
    });
  });
  report.results.registrationWrites300At25 = summarize(registrations);
  console.log('Registration writes 300 @25:', report.results.registrationWrites300At25);
  if (report.results.registrationWrites300At25.failed) throw new Error('Registration write failures');

  const generated = await request('/api/generate-bracket', {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ tournamentId, roomName: 'Capacity test', players: [], type: 'double elimination', shuffle: false, arenaCount: 10 }),
    timeoutMs: 60_000,
  });
  if (!generated.body.success) throw new Error(`Bracket generation failed: ${JSON.stringify(generated.body)}`);

  if (process.env.TEST_SKIP_PLAYWRIGHT === '1') {
    report.results.playwright = { skipped: true, exitCode: 0 };
  } else {
    const playwright = spawnSync(process.execPath, [
      './node_modules/@playwright/test/cli.js', 'test',
    ], {
      cwd: process.cwd(), stdio: 'inherit',
      env: {
        ...process.env, TEST_BASE_URL: baseUrl, TEST_SESSION_COOKIE: session,
        TEST_ORGANIZER_TOURNAMENT_ID: tournamentId,
        TEST_TOURNAMENT_NMM_ID: tournamentId, TEST_TOURNAMENT_U10_ID: tournamentId,
        TEST_TOURNAMENT_U10CUSTOM_ID: tournamentId,
        TEST_BUCKET_PATH: `/${encodeURIComponent(publicShop)}/${tournamentId}`,
        TEST_BUCKET_TOURNAMENT_ID: tournamentId,
      },
    });
    report.results.playwright = { exitCode: playwright.status ?? 1 };
  }

  const publicLoads = await mapConcurrent(Array.from({ length: 300 }), 300, async () => {
    const page = await request(`/${encodeURIComponent(publicShop)}/${tournamentId}`);
    const matches = await request(`/api/public/tournaments/${tournamentId}/matches`);
    const standings = await request(`/api/public/tournaments/${tournamentId}/standings`);
    const unknown = JSON.stringify(matches.body).includes('Unknown Player');
    if (unknown) throw new Error('Unknown Player found');
    return { ms: page.ms + matches.ms + standings.ms };
  });
  report.results.publicBracketLoads300 = summarize(publicLoads);
  console.log('Public bracket x300:', report.results.publicBracketLoads300);

  const sseResults = await mapConcurrent(Array.from({ length: 300 }), 300, async (_, index) => {
    const client = await connectRealtime(index);
    realtimeClients.push(client);
    return { ms: client.ms };
  });
  report.results.realtime300 = summarize(sseResults);
  console.log('Realtime x300:', report.results.realtime300);

  const pollers = Array.from({ length: 10 }, () => adminPoller());
  let completed = 0;
  let lastPlayedMatch;
  let rounds = 0;
  const started = performance.now();
  while (rounds++ < 1500) {
    const state = await request(`/api/admin/matches?tournamentId=${tournamentId}`, { headers: { cookie } });
    const matches = state.body.matches || [];
    const open = matches.filter(match =>
      String(match.state).toUpperCase() === 'OPEN' && match.player1_id && match.player2_id,
    ).slice(0, 10);
    if (!open.length) {
      const unfinished = matches.filter(match => !['COMPLETE'].includes(String(match.state).toUpperCase()));
      if (!unfinished.length || unfinished.every(match => match.scores_csv?.includes('BYE') || match.scores_csv?.includes('Cancelled'))) break;
      await new Promise(resolve => setTimeout(resolve, 100));
      continue;
    }
    const updates = await Promise.allSettled(open.map(match => request('/api/admin/matches', {
      method: 'PUT', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ tournamentId, matchId: match.id, scoresCsv: '2-0', winnerId: match.player1_id }),
      timeoutMs: 30_000,
    })));
    const failed = updates.filter(result => result.status === 'rejected');
    if (failed.length) throw new Error(`Match update failures: ${failed[0].reason}`);
    lastPlayedMatch = { id: String(open.at(-1).id), winner: open.at(-1).player1_id };
    completed += open.length;
  }
  adminPolling = false;
  report.results.adminPollers10 = (await Promise.all(pollers)).reduce((sum, item) => ({
    requests: sum.requests + item.requests, errors: sum.errors + item.errors,
  }), { requests: 0, errors: 0 });
  report.results.doubleElimination = {
    matchUpdates: completed, iterations: rounds,
    durationMs: Number((performance.now() - started).toFixed(1)),
  };

  const deliveryDeadline = performance.now() + 10_000;
  while (realtimeClients.some(client => client.events === 0 || (lastPlayedMatch && client.winners.get(lastPlayedMatch.id) !== lastPlayedMatch.winner)) && performance.now() < deliveryDeadline) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const finalMatches = await request(`/api/public/tournaments/${tournamentId}/matches`);
  const finalJson = JSON.stringify(finalMatches.body);
  const matches = finalMatches.body.matches || [];
  report.results.finalIntegrity = {
    totalMatches: matches.length,
    complete: matches.filter(match => String(match.state).toUpperCase() === 'COMPLETE').length,
    unknownPlayers: (finalJson.match(/Unknown Player/g) || []).length,
    realtimeClientsWithUpdates: realtimeClients.filter(client => client.events > 0).length,
    realtimeClientsCaughtUp: realtimeClients.filter(client => lastPlayedMatch && client.winners.get(lastPlayedMatch.id) === lastPlayedMatch.winner).length,
    transientDisconnects: realtimeClients.reduce((sum, client) => sum + client.disconnects, 0),
    reconnects: realtimeClients.reduce((sum, client) => sum + client.reconnects, 0),
    reconciliations: realtimeClients.reduce((sum, client) => sum + client.reconciliations, 0),
    disconnectReasons: [...new Set(realtimeClients.flatMap(client => client.disconnectReasons))].slice(0, 5),
    realtimeErrors: realtimeClients.filter(client => client.error).length,
  };
  report.passed = report.results.playwright.exitCode === 0
    && Object.values(report.results).every(value => value?.failed === undefined || value.failed === 0)
    && report.results.adminPollers10.errors === 0
    && report.results.finalIntegrity.complete === report.results.finalIntegrity.totalMatches
    && report.results.finalIntegrity.unknownPlayers === 0
    && report.results.finalIntegrity.realtimeClientsWithUpdates === 300
    && report.results.finalIntegrity.realtimeClientsCaughtUp === 300
    && report.results.finalIntegrity.realtimeErrors === 0;
} catch (error) {
  report.passed = false;
  report.error = error.stack || error.message;
  console.error(error);
} finally {
  await cleanup();
  report.finishedAt = new Date().toISOString();
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report: ${reportPath}`);
  if (httpDispatcher) await httpDispatcher.close();
}

if (!report.passed) process.exitCode = 1;

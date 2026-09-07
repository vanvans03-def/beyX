import { performance } from 'node:perf_hooks';

const baseUrl = (process.env.TEST_BASE_URL || 'https://beyx-system.com').replace(/\/$/, '');
const registrationId = process.env.TEST_REGISTRATION_TOURNAMENT_ID;
const publicPath = process.env.TEST_PUBLIC_TOURNAMENT_PATH;
const publicTournamentId = process.env.TEST_PUBLIC_TOURNAMENT_ID;

if (!registrationId || !publicPath || !publicTournamentId) {
  throw new Error('TEST_REGISTRATION_TOURNAMENT_ID, TEST_PUBLIC_TOURNAMENT_PATH and TEST_PUBLIC_TOURNAMENT_ID are required');
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] || 0;
}

async function timedFetch(path, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, { signal: controller.signal });
    await response.arrayBuffer();
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return performance.now() - started;
  } finally {
    clearTimeout(timer);
  }
}

async function burst(total, worker) {
  const results = await Promise.allSettled(Array.from({ length: total }, (_, index) => worker(index)));
  const timings = results.filter(result => result.status === 'fulfilled').map(result => result.value);
  return {
    total,
    passed: timings.length,
    failed: total - timings.length,
    p95Ms: Number(percentile(timings, 0.95).toFixed(1)),
    maxMs: Number(Math.max(0, ...timings).toFixed(1)),
    errors: [...new Set(results.filter(result => result.status === 'rejected').map(result => result.reason?.message))].slice(0, 5),
  };
}

await timedFetch(`/register/${encodeURIComponent(registrationId)}`);
await timedFetch(`/api/register/config?tournamentId=${encodeURIComponent(registrationId)}`);
const registration = await burst(100, async () => {
  const [page, config] = await Promise.all([
    timedFetch(`/register/${encodeURIComponent(registrationId)}`),
    timedFetch(`/api/register/config?tournamentId=${encodeURIComponent(registrationId)}`),
  ]);
  return Math.max(page, config);
});

await timedFetch(publicPath);
await timedFetch(`/api/public/tournaments/${publicTournamentId}/matches`);
await timedFetch(`/api/public/tournaments/${publicTournamentId}/standings`);
const spectators = await burst(300, async () => {
  const timings = await Promise.all([
    timedFetch(publicPath),
    timedFetch(`/api/public/tournaments/${publicTournamentId}/matches`),
    timedFetch(`/api/public/tournaments/${publicTournamentId}/standings`),
  ]);
  return Math.max(...timings);
});

console.log(JSON.stringify({ registration, spectators }, null, 2));
if (registration.failed || spectators.failed) process.exitCode = 1;

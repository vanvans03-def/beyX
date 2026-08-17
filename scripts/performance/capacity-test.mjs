import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const baseUrl = (process.env.TEST_BASE_URL || "http://127.0.0.1:3333").replace(/\/$/, "");
const levels = (process.env.PERF_LEVELS || "1,5,10,25,50,100")
  .split(",").map(Number).filter((value) => Number.isFinite(value) && value > 0);
const stageSeconds = Number(process.env.PERF_STAGE_SECONDS || 15);
const p95Limit = Number(process.env.PERF_P95_MS || 2000);
const errorRateLimit = Number(process.env.PERF_ERROR_RATE || 0.01);
const requestTimeout = Number(process.env.PERF_REQUEST_TIMEOUT_MS || 10000);
const reportPath = process.env.PERF_REPORT_PATH || "performance-results/http-capacity.json";
const selected = new Set((process.env.PERF_SCENARIOS || "").split(",").filter(Boolean));
const cookie = process.env.TEST_SESSION_COOKIE ? `session=${process.env.TEST_SESSION_COOKIE}` : "";

const definitions = {
  organizer: {
    required: ["TEST_ORGANIZER_TOURNAMENT_ID", "TEST_SESSION_COOKIE"],
    thinkMs: 1000,
    requests: () => {
      const id = process.env.TEST_ORGANIZER_TOURNAMENT_ID;
      return [
        [`/api/admin/registrations?tournamentId=${id}`, { headers: { cookie } }],
        [`/api/admin/tournaments?id=${id}`, { headers: { cookie } }],
        [`/api/admin/matches?tournamentId=${id}`, { headers: { cookie } }],
      ];
    },
  },
  bucket: {
    required: ["TEST_BUCKET_PATH", "TEST_BUCKET_TOURNAMENT_ID"],
    thinkMs: 1200,
    requests: () => {
      const id = process.env.TEST_BUCKET_TOURNAMENT_ID;
      return [
        [process.env.TEST_BUCKET_PATH],
        [`/api/public/tournaments/${id}/matches`],
        [`/api/public/tournaments/${id}/standings`],
      ];
    },
  },
  registration_nmm: registrationDefinition("TEST_TOURNAMENT_NMM_ID"),
  registration_u10: registrationDefinition("TEST_TOURNAMENT_U10_ID"),
  registration_u10custom: registrationDefinition("TEST_TOURNAMENT_U10CUSTOM_ID"),
  scoreboard: {
    required: [],
    thinkMs: 1500,
    requests: () => [["/score-board"]],
  },
};

function registrationDefinition(envName) {
  return {
    required: [envName],
    thinkMs: 1200,
    requests: () => {
      const id = process.env[envName];
      return [
        [`/register/${id}`],
        [`/api/register/config?tournamentId=${id}`],
        [`/api/register?tournamentId=${id}&listPlayers=1`],
      ];
    },
  };
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

async function measuredFetch(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeout);
  const started = performance.now();
  try {
    const response = await fetch(path.startsWith("http") ? path : `${baseUrl}${path}`, {
      ...options,
      redirect: "manual",
      signal: controller.signal,
    });
    await response.arrayBuffer();
    return {
      duration: performance.now() - started,
      ok: response.status >= 200 && response.status < 400,
      status: response.status,
    };
  } catch (error) {
    return { duration: performance.now() - started, ok: false, status: 0, error: error.message };
  } finally {
    clearTimeout(timer);
  }
}

async function runStage(name, definition, users) {
  const endAt = performance.now() + stageSeconds * 1000;
  const samples = [];
  await Promise.all(Array.from({ length: users }, async () => {
    while (performance.now() < endAt) {
      for (const [path, options] of definition.requests()) {
        if (performance.now() >= endAt) break;
        samples.push(await measuredFetch(path, options));
      }
      await new Promise((resolve) => setTimeout(resolve, definition.thinkMs));
    }
  }));

  const durations = samples.map((sample) => sample.duration);
  const errors = samples.filter((sample) => !sample.ok);
  const result = {
    scenario: name,
    concurrentUsers: users,
    requests: samples.length,
    requestsPerSecond: Number((samples.length / stageSeconds).toFixed(2)),
    averageMs: Number((durations.reduce((sum, value) => sum + value, 0) / Math.max(1, durations.length)).toFixed(1)),
    p95Ms: Number(percentile(durations, 0.95).toFixed(1)),
    p99Ms: Number(percentile(durations, 0.99).toFixed(1)),
    errorRate: Number((errors.length / Math.max(1, samples.length)).toFixed(4)),
    statuses: Object.fromEntries(Object.entries(
      samples.reduce((acc, sample) => {
        acc[sample.status] = (acc[sample.status] || 0) + 1;
        return acc;
      }, {}),
    )),
  };
  result.passed = result.p95Ms <= p95Limit && result.errorRate <= errorRateLimit;
  return result;
}

const results = [];
for (const [name, definition] of Object.entries(definitions)) {
  if (selected.size && !selected.has(name)) continue;
  const missing = definition.required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.log(`SKIP ${name}: missing ${missing.join(", ")}`);
    continue;
  }
  for (const users of levels) {
    const result = await runStage(name, definition, users);
    results.push(result);
    console.log(
      `${result.passed ? "PASS" : "FAIL"} ${name} users=${users} p95=${result.p95Ms}ms errors=${(result.errorRate * 100).toFixed(2)}% rps=${result.requestsPerSecond}`,
    );
    if (!result.passed) break;
  }
}

const capacities = Object.fromEntries(
  Object.keys(definitions).map((name) => {
    const stages = results.filter((result) => result.scenario === name);
    const lastPass = stages.filter((result) => result.passed).at(-1);
    return [name, {
      measuredConcurrentUsers: lastPass?.concurrentUsers ?? 0,
      bounded: Boolean(stages.at(-1) && !stages.at(-1).passed),
      note: stages.length ? undefined : "not configured",
    }];
  }),
);
const report = {
  generatedAt: new Date().toISOString(),
  target: baseUrl,
  thresholds: { p95Ms: p95Limit, errorRate: errorRateLimit },
  stageSeconds,
  capacities,
  stages: results,
};
await mkdir("performance-results", { recursive: true });
await writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(`Report: ${reportPath}`);
if (results.some((result) => !result.passed)) process.exitCode = 1;

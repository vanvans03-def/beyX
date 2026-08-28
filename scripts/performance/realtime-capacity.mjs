import { mkdir, writeFile } from "node:fs/promises";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const baseUrl = (process.env.TEST_BASE_URL || "http://127.0.0.1:3333").replace(/\/$/, "");

const tournamentId = process.env.TEST_BUCKET_TOURNAMENT_ID || process.env.TEST_ORGANIZER_TOURNAMENT_ID;
if (!tournamentId) throw new Error("Set TEST_BUCKET_TOURNAMENT_ID or TEST_ORGANIZER_TOURNAMENT_ID");

const levels = (process.env.REALTIME_LEVELS || "1,5,10,25,50,100,200")
  .split(",").map(Number).filter((value) => value > 0);
const subscribeTimeoutMs = Number(process.env.REALTIME_SUBSCRIBE_TIMEOUT_MS || 10000);
const holdSeconds = Number(process.env.REALTIME_HOLD_SECONDS || 10);
const results = [];

async function connectOne(index) {
  const controller = new AbortController();
  const started = performance.now();
  const timeout = setTimeout(() => controller.abort(), subscribeTimeoutMs);
  try {
    const response = await fetch(`${baseUrl}/api/realtime/tournaments/${encodeURIComponent(tournamentId)}`, {
      signal: controller.signal,
      headers: { accept: "text/event-stream", "x-capacity-client": String(index) },
    });
    if (!response.ok || !response.body) return { controller, ok: false, status: String(response.status), connectMs: performance.now() - started };
    const reader = response.body.getReader();
    let buffer = "";
    while (!buffer.includes("event: ready")) {
      const { value, done } = await reader.read();
      if (done) throw new Error("stream closed before ready");
      buffer += new TextDecoder().decode(value);
    }
    clearTimeout(timeout);
    return { controller, reader, ok: true, status: "SUBSCRIBED", connectMs: performance.now() - started };
  } catch (error) {
    clearTimeout(timeout);
    return { controller, ok: false, status: error.name === "AbortError" ? "TIMEOUT" : "ERROR", connectMs: performance.now() - started };
  }
}

for (const users of levels) {
  const connections = await Promise.all(Array.from({ length: users }, (_, index) => connectOne(index)));
  const successful = connections.filter((connection) => connection.ok);
  const connectTimes = successful.map((connection) => connection.connectMs).sort((a, b) => a - b);
  const p95 = connectTimes[Math.max(0, Math.ceil(connectTimes.length * 0.95) - 1)] || 0;
  const result = {
    concurrentUsers: users,
    connected: successful.length,
    successRate: Number((successful.length / users).toFixed(4)),
    p95ConnectMs: Number(p95.toFixed(1)),
    passed: successful.length / users >= 0.99 && p95 <= subscribeTimeoutMs,
  };
  results.push(result);
  console.log(`${result.passed ? "PASS" : "FAIL"} realtime users=${users} connected=${successful.length} p95=${result.p95ConnectMs}ms`);
  await new Promise((resolve) => setTimeout(resolve, holdSeconds * 1000));
  await Promise.all(connections.map(async ({ controller, reader }) => {
    controller.abort();
    await reader?.cancel().catch(() => {});
  }));
  if (!result.passed) break;
}

await mkdir("performance-results", { recursive: true });
await writeFile("performance-results/realtime-capacity.json", JSON.stringify({
  generatedAt: new Date().toISOString(),
  tournamentId,
  results,
}, null, 2));
console.log("Report: performance-results/realtime-capacity.json");
if (results.some((result) => !result.passed)) process.exitCode = 1;

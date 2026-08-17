import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL and publishable/anon key");

const tournamentId = process.env.TEST_BUCKET_TOURNAMENT_ID || process.env.TEST_ORGANIZER_TOURNAMENT_ID;
if (!tournamentId) throw new Error("Set TEST_BUCKET_TOURNAMENT_ID or TEST_ORGANIZER_TOURNAMENT_ID");

const levels = (process.env.REALTIME_LEVELS || "1,5,10,25,50,100,200")
  .split(",").map(Number).filter((value) => value > 0);
const subscribeTimeoutMs = Number(process.env.REALTIME_SUBSCRIBE_TIMEOUT_MS || 10000);
const holdSeconds = Number(process.env.REALTIME_HOLD_SECONDS || 10);
const results = [];

async function connectOne(index) {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 2 } },
  });
  const channel = client
    .channel(`capacity-${Date.now()}-${index}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "internal_matches",
      filter: `tournament_id=eq.${tournamentId}`,
    }, () => {});

  const started = performance.now();
  const outcome = await new Promise((resolve) => {
    const timeout = setTimeout(() => resolve({ ok: false, status: "TIMEOUT" }), subscribeTimeoutMs);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timeout);
        resolve({ ok: true, status });
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        clearTimeout(timeout);
        resolve({ ok: false, status });
      }
    });
  });
  return { client, channel, connectMs: performance.now() - started, ...outcome };
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
  await Promise.all(connections.map(async ({ client, channel }) => {
    await client.removeChannel(channel);
    await client.realtime.disconnect();
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

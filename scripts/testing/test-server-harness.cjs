/**
 * Dedicated Test Server Harness for BeyX Functional / E2E Tests
 * 
 * Strict Teardown & Lifecycle Guarantees:
 * 1. Preflight Port Check: Fails immediately if port 3333 is already occupied.
 * 2. Spawns Next.js dev server on port 3333 via Node binary (shell: false) with tracked PID.
 * 3. Polls /api/health until server is ready (exponential backoff).
 * 4. Spawns Playwright test runner via Node binary (shell: false) with TEST_BASE_URL.
 * 5. Async Controlled Process-Tree Termination:
 *    - Explicitly tree-kills spawned server processes (taskkill /T /F on Win32, SIGKILL on Unix).
 *    - Waits for server process to emit exit/close event.
 *    - Verifies that port 3333 is confirmed closed via TCP probe.
 *    - If process or port fails to release within timeout, returns non-zero exit code.
 * 6. Async SIGINT/SIGTERM handlers performing full cleanup and verification before exit.
 * 7. Forwards exact Playwright exit code without suppressing test failures.
 */

const { spawn, execFileSync } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');

const PORT = parseInt(process.env.TEST_PORT || '3333', 10);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const HEALTH_URL = `${BASE_URL}/api/health`;
const ROOT_DIR = path.resolve(__dirname, '..', '..');

function checkHealth(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function checkPortReleased(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(500);
    socket.on('connect', () => {
      socket.destroy();
      resolve(false); // Port is still active
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(true); // Timed out, likely free
    });
    socket.on('error', () => {
      resolve(true); // Connection refused, port is free
    });
    socket.connect(port, host);
  });
}

async function waitForServer(url, timeoutMs = 60000) {
  const startTime = Date.now();
  let delay = 100;
  while (Date.now() - startTime < timeoutMs) {
    const isHealthy = await checkHealth(url);
    if (isHealthy) return true;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 1000);
  }
  return false;
}

async function waitForPortRelease(port, timeoutMs = 10000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const released = await checkPortReleased(port);
    if (released) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

let activeServerProc = null;
let isCleaningUp = false;

async function cleanupServer(serverProc, timeoutMs = 10000) {
  if (isCleaningUp) return true;
  isCleaningUp = true;

  if (!serverProc || !serverProc.pid) {
    return true;
  }

  const pid = serverProc.pid;
  console.log(`[HARNESS] Performing controlled process-tree termination on Next.js test server (PID ${pid})...`);

  let processClosed = false;
  const exitPromise = new Promise((resolve) => {
    if (serverProc.exitCode !== null || serverProc.killed) {
      processClosed = true;
      return resolve(true);
    }
    serverProc.once('exit', () => { processClosed = true; resolve(true); });
    serverProc.once('close', () => { processClosed = true; resolve(true); });
  });

  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'pipe' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch (err) {
    const output = (err.stderr ? err.stderr.toString() : err.message || '');
    // Ignore error if process already terminated
    if (!/not found|no process/i.test(output)) {
      console.error(`[HARNESS] Taskkill error on PID ${pid}: ${output.trim()}`);
    }
  }

  const closed = await Promise.race([
    exitPromise,
    new Promise((r) => setTimeout(() => r(false), timeoutMs))
  ]);

  if (!closed) {
    console.error(`[HARNESS] FATAL ERROR: Server process PID ${pid} did not emit close/exit within ${timeoutMs}ms.`);
    return false;
  }

  const portReleased = await waitForPortRelease(PORT, 10000);
  if (!portReleased) {
    console.error(`[HARNESS] FATAL ERROR: Port ${PORT} remained active after process termination.`);
    return false;
  }

  console.log(`[HARNESS] Verified: Child process tree (PID ${pid}) terminated and port ${PORT} released.`);
  activeServerProc = null;
  return true;
}

// Signal handlers
process.on('SIGINT', async () => {
  console.log('\n[HARNESS] Received SIGINT. Running clean teardown...');
  const ok = await cleanupServer(activeServerProc);
  process.exit(ok ? 130 : 1);
});

process.on('SIGTERM', async () => {
  console.log('\n[HARNESS] Received SIGTERM. Running clean teardown...');
  const ok = await cleanupServer(activeServerProc);
  process.exit(ok ? 143 : 1);
});

async function run() {
  // 1. Preflight Port Check
  const isPortAvailable = await checkPortReleased(PORT);
  if (!isPortAvailable) {
    console.error(`[HARNESS] PREFLIGHT ERROR: Port ${PORT} is already in use.`);
    console.error(`[HARNESS] Refusing to run tests against an unowned/pre-existing server.`);
    process.exit(1);
  }

  console.log(`[HARNESS] Preflight passed: Port ${PORT} is free.`);
  console.log(`[HARNESS] Starting Next.js test server on port ${PORT}...`);

  const nextBin = path.join(ROOT_DIR, 'node_modules', 'next', 'dist', 'bin', 'next');

  activeServerProc = spawn(
    process.execPath,
    [nextBin, 'dev', '-p', String(PORT)],
    {
      cwd: ROOT_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
      shell: false,
      env: { ...process.env, PORT: String(PORT) },
    }
  );

  activeServerProc.stdout.on('data', (data) => {
    const msg = data.toString();
    if (process.env.DEBUG) process.stdout.write(`[SERVER stdout] ${msg}`);
  });

  activeServerProc.stderr.on('data', (data) => {
    const msg = data.toString();
    if (process.env.DEBUG) process.stderr.write(`[SERVER stderr] ${msg}`);
  });

  let playwrightExitCode = 1;

  try {
    const isReady = await waitForServer(HEALTH_URL, 60000);
    if (!isReady) {
      console.error(`[HARNESS] ERROR: Server failed to become healthy at ${HEALTH_URL} within 60s.`);
      await cleanupServer(activeServerProc);
      process.exit(1);
    }

    console.log(`[HARNESS] Server is ready at ${HEALTH_URL}. Running Playwright tests...`);

    // Parse CLI arguments to pass to Playwright
    const extraArgs = process.argv.slice(2);
    const playwrightCli = path.join(ROOT_DIR, 'node_modules', '@playwright', 'test', 'cli.js');

    const playwrightProc = spawn(
      process.execPath,
      [playwrightCli, 'test', ...extraArgs],
      {
        cwd: ROOT_DIR,
        stdio: 'inherit',
        shell: false,
        env: {
          ...process.env,
          TEST_BASE_URL: BASE_URL,
        },
      }
    );

    playwrightExitCode = await new Promise((resolve) => {
      playwrightProc.on('close', (code) => resolve(code ?? 1));
      playwrightProc.on('error', (err) => {
        console.error(`[HARNESS] Failed to spawn Playwright: ${err.message}`);
        resolve(1);
      });
    });

  } finally {
    const teardownOk = await cleanupServer(activeServerProc);
    if (!teardownOk) {
      console.error(`[HARNESS] Teardown verification FAILED. Failing test run.`);
      process.exit(1);
    }
    console.log(`[HARNESS] Teardown complete. Exiting with code: ${playwrightExitCode}`);
  }

  process.exit(playwrightExitCode);
}

run();

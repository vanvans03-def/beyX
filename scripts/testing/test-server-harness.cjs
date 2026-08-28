/**
 * Dedicated Test Server Harness for BeyX Functional / E2E Tests
 * 
 * Architecture:
 * 1. Spawns Next.js dev server on port 3333 via Node.js binary (shell: false).
 * 2. Polls /api/health until server is ready.
 * 3. Spawns Playwright test runner via Node.js binary (shell: false) with TEST_BASE_URL.
 * 4. Controlled Process-Tree Termination:
 *    - On test completion or process interruption (SIGINT/SIGTERM), kills the spawned server process tree.
 *    - Verifies that the child process tree is dead and port 3333 is fully released before reporting complete.
 * 5. Accurately forwards the Playwright exit code.
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
      resolve(false); // Port is still open/connected
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(true); // Timed out, likely free
    });
    socket.on('error', () => {
      resolve(true); // Connection refused, port is released
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

async function waitForPortRelease(port, timeoutMs = 15000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const released = await checkPortReleased(port);
    if (released) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch {
    // Process may have already exited
  }
}

let activeServerProc = null;

function cleanup() {
  if (activeServerProc && activeServerProc.pid) {
    killProcessTree(activeServerProc.pid);
    activeServerProc = null;
  }
}

// Register signal handlers for clean teardown on external termination
process.on('SIGINT', () => {
  console.log('\n[HARNESS] Received SIGINT. Performing controlled process-tree termination...');
  cleanup();
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n[HARNESS] Received SIGTERM. Performing controlled process-tree termination...');
  cleanup();
  process.exit(143);
});

process.on('exit', () => {
  cleanup();
});

async function run() {
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
      cleanup();
      process.exit(1);
    }

    console.log(`[HARNESS] Server is ready at ${HEALTH_URL}. Running Playwright tests...`);

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
    console.log('[HARNESS] Performing controlled process-tree termination on Next.js test server...');
    cleanup();

    const isReleased = await waitForPortRelease(PORT, 10000);
    if (isReleased) {
      console.log(`[HARNESS] Verified: Child process tree terminated and port ${PORT} released.`);
    } else {
      console.warn(`[HARNESS] Warning: Port ${PORT} did not report closed within timeout.`);
    }

    console.log(`[HARNESS] Teardown complete. Exiting with code: ${playwrightExitCode}`);
  }

  process.exit(playwrightExitCode);
}

run();

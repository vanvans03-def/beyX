/**
 * Dedicated Test Server Harness for BeyX E2E Tests
 * 
 * Responsibilities:
 * 1. Spawns the Next.js development/test server on port 3333.
 * 2. Polls /api/health until ready or timed out.
 * 3. Executes Playwright test runner with TEST_BASE_URL (disabling internal webServer).
 * 4. Explicitly tears down the spawned server process tree on completion.
 * 5. Accurately forwards the Playwright exit code without suppressing failures.
 */

const { spawn, execFileSync } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = process.env.TEST_PORT || '3333';
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

async function run() {
  console.log(`[HARNESS] Starting Next.js test server on port ${PORT}...`);

  const serverProc = spawn(
    process.execPath,
    [path.join(ROOT_DIR, 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', PORT],
    {
      cwd: ROOT_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
      env: { ...process.env, PORT },
    }
  );

  serverProc.stdout.on('data', (data) => {
    const msg = data.toString();
    if (process.env.DEBUG) process.stdout.write(`[SERVER stdout] ${msg}`);
  });

  serverProc.stderr.on('data', (data) => {
    const msg = data.toString();
    if (process.env.DEBUG) process.stderr.write(`[SERVER stderr] ${msg}`);
  });

  let playwrightExitCode = 1;

  try {
    const isReady = await waitForServer(HEALTH_URL, 60000);
    if (!isReady) {
      console.error(`[HARNESS] ERROR: Server failed to become healthy at ${HEALTH_URL} within 60s.`);
      killProcessTree(serverProc.pid);
      process.exit(1);
    }

    console.log(`[HARNESS] Server is ready at ${HEALTH_URL}. Running Playwright tests...`);

    // Pass through any CLI arguments passed to this harness
    const extraArgs = process.argv.slice(2);
    const playwrightArgs = ['playwright', 'test', ...extraArgs];

    const playwrightProc = spawn(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      playwrightArgs,
      {
        cwd: ROOT_DIR,
        stdio: 'inherit',
        shell: true,
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
    console.log('[HARNESS] Tearing down Next.js test server process tree...');
    killProcessTree(serverProc.pid);
    
    // Ensure process is dead
    await new Promise((r) => setTimeout(r, 500));
    console.log(`[HARNESS] Teardown complete. Exiting with code: ${playwrightExitCode}`);
  }

  process.exit(playwrightExitCode);
}

run();

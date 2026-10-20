const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(subscribe) {
  const source = fs.readFileSync('src/app/api/realtime/tournaments/[id]/route.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  const timers = new Map();
  const setTimer = (callback, ms) => { const handle = {}; timers.set(handle, { callback, ms }); return handle; };
  const clear = handle => timers.delete(handle);
  new Function('exports', 'require', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'process', code)(
    exports, name => {
      assert.equal(name, '@/lib/realtime-hub');
      return { subscribeToTournamentUpdates: subscribe };
    }, setTimer, clear, setTimer, clear, { env: { DATA_BACKEND: 'postgres' } },
  );
  return { GET: exports.GET, timers };
}

test('SSE expiry closes stream and releases listener/timers', async () => {
  let released = 0;
  const { GET, timers } = load(async () => () => { released++; });
  const response = await GET(new Request('https://test/api/realtime/tournaments/id'), { params: Promise.resolve({ id: 'id' }) });
  const reader = response.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /event: ready/);
  assert.equal(timers.size, 2);
  [...timers.values()].find(timer => timer.ms === 300000).callback();
  assert.equal((await reader.read()).done, true);
  assert.equal(released, 1);
  assert.equal(timers.size, 0);
});

test('disconnect while LISTEN connects does not leak subscription or timers', async () => {
  let finishSubscription;
  let released = 0;
  const { GET, timers } = load(() => new Promise(resolve => { finishSubscription = () => resolve(() => { released++; }); }));
  const abort = new AbortController();
  const response = await GET(new Request('https://test/stream', { signal: abort.signal }), { params: Promise.resolve({ id: 'id' }) });
  abort.abort();
  finishSubscription();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(released, 1);
  assert.equal(timers.size, 0);
  assert.equal((await response.body.getReader().read()).done, true);
});

test('already disconnected request does not subscribe', async () => {
  const { GET, timers } = load(() => assert.fail('No subscription expected'));
  const abort = new AbortController(); abort.abort();
  const response = await GET(new Request('https://test/stream', { signal: abort.signal }), { params: Promise.resolve({ id: 'id' }) });
  assert.equal((await response.body.getReader().read()).done, true);
  assert.equal(timers.size, 0);
});

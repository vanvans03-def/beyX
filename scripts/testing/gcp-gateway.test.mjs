import test from 'node:test';
import assert from 'node:assert/strict';
import gateway from '../../deploy/cloudflare/gateway.mjs';

test('maintenance blocks origin reads and writes with retry guidance', async () => {
  for (const method of ['GET', 'POST']) {
    const response = await gateway.fetch(new Request('https://beyx-system.com/api/register', { method }), { MAINTENANCE: '1' }, {});
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('retry-after'), '60');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('HTTP redirects to HTTPS without contacting the origin', async () => {
  const response = await gateway.fetch(new Request('http://beyx-system.com/Team/test?q=1'), {}, {});
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), 'https://beyx-system.com/Team/test?q=1');
});

test('HTTPS API preserves cookies and streams, without edge caching', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async request => {
      assert.equal(request.url, 'https://origin.run.app/api/realtime/test');
      assert.equal(request.headers.get('cookie'), 'session=test');
      assert.equal(request.headers.get('x-forwarded-proto'), 'https');
      assert.equal(request.headers.get('x-forwarded-host'), 'beyx-system.com');
      return new Response('event: ready\n\n', { headers: { 'content-type': 'text/event-stream' } });
    };
    const response = await gateway.fetch(new Request('https://beyx-system.com/api/realtime/test', {
      headers: { cookie: 'session=test' },
    }), { ORIGIN: 'https://origin.run.app', RELEASE: 'test' }, {
      waitUntil() { assert.fail('API must not be cached'); },
    });
    assert.equal(await response.text(), 'event: ready\n\n');
  } finally { globalThis.fetch = original; }
});

test('origin redirects keep the public HTTPS domain', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.redirect('https://origin.run.app/login?next=admin', 307);
    const response = await gateway.fetch(new Request('https://beyx-system.com/admin'), {
      ORIGIN: 'https://origin.run.app', RELEASE: 'test',
    }, {});
    assert.equal(response.headers.get('location'), 'https://beyx-system.com/login?next=admin');
  } finally { globalThis.fetch = original; }
});

// Public origin gateway. Authenticated HTML and API/SSE are never edge-cached.
export default {
  async fetch(request, env, ctx) {
    const incoming = new URL(request.url);
    if (incoming.protocol !== 'https:') {
      incoming.protocol = 'https:';
      return Response.redirect(incoming.href, 308);
    }
    if (env.MAINTENANCE === '1') {
      return new Response('<!doctype html><meta charset="utf-8"><title>BeyX maintenance</title><h1>กำลังย้ายระบบ กรุณารอสักครู่</h1><p>System maintenance. Please try again shortly.</p>', {
        status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '60' },
      });
    }
    const target = new URL(incoming.pathname + incoming.search, env.ORIGIN);
    const headers = new Headers(request.headers);
    headers.set('X-Forwarded-Host', incoming.host);
    headers.set('X-Forwarded-Proto', 'https');
    const cacheable = request.method === 'GET' && !headers.has('authorization') &&
      (incoming.pathname.startsWith('/_next/static/') || incoming.pathname.startsWith('/models/')) &&
      !headers.has('range');
    const cacheKey = new Request(`https://${incoming.host}/__beyx_assets/${env.RELEASE}${incoming.pathname}${incoming.search}`);
    if (cacheable) {
      const hit = await caches.default.match(cacheKey);
      if (hit) return hit;
    }
    const response = await fetch(new Request(target, { method: request.method, headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual' }));
    const result = new Response(response.body, response);
    const location = result.headers.get('location');
    if (location) {
      const redirect = new URL(location, target);
      if (redirect.origin === target.origin) {
        redirect.protocol = incoming.protocol; redirect.host = incoming.host;
        result.headers.set('location', redirect.href);
      }
    }
    if (cacheable && result.status === 200 && !result.headers.has('set-cookie')) {
      result.headers.set('Cache-Control', incoming.pathname.startsWith('/_next/static/')
        ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
      ctx.waitUntil(caches.default.put(cacheKey, result.clone()));
    }
    return result;
  },
};

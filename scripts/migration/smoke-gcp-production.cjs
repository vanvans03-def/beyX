// Read-only deployment checks. Temporary signed session lives in memory for five minutes.
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
async function main() {
  const runtime = JSON.parse(fs.readFileSync('backups/gcp/private/runtime.production.json', 'utf8'));
  const url = new URL(runtime.DATABASE_URL);
  if (url.hostname !== '10.42.0.10' || url.pathname !== '/beyx_prod_20261020') throw new Error('Unexpected production DB target.');
  url.hostname = '127.0.0.1'; url.port = '55432';
  const base = process.env.GCP_SMOKE_BASE_URL || 'https://beyx-web-638873004771.us-central1.run.app';
  if (!['https://beyx-web-638873004771.us-central1.run.app', 'https://beyx-system.com'].includes(base)) throw new Error('Unexpected smoke URL.');
  const db = new Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 15000 });
  try {
    if ((await db.query('SELECT current_database() AS name')).rows[0].name !== 'beyx_prod_20261020') throw new Error('DB identity mismatch.');
    const user = (await db.query("SELECT id,username,role FROM users WHERE role IN ('superadmin','admin','user') ORDER BY (role='superadmin') DESC,username LIMIT 1")).rows[0];
    if (!user) throw new Error('No restored account available for read-only session verification.');
    const { SignJWT } = await import('jose');
    const session = await new SignJWT({ userId: user.id, username: user.username, role: user.role })
      .setProtectedHeader({ alg: 'HS256' }).setIssuer('beyx').setAudience('beyx-web')
      .setSubject(user.id).setJti(randomUUID()).setIssuedAt().setExpirationTime('5m')
      .sign(new TextEncoder().encode(runtime.APP_SESSION_SECRET));
    async function check(path, authenticated = false) {
      const started = performance.now();
      const response = await fetch(base + path, { redirect: 'manual',
        headers: authenticated ? { cookie: `session=${session}` } : {}, signal: AbortSignal.timeout(60000) });
      const content = await response.text();
      if (response.status !== 200) throw new Error(`HTTP ${response.status} for ${path}`);
      console.log(JSON.stringify({ path, status: response.status, ms: Math.round(performance.now() - started) }));
      try { return JSON.parse(content); } catch { return content; }
    }
    for (const path of ['/api/health', '/', '/rankings', '/minigame', '/api/public/rankings']) await check(path);
    const profile = await check('/api/admin/profile', true);
    if (profile.user.username !== user.username || profile.user.role !== user.role) throw new Error('Session identity was not preserved.');
    await check('/api/admin/tournaments', true);
    const tournament = (await db.query("SELECT t.id,u.shop_name FROM tournaments t JOIN users u ON u.id=t.user_id WHERE t.provider='INTERNAL' AND u.shop_name IS NOT NULL AND EXISTS (SELECT 1 FROM internal_matches m WHERE m.tournament_id=t.id) ORDER BY t.created_at DESC LIMIT 1")).rows[0];
    if (!tournament) throw new Error('No restored internal bracket available.');
    await check(`/api/register/config?tournamentId=${tournament.id}`);
    const matches = await check(`/api/public/tournaments/${tournament.id}/matches`);
    if (!Array.isArray(matches.matches) || !matches.matches.length || JSON.stringify(matches).includes('Unknown Player')) throw new Error('Restored public bracket is incomplete.');
    const shortId = tournament.id.replaceAll('-', '').slice(-8);
    const resolved = await check(`/api/public/tournaments/${shortId}?shopName=${encodeURIComponent(tournament.shop_name)}`);
    if (resolved.tournament?.id !== tournament.id) throw new Error('Public short link resolved to the wrong tournament.');
    await check(`/${encodeURIComponent(tournament.shop_name)}/${shortId}`);
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 20000);
    try {
      const response = await fetch(`${base}/api/realtime/tournaments/${tournament.id}`, { signal: abort.signal });
      if (!response.ok || !response.body) throw new Error('Realtime unavailable.');
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let data = '';
      while (!data.includes('event: ready')) {
        const chunk = await reader.read(); if (chunk.done) throw new Error('Realtime closed before ready.');
        data += decoder.decode(chunk.value, { stream: true });
      }
      console.log('PASS: restored database, preserved session signature, public short link and SSE. No application data was written.');
    } finally { clearTimeout(timeout); abort.abort(); }
    if (base === 'https://beyx-system.com') {
      const response = await fetch('http://beyx-system.com/', { redirect: 'manual' });
      if (![301, 308].includes(response.status) || !response.headers.get('location')?.startsWith('https://beyx-system.com/')) throw new Error('HTTPS redirect is missing.');
      console.log('PASS: main domain certificate validation and HTTP-to-HTTPS redirect.');
    }
  } finally { await db.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

// Read-only TLS/routing audit. Never log the Wrangler OAuth credential.
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const config = fs.readFileSync(path.join(process.env.APPDATA, 'xdg.config/.wrangler/config/default.toml'), 'utf8');
  const token = config.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
  if (!token) throw new Error('Wrangler OAuth login is required.');
  async function get(endpoint) {
    const response = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();
    if (!body.success) return { unavailable: true, status: response.status,
      errors: body.errors?.map(({ code, message }) => ({ code, message })) };
    return body.result;
  }
  const zones = await get('/zones?name=beyx-system.com');
  if (!Array.isArray(zones) || zones.length !== 1) throw new Error('Cannot identify the exact Cloudflare zone.');
  const zone = zones[0];
  console.log(JSON.stringify({ domain: zone.name, status: zone.status, zoneId: zone.id,
    ssl: await get(`/zones/${zone.id}/settings/ssl`),
    alwaysUseHttps: await get(`/zones/${zone.id}/settings/always_use_https`),
    universalSsl: await get(`/zones/${zone.id}/ssl/universal/settings`),
    certificates: await get(`/zones/${zone.id}/ssl/certificate_packs`),
    routes: await get(`/zones/${zone.id}/workers/routes`),
  }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

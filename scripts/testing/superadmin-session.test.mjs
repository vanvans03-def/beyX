import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'node:crypto';
const require = createRequire(import.meta.url);
const { NextRequest, NextResponse } = require('next/server');
process.env.APP_SESSION_SECRET = randomBytes(48).toString('hex');
function load(file, mocks = {}) {
 const source = fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
 const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
 const mod = { exports: {} };
 new Function('require', 'module', 'exports', output)(id => Object.hasOwn(mocks, id) ? mocks[id] : require(id), mod, mod.exports);
 return mod.exports;
}
const config = load('src/lib/session-config.ts');
const jar = new Map();
const auth = load('src/lib/auth.ts', {
 jose: { SignJWT, jwtVerify },
 'next/headers': { cookies: async () => ({ set: (key, value) => jar.set(key, value), get: key => jar.has(key) ? { value: jar.get(key) } : undefined, delete: key => jar.delete(key) }) },
 '@/lib/session-config': config,
});
const { middleware } = load('src/middleware.ts', { '@/lib/session-config': config });
const calls = [];
const players = load('src/app/api/admin/players/route.ts', {
 '@/lib/db/admin': { adminDb: { rpc: async (name, args) => { calls.push({ name, args }); return { error: null }; } } },
});
for (const role of ['superadmin', 'admin', 'user']) {
 await auth.createSession('test-user-id', 'test-user', role);
 const token = jar.get(config.SESSION_COOKIE_NAME);
 assert.equal((await auth.getSession()).role, role);
 const page = await middleware(new NextRequest('https://beyx.test/admin/players', { headers: { cookie: `session=${token}` } }));
 assert.equal(page.headers.get('x-middleware-next'), '1', `${role} session must access authenticated pages`);
 const forwarded = await middleware(new NextRequest('https://beyx.test/api/admin/players', { headers: { cookie: `session=${token}`, 'x-user-role': 'superadmin' } }));
 assert.equal(forwarded.headers.get('x-middleware-request-x-user-role'), role, 'Middleware must overwrite spoofed role');
 const headers = new Headers({ 'content-type': 'application/json', 'x-user-role': forwarded.headers.get('x-middleware-request-x-user-role') });
 const response = await players.PATCH(new Request('https://beyx.test/api/admin/players', { method: 'PATCH', headers, body: JSON.stringify({ action: 'merge', sourcePlayerId: 'source-id', targetPlayerId: 'target-id' }) }));
 assert.equal(response.status, role === 'superadmin' ? 200 : 403);
}
assert.deepEqual(calls, [{ name: 'merge_player_profiles', args: { source_player_id: 'source-id', target_player_id: 'target-id' } }]);
await auth.createSession('test-id', 'test', 'unknown-role');assert.equal((await auth.getSession()).role, 'user');
const secret = new TextEncoder().encode(process.env.APP_SESSION_SECRET);
for (const claims of [
 { role: 'owner', iss: config.SESSION_ISSUER, aud: config.SESSION_AUDIENCE },
 { role: 'superadmin', iss: 'wrong', aud: config.SESSION_AUDIENCE },
 { role: 'superadmin', iss: config.SESSION_ISSUER, aud: 'wrong' },
]) {
 const token = await new SignJWT({userId:'test',username:'test',...claims}).setProtectedHeader({alg:'HS256'}).setExpirationTime('1h').sign(secret);
 const response = await middleware(new NextRequest('https://beyx.test/api/admin/players',{headers:{cookie:`session=${token}`}}));assert.equal(response.status,401);
}
for(const token of ['', 'invalid.token.here']) {
 const response = await middleware(new NextRequest('https://beyx.test/api/admin/players',{headers:{cookie:`session=${token}`,'x-user-role':'superadmin'}}));assert.equal(response.status,401);
}
const noSession = await middleware(new NextRequest('https://beyx.test/admin/players'));
assert.equal(noSession.status,307);assert.equal(noSession.headers.get('location'),'https://beyx.test/login');
console.log('PASS: real signed sessions preserve superadmin/admin/user; middleware forwards verified roles; superadmin merge calls correct RPC; regular roles cannot merge; spoofed/invalid sessions rejected. No real player data changed.');

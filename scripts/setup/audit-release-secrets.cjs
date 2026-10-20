// Heuristic staged-file check. Reports locations only, never credential values.
const { execFileSync } = require('node:child_process');
const files = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
let failures = 0;
function fail(file, line, reason) { console.error(`${file}:${line}: ${reason}`); failures++; }
for (const file of files) {
  if ((/(^|\/)\.env(?:$|\.)/.test(file) && !file.endsWith('.example')) || /(^|\/)backups\//.test(file) || /\.(?:dump|pem|key)$/.test(file)) {
    fail(file, 1, 'Private runtime/backup file must not be committed.'); continue;
  }
  if (/\.(?:glb|png|jpg|jpeg|webp|ico|woff2?)$/.test(file)) continue;
  const source = execFileSync('git', ['show', `:${file}`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  for (const [index, line] of source.split('\n').entries()) {
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(line) || /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/.test(line)) fail(file, index + 1, 'Potential private key.');
    const uris = line.match(/postgres(?:ql)?:\/\/[^\s'"`]+/gi) || [];
    for (const uri of uris) {
      if (/[${}<>]/.test(uri) || /YOUR_|example|localhost|127\.0\.0\.1|change.?me/i.test(uri)) continue;
      try { const url = new URL(uri); if (url.password) fail(file, index + 1, 'Potential hard-coded database credential.'); } catch { /* not a literal URI */ }
    }
    if (/(?:APP_SESSION_SECRET|SUPABASE_SERVICE_ROLE_KEY|CLOUDFLARE_R2_SECRET_ACCESS_KEY|GOOGLE_CLIENT_SECRET)\s*[:=]\s*['"][A-Za-z0-9_+\/-]{24,}['"]/.test(line)) fail(file, index + 1, 'Potential hard-coded service secret.');
  }
}
console.log(`Audited ${files.length} staged files; ${failures} potential credential findings. Binary assets were not inspected.`);
if (failures) process.exitCode = 1;

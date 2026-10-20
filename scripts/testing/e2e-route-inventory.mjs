import fs from 'node:fs';
import path from 'node:path';

const journey = (files, note = '') => ({ coverage: 'journey + API assertions', files: files.map(file => `tests/migration/${file}.spec.ts`), note });
const partial = (files, note) => ({ ...journey(files, note), coverage: 'partial / integration outstanding' });
const mapping = {
    '/api/admin/beyblades': journey(['administration', 'registration', 'security']),
    '/api/admin/cx-attachments': partial(['administration'], 'Denial only; successful PATCH mutates a repository JSON file.'),
    '/api/admin/events': journey(['administration', 'security']),
    '/api/admin/match-locks': journey(['tournaments', 'security']),
    '/api/admin/matches': journey(['tournaments', 'challonge-live', 'security'], 'Live provider fallback is not simulated.'),
    '/api/admin/migrate-events': { coverage: 'retired endpoint checklist', files: [], note: 'Do not run schema migration endpoints as E2E setup.' },
    '/api/admin/players/[id]/history': journey(['administration', 'public-data']),
    '/api/admin/players': journey(['administration', 'security']),
    '/api/admin/profile/beyblades': journey(['registration']),
    '/api/admin/profile/password': journey(['administration', 'security']),
    '/api/admin/profile': journey(['administration', 'security']),
    '/api/admin/rankings/tournaments': journey(['administration', 'security']),
    '/api/admin/registrations': journey(['tournaments', 'security']),
    '/api/admin/tournaments/[id]/standings': journey(['public-data']),
    '/api/admin/tournaments/order': journey(['tournaments', 'security']),
    '/api/admin/tournaments/reset': journey(['tournaments', 'security']),
    '/api/admin/tournaments': journey(['tournaments', 'security']),
    '/api/admin/users/manage': journey(['administration', 'security']),
    '/api/admin/users': journey(['administration', 'security']),
    '/api/auth/callback': partial(['public-data'], 'Invalid OAuth state only; valid Google identity needs provider fixture.'),
    '/api/auth/google': partial(['public-data'], 'Disabled provider path only.'),
    '/api/auth/login': journey(['administration']),
    '/api/auth/logout': journey(['administration']),
    '/api/generate-bracket': journey(['tournaments', 'challonge-live', 'security']),
    '/api/health': { coverage: 'runner readiness', files: ['scripts/testing/run-migration-e2e.mjs'], note: '' },
    '/api/image-proxy': partial(['public-data'], 'Unsafe URL rejection only; successful storage CDN transfer pending.'),
    '/api/migrate-challonge': { coverage: 'retired endpoint checklist', files: [], note: 'Expected retired endpoint; never execute legacy data import on real data.' },
    '/api/migrate-password': partial(['public-data'], 'Missing input only; authenticated legacy password migration design needs review.'),
    '/api/og': partial(['public-data'], 'Default PNG; event-specific visual comparison pending.'),
    '/api/public/live-matches': journey(['public-data']),
    '/api/public/players/[id]/history': journey(['public-data']),
    '/api/public/players/suggestions': journey(['public-data', 'registration']),
    '/api/public/rankings/badges': journey(['public-data']),
    '/api/public/rankings': journey(['public-data', 'administration']),
    '/api/public/tournaments/[id]/matches': journey(['tournaments', 'public-data']),
    '/api/public/tournaments/[id]/registrations': journey(['public-data']),
    '/api/public/tournaments/[id]': journey(['tournaments', 'public-data']),
    '/api/public/tournaments/[id]/standings': journey(['tournaments', 'challonge-live', 'public-data']),
    '/api/realtime/tournaments/[id]': journey(['realtime']),
    '/api/register/config': journey(['registration']),
    '/api/register': journey(['registration']),
    '/api/settings': journey(['administration', 'security']),
    '/api/setup-db': partial(['public-data'], 'Read-only instruction endpoint only.'),
    '/api/tts': partial(['public-data'], 'Missing input only; actual provider audio/playback pending.'),
    '/api/upload': partial(['public-data'], 'Empty body only; actual isolated storage fixture pending.'),
    '/api/webhooks/challonge': { coverage: 'integration outstanding', files: [], note: 'Real provider delivery/authenticity/retries need webhook fixtures.' },
};
function walk(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
}
const rows = [];
for (const file of walk('src/app/api').filter(file => /[/\\]route\.tsx?$/.test(file))) {
    const route = '/' + file.replaceAll('\\', '/').replace(/^src\/app\//, '').replace(/\/route\.tsx?$/, '');
    const methods = [...fs.readFileSync(file, 'utf8').matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g)].map(match => match[1]);
    const declared = mapping[route] || { coverage: 'UNMAPPED', files: [], note: 'Add a test and document the remaining boundary.' };
    for (const reference of declared.files) if (!fs.existsSync(reference)) throw new Error(`Missing referenced test ${reference}`);
    for (const method of methods) rows.push({ route, method, ...declared });
}
fs.mkdirSync('test-results', { recursive: true });
fs.writeFileSync('test-results/route-inventory.json', JSON.stringify({ disclaimer: 'Declared route-group coverage checklist, not measured statement/branch/method execution coverage. See individual tests and runtime reports.', rows }, null, 2));
const unmapped = rows.filter(row => row.coverage === 'UNMAPPED');
console.log(`${rows.length} API methods inventoried; ${unmapped.length} unmapped. See test-results/route-inventory.json and E2E_TESTING.md for integration gaps.`);
if (unmapped.length) { console.error(unmapped.map(row => `${row.method} ${row.route}`).join('\n')); process.exitCode = 1; }

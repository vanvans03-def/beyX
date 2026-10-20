const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const directory = path.resolve('backups/gcp/private');
const settings = dotenv.parse(fs.readFileSync(path.join(directory, 'data-vm.env')));
const file = path.join(directory, 'e2e.env');
const url = `postgresql://beyx_app:${settings.LOCAL_POSTGRES_APP_PASSWORD}@127.0.0.1:55432/beyx_rehearsal`;
fs.writeFileSync(file, [
  `E2E_DATABASE_URL=${url}`, 'E2E_DATABASE_NAME=beyx_rehearsal', 'E2E_ALLOW_WRITES=1',
  'E2E_DATABASE_SSL=disable', `E2E_REALTIME_DATABASE_URL=${url}`, 'E2E_PORT=3345', '',
].join('\n'), { mode: 0o600 });
console.log('Private GCP rehearsal E2E settings written; no production database configured.');

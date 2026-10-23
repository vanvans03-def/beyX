import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Self-signed keys are for loopback tests only, never for a deployed environment.
fs.mkdirSync('test-results', { recursive: true });
const config = path.resolve('test-results/motion-local-openssl.cnf');
fs.writeFileSync(config, '[req]\ndistinguished_name=local_dn\nprompt=no\n[local_dn]\nCN=localhost\n');
const bundled = 'C:/Program Files/Git/usr/bin/openssl.exe';
const openssl = process.platform === 'win32' && fs.existsSync(bundled) ? bundled : 'openssl';
execFileSync(openssl, ['req', '-config', config, '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', 'test-results/motion-local-key.pem', '-out', 'test-results/motion-local-cert.pem',
    '-days', '2', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
fs.chmodSync('test-results/motion-local-key.pem', 0o600);
console.log('Temporary loopback-only TLS certificate ready (2 days). Not installed in the system trust store.');

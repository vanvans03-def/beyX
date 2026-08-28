const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..', '..');
const inputPath = process.env.BACKUP_FILE && path.resolve(process.env.BACKUP_FILE);
const database = process.env.RESTORE_DATABASE;
const container = process.env.POSTGRES_CONTAINER || 'beyx-postgres';
const adminUser = process.env.POSTGRES_BACKUP_ADMIN_USER || 'beyx_admin';
const passphrase = process.env.BACKUP_ENCRYPTION_KEY;

if (!inputPath || !fs.existsSync(inputPath)) throw new Error('BACKUP_FILE must point to an encrypted backup');
if (!database || !/^beyx_restore_[a-zA-Z0-9_]+$/.test(database)) throw new Error('RESTORE_DATABASE must start with beyx_restore_');
if (!passphrase || passphrase.length < 32) throw new Error('BACKUP_ENCRYPTION_KEY must contain at least 32 characters');

const file = fs.readFileSync(inputPath);
const firstNewline = file.indexOf(10);
const secondNewline = file.indexOf(10, firstNewline + 1);
if (file.subarray(0, firstNewline).toString() !== 'BEYXBACKUP1') throw new Error('Unknown backup format');
const headerText = file.subarray(firstNewline + 1, secondNewline).toString();
const header = JSON.parse(headerText);
const tag = file.subarray(file.length - 16);
const encrypted = file.subarray(secondNewline + 1, file.length - 16);
const key = crypto.scryptSync(passphrase, Buffer.from(header.salt, 'base64'), 32);
const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(header.iv, 'base64'));
decipher.setAAD(Buffer.from(headerText));
decipher.setAuthTag(tag);
const dump = Buffer.concat([decipher.update(encrypted), decipher.final()]);

const exists = spawnSync('docker', ['exec', container, 'psql', '--username', adminUser, '--dbname', 'postgres', '--tuples-only', '--no-align', '--command', `SELECT 1 FROM pg_database WHERE datname='${database}'`], { encoding: 'utf8' });
if (exists.status !== 0) throw new Error('Could not verify restore target');
if (exists.stdout.trim() === '1') throw new Error(`Restore target already exists: ${database}`);

let result = spawnSync('docker', ['exec', container, 'createdb', '--username', adminUser, database], { encoding: 'utf8' });
if (result.status !== 0) throw new Error(`createdb failed: ${result.stderr.trim()}`);
result = spawnSync('docker', ['exec', '-i', container, 'pg_restore', '--username', adminUser, '--dbname', database, '--no-owner', '--no-privileges', '--single-transaction'], { input: dump, encoding: null, maxBuffer: 256 * 1024 * 1024 });
if (result.status !== 0) throw new Error(`pg_restore failed: ${(result.stderr || Buffer.alloc(0)).toString('utf8').trim()}`);

console.log(`[RESTORE] PASS: encrypted backup restored into new database ${database}.`);
console.log('[RESTORE] Decrypted dump was kept in memory only.');

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..', '..');
const backupDir = path.resolve(process.env.BACKUP_DIR || path.join(rootDir, 'backups'));
const database = process.env.BACKUP_DATABASE || 'beyx';
const container = process.env.POSTGRES_CONTAINER || 'beyx-postgres';
const adminUser = process.env.POSTGRES_BACKUP_ADMIN_USER || 'beyx_admin';
const passphrase = process.env.BACKUP_ENCRYPTION_KEY;

if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(database)) throw new Error('Unsafe BACKUP_DATABASE');
if (!passphrase || passphrase.length < 32) throw new Error('BACKUP_ENCRYPTION_KEY must contain at least 32 characters');

fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const fileName = `beyx-${database}-${stamp}.dump.enc`;
const outputPath = path.join(backupDir, fileName);

const dump = spawnSync('docker', [
  'exec', container, 'pg_dump', '--format=custom', '--no-owner', '--no-privileges',
  '--username', adminUser, '--dbname', database,
], { cwd: rootDir, encoding: null, maxBuffer: 256 * 1024 * 1024 });
if (dump.error) throw dump.error;
if (dump.status !== 0) throw new Error(`pg_dump failed: ${(dump.stderr || Buffer.alloc(0)).toString('utf8').trim()}`);

const salt = crypto.randomBytes(32);
const iv = crypto.randomBytes(12);
const key = crypto.scryptSync(passphrase, salt, 32);
const header = JSON.stringify({ version: 1, cipher: 'aes-256-gcm', kdf: 'scrypt', salt: salt.toString('base64'), iv: iv.toString('base64') });
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
cipher.setAAD(Buffer.from(header));
const encrypted = Buffer.concat([cipher.update(dump.stdout), cipher.final()]);
const file = Buffer.concat([Buffer.from(`BEYXBACKUP1\n${header}\n`), encrypted, cipher.getAuthTag()]);
fs.writeFileSync(outputPath, file, { mode: 0o600 });

console.log(`[BACKUP] Created encrypted backup: ${outputPath}`);
console.log(`[BACKUP] Plaintext dump was kept in memory only; encrypted bytes=${file.length}.`);

async function uploadIfConfigured() {
  const endpoint = process.env.BACKUP_R2_ENDPOINT;
  const bucket = process.env.BACKUP_R2_BUCKET;
  const accessKeyId = process.env.BACKUP_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BACKUP_R2_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    console.log('[BACKUP] Off-host upload skipped: R2 backup variables are not fully configured.');
    return;
  }
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  const client = new S3Client({ region: 'auto', endpoint, credentials: { accessKeyId, secretAccessKey } });
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: `database/${fileName}`, Body: file, ContentType: 'application/octet-stream' }));
  console.log(`[BACKUP] Uploaded encrypted backup to off-host object key: database/${fileName}`);
}

uploadIfConfigured().catch((error) => {
  console.error(`[BACKUP] Off-host upload failed: ${error.message}`);
  process.exitCode = 1;
});

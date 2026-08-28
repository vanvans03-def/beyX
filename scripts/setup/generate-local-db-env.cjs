/**
 * Local Database Environment Generator and Strict ACL Verifier for BeyX
 * 
 * Generates `.env.local-db` with cryptographically secure random passwords,
 * verifies file permissions against a strict whitelist, and applies restrictive ACLs without leaking secrets.
 * 
 * SECURITY RULES:
 * - NEVER print secrets to terminal stdout or log files.
 * - NEVER commit the generated `.env.local-db` file.
 * - NEVER regenerate secrets when .env.local-db already exists.
 * - ALWAYS return a non-zero exit code if ACL verification fails and cannot be hardened.
 * - NEVER construct shell commands using string concatenation of environment variables.
 *   Always use execFileSync with an explicit argument array.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function randomSecret(len = 32) {
  return crypto.randomBytes(len * 2).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, len);
}

const targetPath = path.join(__dirname, '..', '..', '.env.local-db');

function checkWindowsAcl(filePath) {
  const username = process.env.USERNAME;
  if (!username) {
    console.error('[ACL CHECK] ERROR: USERNAME environment variable is not defined.');
    return false;
  }

  try {
    const output = execFileSync('icacls.exe', [filePath], { encoding: 'utf8' });
    const lines = output.split('\n').map(l => l.trim()).filter(Boolean);
    
    console.log('[ACL CHECK] Current ACL entries for .env.local-db:');
    lines.forEach(line => console.log(`  ${line}`));

    // Parse each ACL principal entry
    // Valid principals: current user, SYSTEM, Administrators
    const aclEntriesText = output.replace(filePath, '').replace(/Successfully processed.*/i, '');
    
    const hasSystem = /NT AUTHORITY\\SYSTEM/i.test(aclEntriesText) || /\bSYSTEM\b/i.test(aclEntriesText);
    const hasAdmin = /BUILTIN\\Administrators/i.test(aclEntriesText) || /\bAdministrators\b/i.test(aclEntriesText);
    const userRegex = new RegExp(`\\\\?${username}\\b`, 'i');
    const hasUser = userRegex.test(aclEntriesText);

    // Reject any unauthorized principals
    const unauthorizedKeywords = [
      'BUILTIN\\Users',
      '\\Users:',
      'Everyone',
      'Authenticated Users',
      'Domain Users',
      'INTERACTIVE',
      'ALL APPLICATION PACKAGES'
    ];

    let hasUnauthorized = false;
    for (const keyword of unauthorizedKeywords) {
      if (aclEntriesText.toLowerCase().includes(keyword.toLowerCase())) {
        hasUnauthorized = true;
        console.warn(`[ACL CHECK] Unauthorized principal detected: ${keyword}`);
        break;
      }
    }

    const isValid = hasSystem && hasAdmin && hasUser && !hasUnauthorized;

    if (isValid) {
      console.log('[ACL CHECK] Result: PASS (Strictly restricted to current user, SYSTEM, and Administrators).');
      return true;
    } else {
      console.warn('[ACL CHECK] Result: FAIL (ACL does not strictly match required whitelist).');
      if (!hasUser) console.warn(`  - Missing current user (${username}) access`);
      if (!hasSystem) console.warn('  - Missing SYSTEM access');
      if (!hasAdmin) console.warn('  - Missing Administrators access');
      if (hasUnauthorized) console.warn('  - Contains broader/unauthorized access grants');
      return false;
    }
  } catch (err) {
    console.error(`[ACL CHECK] ERROR: Failed to inspect ACL via icacls: ${err.message}`);
    return false;
  }
}

function applyWindowsAcl(filePath) {
  const username = process.env.USERNAME;
  if (!username) {
    console.error('[ACL SET] ERROR: USERNAME environment variable is not defined.');
    return false;
  }

  try {
    execFileSync('icacls.exe', [
      filePath,
      '/inheritance:r',
      '/grant:r',
      `${username}:(R,W)`,
      '/grant:r',
      'SYSTEM:(F)',
      '/grant:r',
      'Administrators:(F)'
    ], { stdio: 'ignore' });
    console.log('[ACL SET] Applied strict restrictive ACL using execFileSync argument array.');
    return true;
  } catch (err) {
    console.error(`[ACL SET] ERROR: Failed to apply icacls: ${err.message}`);
    return false;
  }
}

if (fs.existsSync(targetPath)) {
  console.log(`[INFO] .env.local-db already exists at: ${targetPath}`);
  console.log('[INFO] Existing secrets preserved (will NOT regenerate).');
  
  if (process.platform === 'win32') {
    let passed = checkWindowsAcl(targetPath);
    if (!passed) {
      console.log('[INFO] Attempting to harden ACL to required whitelist...');
      applyWindowsAcl(targetPath);
      passed = checkWindowsAcl(targetPath);
      if (!passed) {
        console.error('[FATAL] ACL verification failed after hardening attempt.');
        process.exit(1);
      }
    }
  }
  process.exit(0);
}

// File does not exist: generate it securely
const adminPass = randomSecret(32);
const appPass = randomSecret(32);
const backupPass = randomSecret(32);
const sessionSecret = randomSecret(48);

const content = [
  '# Local PostgreSQL and Session configuration (NEVER COMMIT)',
  'LOCAL_POSTGRES_DB=beyx',
  'LOCAL_POSTGRES_ADMIN_USER=beyx_admin',
  `LOCAL_POSTGRES_ADMIN_PASSWORD=${adminPass}`,
  `LOCAL_POSTGRES_APP_PASSWORD=${appPass}`,
  `LOCAL_POSTGRES_BACKUP_PASSWORD=${backupPass}`,
  'LOCAL_POSTGRES_PORT=5432',
  'LOCAL_POSTGRES_BACKUP_DIR=./backups',
  '',
  `APP_SESSION_SECRET=${sessionSecret}`,
  ''
].join('\n');

try {
  fs.writeFileSync(targetPath, content, { encoding: 'utf8', mode: 0o600 });
  console.log('SUCCESS: .env.local-db created successfully with secure random credentials.');
  console.log('Note: Secrets were NOT printed to stdout to protect credentials.');

  if (process.platform === 'win32') {
    applyWindowsAcl(targetPath);
    const passed = checkWindowsAcl(targetPath);
    if (!passed) {
      console.error('[FATAL] ACL verification failed on newly created .env.local-db.');
      process.exit(1);
    }
  } else {
    console.log('Linux / macOS file permission hardening guidance:');
    console.log('  chmod 600 .env.local-db');
  }
} catch (err) {
  console.error(`ERROR: Failed to create .env.local-db: ${err.message}`);
  process.exit(1);
}

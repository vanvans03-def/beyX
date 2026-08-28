/**
 * Comprehensive Supabase Usage Audit Tool for BeyX
 * 
 * Classifies all codebase files in `src/` into 4 distinct categories:
 * 1. Direct Imports & Runtime Calls (e.g. supabaseAdmin.from, @supabase/ssr, createClient)
 * 2. SUPABASE_* Environment Variable Dependencies (e.g. SUPABASE_JWT_SECRET, SUPABASE_URL)
 * 3. Indirect Repository Dependencies (files using @/lib/repository which wraps Supabase)
 * 4. Comments & Text-Only References (no active imports or calls)
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');
const srcDir = path.join(rootDir, 'src');

function getAllSourceFiles(dir) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllSourceFiles(fullPath));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const allFiles = getAllSourceFiles(srcDir);

const categories = {
  directRuntime: [],
  envOnly: [],
  indirectRepo: [],
  commentsOnly: []
};

// Also track exact supabaseAdmin.from call count
let supabaseAdminFromFiles = [];

for (const fullPath of allFiles) {
  const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
  const rawContent = fs.readFileSync(fullPath, 'utf8');

  // Strip block and line comments to check active code
  const codeWithoutComments = rawContent
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');

  const hasDirectImport = /from\s+['"][^'"]*supabase[^'"]*['"]/.test(codeWithoutComments);
  const hasRuntimeCall = /(supabaseAdmin\.|supabase\.|createBrowserClient|createServerClient|createClient)/.test(codeWithoutComments);
  const hasEnvDep = /process\.env\.[A-Z0-9_]*SUPABASE[A-Z0-9_]*/.test(codeWithoutComments);
  const hasIndirectRepo = /from\s+['"]@\/lib\/repository['"]/.test(codeWithoutComments);
  const hasCommentRef = /(supabase|supabaseAdmin)/i.test(rawContent) && !hasDirectImport && !hasRuntimeCall && !hasEnvDep;
  const callsAdminFrom = /supabaseAdmin\s*\.\s*from\s*\(/.test(codeWithoutComments);

  if (callsAdminFrom) {
    supabaseAdminFromFiles.push(relPath);
  }

  if (hasDirectImport || hasRuntimeCall) {
    categories.directRuntime.push({
      file: relPath,
      hasDirectImport,
      hasRuntimeCall,
      hasEnvDep,
      callsAdminFrom
    });
  } else if (hasEnvDep) {
    categories.envOnly.push({
      file: relPath,
      envVars: (codeWithoutComments.match(/process\.env\.[A-Z0-9_]*SUPABASE[A-Z0-9_]*/g) || [])
    });
  } else if (hasIndirectRepo) {
    categories.indirectRepo.push({
      file: relPath
    });
  } else if (hasCommentRef) {
    categories.commentsOnly.push({
      file: relPath
    });
  }
}

console.log('================================================================');
console.log('                 BEYX SUPABASE AUDIT REPORT                     ');
console.log('================================================================\n');

console.log(`1. DIRECT IMPORTS & RUNTIME USAGE (${categories.directRuntime.length} files):`);
categories.directRuntime.forEach((item, idx) => {
  const details = [];
  if (item.hasDirectImport) details.push('import');
  if (item.callsAdminFrom) details.push('supabaseAdmin.from');
  else if (item.hasRuntimeCall) details.push('runtime-call');
  if (item.hasEnvDep) details.push('env');
  console.log(`   ${(idx + 1).toString().padStart(2, ' ')}. ${item.file} [${details.join(', ')}]`);
});

console.log(`\n2. SUPABASE_* ENVIRONMENT DEPENDENCIES ONLY (${categories.envOnly.length} files):`);
categories.envOnly.forEach((item, idx) => {
  console.log(`   ${(idx + 1).toString().padStart(2, ' ')}. ${item.file} [${item.envVars.join(', ')}]`);
});

console.log(`\n3. INDIRECT REPOSITORY DEPENDENCIES (${categories.indirectRepo.length} files):`);
categories.indirectRepo.forEach((item, idx) => {
  console.log(`   ${(idx + 1).toString().padStart(2, ' ')}. ${item.file}`);
});

console.log(`\n4. COMMENTS & TEXT-ONLY REFERENCES (${categories.commentsOnly.length} files):`);
categories.commentsOnly.forEach((item, idx) => {
  console.log(`   ${(idx + 1).toString().padStart(2, ' ')}. ${item.file}`);
});

console.log('\n----------------------------------------------------------------');
console.log(`SUMMARY:`);
console.log(`- Files with Direct Supabase Import/Runtime Call: ${categories.directRuntime.length}`);
console.log(`- Files with supabaseAdmin.from(...) specifically: ${supabaseAdminFromFiles.length}`);
console.log(`- Files with SUPABASE_* Environment Variable only: ${categories.envOnly.length}`);
console.log(`- Files with Indirect Repository Dependency: ${categories.indirectRepo.length}`);
console.log(`- Files with Comments-only Reference: ${categories.commentsOnly.length}`);
console.log('----------------------------------------------------------------\n');

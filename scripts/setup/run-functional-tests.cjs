const { spawn } = require('child_process');
const path = require('path');

const start = Date.now();
console.log('[RUN] Starting npm run test:functional...');

const proc = spawn('npm.cmd', ['run', 'test:functional'], {
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '..', '..'),
});

proc.on('close', (code) => {
  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`\n========================================`);
  console.log(`PLAYWRIGHT_EXIT_CODE=${code}`);
  console.log(`PLAYWRIGHT_DURATION_SECONDS=${duration}s`);
  console.log(`========================================`);
  process.exit(code);
});

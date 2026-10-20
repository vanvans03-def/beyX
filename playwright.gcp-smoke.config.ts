import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.GCP_UI_BASE_URL || 'https://beyx-rehearsal-638873004771.us-central1.run.app';
if (!['https://beyx-rehearsal-638873004771.us-central1.run.app', 'https://beyx-system.com'].includes(baseURL)) throw new Error('Unexpected public UI smoke target.');

export default defineConfig({
  testDir: './tests/migration',
  testMatch: 'public-ui.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  outputDir: 'test-results/gcp-smoke',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/gcp-smoke', open: 'never' }],
    ['json', { outputFile: 'test-results/gcp-smoke-results.json' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
    launchOptions: { args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});

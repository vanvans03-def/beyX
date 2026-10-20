import { defineConfig, devices } from '@playwright/test';
const baseURL = 'https://beyx-rehearsal-638873004771.us-central1.run.app';
process.env.E2E_STAGING_BASE_URL = baseURL;
export default defineConfig({
  testDir: './tests/gcp', workers: 1, retries: 0, timeout: 120_000,
  expect: { timeout: 20_000 }, outputDir: 'test-results/gcp-reconnect',
  reporter: [['list'], ['json', { outputFile: 'test-results/gcp-reconnect-results.json' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } }],
});

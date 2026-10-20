import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/migration',
    fullyParallel: false,
    workers: 1,
    retries: 0,
    forbidOnly: Boolean(process.env.CI),
    timeout: 120_000,
    expect: { timeout: 20_000 },
    outputDir: 'test-results/migration',
    reporter: [['list'], ['html', { outputFolder: 'playwright-report/migration', open: 'never' }], ['json', { outputFile: 'test-results/migration-results.json' }]],
    use: { baseURL: process.env.TEST_BASE_URL || 'http://127.0.0.1:3345', trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'retain-on-failure', navigationTimeout: 120_000, actionTimeout: 20_000, launchOptions: { args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
    projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: process.env.E2E_CHALLONGE_LIVE === '1' ? [] : ['**/challonge-live.spec.ts'] },
        { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: '**/public-ui.spec.ts' }],
});

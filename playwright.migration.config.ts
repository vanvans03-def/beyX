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
    use: { baseURL: process.env.TEST_BASE_URL || 'http://127.0.0.1:3345', ignoreHTTPSErrors: process.env.E2E_LOCAL_TLS === '1' && process.env.TEST_BASE_URL === 'https://127.0.0.1:3346', trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'off', navigationTimeout: 120_000, actionTimeout: 20_000, launchOptions: { args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
    projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: process.env.E2E_CHALLONGE_LIVE === '1' ? [] : ['**/challonge-live.spec.ts'] },
        { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: ['**/public-ui.spec.ts', '**/motion-ui.spec.ts', '**/social-sharing.spec.ts', '**/home-compact.spec.ts', '**/login-ux.spec.ts', '**/admin-dashboard-ux.spec.ts', '**/shared-tabs.spec.ts'] },
        { name: 'ipad', use: { ...devices['iPad (gen 7)'], defaultBrowserType: 'chromium' }, testMatch: ['**/public-ui.spec.ts', '**/motion-ui.spec.ts', '**/social-sharing.spec.ts', '**/home-compact.spec.ts', '**/login-ux.spec.ts', '**/admin-dashboard-ux.spec.ts', '**/shared-tabs.spec.ts'] }],
});

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.TEST_BASE_URL || "http://127.0.0.1:3333";
const useExternalServer = Boolean(process.env.TEST_BASE_URL);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.TEST_WORKERS ? Number(process.env.TEST_WORKERS) : (process.env.CI ? 2 : undefined),
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
      testMatch: /public-and-registration\.spec\.ts/,
    },
  ],
  webServer: useExternalServer
    ? undefined
    : {
        command: "node ./node_modules/next/dist/bin/next dev -p 3333",
        url: `${baseURL}/api/health`,
        reuseExistingServer: Boolean(process.env.REUSE_EXISTING_SERVER),
        timeout: 120_000,
      },
});

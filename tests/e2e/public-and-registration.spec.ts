import { expect, test } from "@playwright/test";

const registrationCases = [
  ["NMM", "TEST_TOURNAMENT_NMM_ID"],
  ["U10", "TEST_TOURNAMENT_U10_ID"],
  ["U10CUSTOM", "TEST_TOURNAMENT_U10CUSTOM_ID"],
] as const;

for (const [mode, envName] of registrationCases) {
  test(`registration page works for ${mode}`, async ({ page, request }) => {
    const tournamentId = process.env[envName];
    test.skip(!tournamentId, `Set ${envName} to enable this journey`);

    const configResponse = await request.get(
      `/api/register/config?tournamentId=${encodeURIComponent(tournamentId!)}`,
    );
    expect(configResponse.status()).toBe(200);
    const config = await configResponse.json();
    expect(config.success).toBe(true);
    expect(Array.isArray(config.beyblades)).toBe(true);
    expect(Array.isArray(config.banList)).toBe(true);

    const response = await page.goto(`/register/${tournamentId}`, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    await expect(page.locator("body")).not.toContainText("Tournament not found");
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
  });
}

test("shared bucket page loads its bracket and standings APIs", async ({ page, request }) => {
  const publicPath = process.env.TEST_BUCKET_PATH;
  const tournamentId = process.env.TEST_BUCKET_TOURNAMENT_ID;
  test.skip(!publicPath || !tournamentId, "Set TEST_BUCKET_PATH and TEST_BUCKET_TOURNAMENT_ID");

  const response = await page.goto(publicPath!, { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page.locator("body")).not.toContainText("Tournament Not Found");

  const [matches, standings] = await Promise.all([
    request.get(`/api/public/tournaments/${tournamentId}/matches`),
    request.get(`/api/public/tournaments/${tournamentId}/standings`),
  ]);
  expect(matches.status()).toBe(200);
  expect(standings.status()).toBe(200);
});

import { expect, test } from "@playwright/test";

test("health endpoint is ready", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual({ status: "ok" });
});

test("scoreboard supports scoring and correction", async ({ page }) => {
  await page.goto("/score-board");
  await expect(page.getByRole("heading", { name: "RED" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "BLUE" })).toBeVisible();
  await expect(page.getByTestId("score-value-1")).toHaveText("0");

  await page.getByRole("button", { name: "Add 1 point to RED" }).click();
  await expect(page.getByTestId("score-value-1")).toHaveText("1");

  await page.waitForTimeout(2_100);
  await page.getByRole("button", { name: "Remove 1 point from RED" }).click();
  await expect(page.getByRole("heading", { name: "Remove Point?" })).toBeVisible();
  await page.getByRole("button", { name: /confirm/i }).click();
  await expect(page.getByTestId("score-value-1")).toHaveText("0");
});

test("protected organizer page redirects without a session", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
});

test("six judges can open one organizer account concurrently", async ({ browser, baseURL }) => {
  const tournamentId = process.env.TEST_ORGANIZER_TOURNAMENT_ID;
  const session = process.env.TEST_SESSION_COOKIE;
  test.skip(!tournamentId || !session, "Set TEST_ORGANIZER_TOURNAMENT_ID and TEST_SESSION_COOKIE");

  const origin = new URL(baseURL!);
  const contexts = await Promise.all(
    Array.from({ length: 6 }, async () => {
      const context = await browser.newContext();
      await context.addCookies([{
        name: "session",
        value: session!,
        domain: origin.hostname,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure: origin.protocol === "https:",
      }]);
      return context;
    }),
  );

  try {
    const responses = await Promise.all(contexts.map(async (context) => {
      const page = await context.newPage();
      return page.goto(`/admin/tournament/${tournamentId}`, { waitUntil: "domcontentloaded" });
    }));
    for (const response of responses) expect(response?.status()).toBe(200);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

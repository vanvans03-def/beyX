import { test, expect } from '@playwright/test';

test('homepage remains readable and navigable without animation JavaScript', async ({ browser, baseURL, viewport, isMobile, hasTouch, deviceScaleFactor }) => {
    const context = await browser.newContext({ viewport, isMobile, hasTouch, deviceScaleFactor, javaScriptEnabled: false, baseURL, ignoreHTTPSErrors: baseURL === 'https://127.0.0.1:3346' && process.env.E2E_LOCAL_TLS === '1' });
    try {
        const page = await context.newPage(); await page.goto('/');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('BeyX System - Beyblade X Tournament Manager');
        for (const href of ['/minigame', '/rankings', '/admin', '/score-board']) {
            const link = page.locator(`a[href="${href}"]`);
            await expect(link).toBeVisible(); await expect(link).toHaveCSS('opacity', '1');
        }
        await page.locator('a[href="/minigame"]').click();
        await expect(page).toHaveURL(/\/minigame$/);
    } finally { await context.close(); }
});

test('homepage rapid collisions remain stable against the screen edge', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const first = page.getByRole('button', { name: 'ลาก Drake Brave G', exact: true });
    const second = page.getByRole('button', { name: 'ลาก Unicorn Delta PO', exact: true });
    await expect(first).toBeVisible(); await expect(second).toBeVisible();
    await page.getByRole('button', { name: 'พักลูกข่าง', exact: true }).click();
    const a = (await first.boundingBox())!, b = (await second.boundingBox())!;
    const width = page.viewportSize()!.width, y = b.y + 44;
    await page.mouse.move(a.x + 44, a.y + 44); await page.mouse.down();
    await page.mouse.move(a.x + 44, y, { steps: 4 });
    for (let i = 0; i < 12; i++) {
        await page.mouse.move(Math.max(60, width - 220), y, { steps: 4 });
        await page.mouse.move(width - 44, y, { steps: 16 });
        const held = (await first.boundingBox())!, pushed = (await second.boundingBox())!;
        // In 2D the pushed top can slide along the wall above/below the held top.
        expect(Math.hypot(pushed.x - held.x, pushed.y - held.y)).toBeGreaterThanOrEqual(71);
        expect(pushed.x).toBeGreaterThanOrEqual(-1);
        expect(pushed.y).toBeGreaterThanOrEqual(-1);
        expect(pushed.x + 88).toBeLessThanOrEqual(width + 1);
        expect(pushed.y + 88).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
    }
    await page.mouse.up();
    expect(errors).toEqual([]);
});

test('homepage models drag, collide, pause, reset and navigate to minigame', async ({ page }, info) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const first = page.getByRole('button', { name: 'ลาก Drake Brave G', exact: true });
    const second = page.getByRole('button', { name: 'ลาก Unicorn Delta PO', exact: true });
    await expect(first).toBeVisible(); await expect(second).toBeVisible();
    await page.getByRole('button', { name: 'พักลูกข่าง', exact: true }).click();
    const a = (await first.boundingBox())!, b = (await second.boundingBox())!;
    await page.mouse.move(a.x + 44, a.y + 44); await page.mouse.down(); await page.mouse.move(b.x + 25, b.y + 44, { steps: 15 }); await page.mouse.up();
    expect((await second.boundingBox())!.x).toBeGreaterThan(b.x);
    await first.focus(); const previous = (await first.boundingBox())!.x; await page.keyboard.press('ArrowLeft'); expect((await first.boundingBox())!.x).toBeLessThan(previous);
    await page.getByRole('button', { name: 'เรียกกลับ', exact: true }).click();
    await expect(page.locator('a[href="/events"]')).toHaveCount(0);
    await page.getByRole('link', { name: /มินิเกม/ }).click(); await expect(page).toHaveURL(/\/minigame$/);
    await expect(page.getByRole('button', { name: 'เริ่มมินิเกม', exact: true })).toBeEnabled();
    await page.screenshot({ path: info.outputPath('xtreme-stadium.png'), fullPage: true });
    const clockStart = new Date('2030-01-01T00:00:00Z');
    await page.clock.install({ time: clockStart });
    await page.clock.pauseAt(new Date(clockStart.valueOf() + 1000));
    await page.getByRole('button', { name: /Unicorn Delta PO/ }).click();
    await page.getByRole('button', { name: 'เริ่มมินิเกม', exact: true }).click();
    await page.getByRole('button', { name: 'หยุดพัก', exact: true }).click(); await expect(page.getByText('พักเกม', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'เล่นต่อ', exact: true }).click();
    // This journey verifies the launch control, not human reaction within an 800ms window.
    // Timing quality itself is covered deterministically by test:minigame.
    await page.getByRole('button', { name: 'GO SHOOT! / Space', exact: true }).click();
    await page.clock.runFor(4000);
    const arena = page.getByRole('group', { name: /สนามมินิเกม|Battle arena/ });
    const field = (await arena.boundingBox())!;
    await page.mouse.move(field.x + field.width * 0.45, field.y + field.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(field.x + field.width * 0.7, field.y + field.height * 0.35, { steps: 8 });
    await page.clock.runFor(250);
    await page.mouse.up();
    await expect(page.getByRole('button', { name: /ไม้ตาย/ })).toBeVisible();
    await page.getByRole('button', { name: 'เริ่มใหม่', exact: true }).click();
    await expect(page.getByRole('button', { name: 'เริ่มมินิเกม', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
});

test('homepage language persists and login has no game canvas', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: 'เปลี่ยนภาษา' }).click();
    await expect(page.getByRole('link', { name: /Mini Game/ })).toBeVisible(); await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('link', { name: /Mini Game/ })).toBeVisible();
    await page.goto('/login', { waitUntil: 'commit' }); await expect(page.getByRole('heading', { name: 'Admin Portal' })).toBeVisible(); await expect(page.locator('canvas')).toHaveCount(0);
    const protectedPage = await page.request.get('/admin/players', { maxRedirects: 0 });
    expect(protectedPage.status()).toBe(307); expect(protectedPage.headers().location).toContain('/login');
});

test('scoreboard spin/burst/over/xtreme scoring and correction', async ({ page }) => {
    await page.goto('/score-board', { waitUntil: 'domcontentloaded' });
    for (const [label, score] of [['Add 1 point to RED', '1'], ['Add 2 points to RED by Burst', '3'], ['Add 2 points to BLUE by Over', '2'], ['Add 3 points to BLUE by Xtreme', '5']]) {
        await page.getByRole('button', { name: label, exact: true }).click();
        await expect(page.getByTestId(label.includes('RED') ? 'score-value-1' : 'score-value-2')).toHaveText(score);
        await page.waitForTimeout(2100); // Product deliberately debounces scores for two seconds.
    }
    await page.getByRole('button', { name: 'Remove 1 point from RED', exact: true }).click();
    await page.getByRole('button', { name: /confirm/i }).click(); await expect(page.getByTestId('score-value-1')).toHaveText('2');
});

test('reduced motion keeps models interactive', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/', { waitUntil: 'domcontentloaded' });
    const blade = page.getByRole('button', { name: 'ลาก Drake Brave G', exact: true }); await expect(blade).toBeVisible();
    const box = (await blade.boundingBox())!; await page.waitForTimeout(300); expect((await blade.boundingBox())!.x).toBeCloseTo(box.x, 0);
    await blade.focus(); await page.keyboard.press('ArrowRight'); expect((await blade.boundingBox())!.x).toBeGreaterThan(box.x);
});

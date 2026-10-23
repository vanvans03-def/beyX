import { test, expect } from '@playwright/test';

declare global { interface Window { __homeEntranceObserved?: boolean } }

test('compact home: visible entrance animation, raised menus, footer-only credits and small playground', async ({ page }, info) => {
    await page.addInitScript(() => {
        new MutationObserver(records => {
            for (const record of records) {
                const node = record.target;
                if (node instanceof HTMLElement && node.dataset.motion === 'home' && node.style.opacity && Number(node.style.opacity) < 0.95) window.__homeEntranceObserved = true;
            }
        }).observe(document, { attributes: true, attributeFilter: ['style'], subtree: true });
    });
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => window.__homeEntranceObserved)).toBe(true);
    const menu = page.locator('a[href="/minigame"]');
    await expect(menu).toHaveCSS('opacity', '1');
    const area = page.getByTestId('home-bey-area');
    expect((await area.boundingBox())!.height).toBeLessThanOrEqual(90);
    await expect(page.getByText(/ลากลูกข่างไปเล่นได้ทั่วหน้าจอ|Drag the Beyblades anywhere/)).toHaveCount(0);
    await expect(page.locator('main details')).toHaveCount(0);
    await expect(page.locator('footer summary')).toHaveText('เครดิตโมเดล 3D');
    if (page.viewportSize()!.width < 768) {
        expect((await menu.boundingBox())!.y).toBeLessThan(430);
        const organizer = await page.locator('a[href="/admin"]').boundingBox();
        expect(organizer!.y + organizer!.height).toBeLessThan(page.viewportSize()!.height);
    }
    await expect(page.getByRole('button', { name: 'พักลูกข่าง', exact: true })).toBeEnabled();
    await page.screenshot({ path: info.outputPath('compact-home.png'), scale: 'css' });
    await page.locator('footer summary').click();
    await expect(page.locator('footer a[href*="creativecommons"]')).toBeVisible();
    await menu.click(); await expect(page).toHaveURL(/\/minigame$/);
});

test('compact entrance respects reduced motion and runtime preference changes', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const cards = page.locator('a[data-motion="home"]');
    await expect(cards).toHaveCount(4);
    for (const card of await cards.all()) {
        await expect(card).toHaveCSS('opacity', '1');
        await expect(card).toHaveCSS('transform', 'none');
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(cards.first()).toHaveCSS('opacity', '1');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const card of await cards.all()) await expect(card).toHaveCSS('transform', 'none');
});

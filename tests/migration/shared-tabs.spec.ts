import { test, expect } from '@playwright/test';

for (const status of ['STARTED', 'COMPLETED']) {
    test(`shared ${status}: compact tops, minigame tab and footer-only credits`, async ({ page }, info) => {
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/api/public/tournaments/**', route => {
            const path = new URL(route.request().url()).pathname;
            const body = path.endsWith('/registrations') ? { registrations: [] }
                : path.endsWith('/matches') ? { matches: [], version: 'test' }
                : path.endsWith('/standings') ? { success: true, data: [] }
                : { tournament: { id: 'shared-tab-test', name: 'TEST 3-9', organizer_name: 'TREX-TEST', provider: 'INTERNAL', status, type: 'Open' } };
            return route.fulfill({ json: body });
        });
        await page.route('**/api/realtime/tournaments/**', route => route.fulfill({ contentType: 'text/event-stream', body: 'event: ready\ndata: {}\n\n' }));
        await page.goto('/TREX-TEST/shared-tab-test');
        const nav = page.getByRole('navigation', { name: 'Tournament sections' });
        const game = nav.getByRole('button', { name: /^(มินิเกม|Mini game)$/ });
        await expect(nav.getByRole('button')).toHaveCount(status === 'COMPLETED' ? 4 : 3);
        const area = page.locator('[aria-label="ลูกข่างเล่นบนหน้าแรก"], [aria-label="Beyblade playground"]');
        await expect(area).toBeVisible();
        expect((await area.boundingBox())!.height).toBeLessThanOrEqual(90);
        await expect(page.getByRole('button', { name: /^(พักลูกข่าง|Pause)$/ })).toBeEnabled();
        await expect(page.getByText(/ลากลูกข่างไปเล่นได้ทั่วหน้าจอ|Drag the Beyblades anywhere/)).toHaveCount(0);
        await expect(page.locator('main details')).toHaveCount(0);
        await expect(page.getByRole('button', { name: /^(เข้ามินิเกม|Enter mini game|ปิดมินิเกม|Close mini game)$/ })).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath('shared-compact.png'), scale: 'css' });
        await game.click();
        await expect(game).toHaveAttribute('aria-pressed', 'true');
        await expect(area).toHaveCount(0);
        await expect(page.getByRole('button', { name: /^(เริ่มมินิเกม|Start mini game)$/ })).toBeEnabled();
        await expect(page.locator('main details')).toHaveCount(0);
        await page.screenshot({ path: info.outputPath('shared-game.png'), scale: 'css' });
        await nav.getByRole('button').first().click();
        await expect(game).toHaveAttribute('aria-pressed', 'false');
        await expect(page.getByRole('button', { name: /^(เริ่มมินิเกม|Start mini game)$/ })).toHaveCount(0);
        await expect(area).toBeVisible();
        for (const button of (await nav.getByRole('button').all()).slice(1, -1)) {
            await button.click();
            await expect(button).toHaveAttribute('aria-pressed', 'true');
        }
        await page.locator('footer summary').click();
        await expect(page.locator('footer a[href*="creativecommons"]')).toBeVisible();
        await expect(page.locator('footer a[href*="sketchfab"]')).toHaveCount(2);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(errors).toEqual([]);
    });
}

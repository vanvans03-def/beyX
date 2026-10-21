import { test, expect } from '@playwright/test';

// Opt in to a known public page: this journey never creates or edits tournament data.
const sharedPath = process.env.GCP_UI_SHARED_PATH;
if (sharedPath) {
    if (!sharedPath.startsWith('/') || sharedPath.startsWith('//')) throw new Error('Expected a same-origin shared-page path.');
    test('shared tournament opens and closes the minigame without leaving the bracket', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(sharedPath, { waitUntil: 'domcontentloaded' });
        const open = page.getByRole('button', { name: /^(เข้ามินิเกม|Enter mini game)$/ });
        await expect(open).toBeVisible();
        await expect(open).toHaveAttribute('aria-expanded', 'false');
        await expect(page.getByRole('button', { name: /^(ลาก Drake Brave G|Drag Drake Brave G)$/ })).toBeVisible();
        await open.click();
        const close = page.getByRole('button', { name: /^(ปิดมินิเกม|Close mini game)$/ });
        await expect(close).toHaveAttribute('aria-expanded', 'true');
        await expect(page.getByRole('button', { name: /^(เริ่มมินิเกม|Start mini game)$/ })).toBeEnabled();
        await expect(page.getByRole('button', { name: /^(ลาก Drake Brave G|Drag Drake Brave G)$/ })).toHaveCount(0);
        await close.click();
        await expect(open).toHaveAttribute('aria-expanded', 'false');
        await expect(page.getByRole('button', { name: /^(เริ่มมินิเกม|Start mini game)$/ })).toHaveCount(0);
        await expect(page.getByRole('button', { name: /^(ลาก Drake Brave G|Drag Drake Brave G)$/ })).toBeVisible();
        expect(new URL(page.url()).pathname).toBe(sharedPath);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(errors).toEqual([]);
    });
}

import { test, expect } from '@playwright/test';

test('login compact layout, password visibility, recoverable inline errors and duplicate-submit guard', async ({ page }, info) => {
    await page.addInitScript(() => {
        new MutationObserver(records => {
            if (records.some(record => record.target instanceof HTMLElement && record.target.dataset.motion === 'enter' && record.target.style.transform && record.target.style.transform !== 'none')) document.body.dataset.loginEntranceObserved = 'true';
        }).observe(document, { attributes: true, attributeFilter: ['style'], subtree: true });
    });
    await page.goto('/login');
    await expect(page.locator('body')).toHaveAttribute('data-login-entrance-observed', 'true');
    await expect.poll(() => page.locator('[data-motion="enter"]').evaluateAll(elements => elements.every(element => Number(getComputedStyle(element).opacity) >= 0.99 && getComputedStyle(element).transform === 'none'))).toBe(true);
    const username = page.getByLabel('Username', { exact: true });
    const password = page.getByLabel('Password', { exact: true });
    await username.fill('mock-account'); await password.fill('mock-password');
    await page.getByRole('button', { name: 'Show password', exact: true }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Hide password', exact: true }).click();
    await expect(password).toHaveAttribute('type', 'password');
    let calls = 0;
    let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/auth/login', async route => {
        calls++; await wait;
        await route.fulfill({ status: 401, json: { success: false, error: 'Check username and password' } });
    });
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Signing in...' })).toBeDisabled();
    release();
    await expect(page.locator('#login-error')).toHaveAttribute('role', 'alert');
    await expect(page.locator('#login-error')).toHaveText('Check username and password');
    await expect(password).toBeFocused();
    await expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(calls).toBe(1);
    await password.fill('corrected-password');
    await expect(page.locator('#login-error')).toHaveCount(0);
    const back = page.getByRole('link', { name: 'กลับหน้าแรก / Home' });
    if (page.viewportSize()!.width < 640) expect((await back.boundingBox())!.y).toBeLessThan(40);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeEnabled();
    await page.screenshot({ path: info.outputPath('login-ux.png'), scale: 'css' });
    await back.click(); await expect(page).toHaveURL(/\/$/);
});

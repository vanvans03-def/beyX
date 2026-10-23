import { test, expect, generate, jsonOK } from './support/fixture';

test('responsive UI inventory: all page routes, motion, keyboard and shared game controls', async ({ lab, page }, info) => {
    test.setTimeout(600_000);
    const errors: string[] = [];
    await page.addInitScript(() => {
        new MutationObserver(records => {
            if (records.some(record => record.target instanceof HTMLElement && record.target.hasAttribute('data-motion') && (record.target.style.transform || (record.target.style.opacity && Number(record.target.style.opacity) < 0.95)))) document.body.dataset.entranceObserved = 'true';
        }).observe(document, { attributes: true, attributeFilter: ['style'], subtree: true });
    });
    page.on('pageerror', error => errors.push(`${new URL(page.url()).pathname}: ${error.message}`));
    await page.context().addCookies((await lab.superadmin.api.storageState()).cookies);
    const openId = await lab.tournament();
    const startedId = await lab.tournament('Open', 'DOUBLE');
    await lab.players(startedId, 4); await generate(lab, startedId);
    const routes = ['/', '/login', '/migrate-password', '/events', '/rankings', '/score-board', '/minigame',
        `/register/${openId}`, `/${lab.organizer.shop}/${startedId.replaceAll('-', '').slice(-8)}`, '/admin',
        `/admin/tournament/${startedId}`, '/admin/users', '/admin/users/create', '/admin/beyblades',
        '/admin/players', '/admin/profile/beyblades', '/admin/reset-password'];
    const audit: { route: string; buttons: string[]; links: number; blockedControls: string[] }[] = [];
    for (const [index, route] of routes.entries()) {
        await test.step(`Responsive page ${route}`, async () => {
            const account = route === '/admin' || route.startsWith('/admin/tournament/') || route.startsWith('/admin/profile/') || route === '/admin/reset-password' ? lab.organizer : lab.superadmin;
            await page.context().addCookies((await account.api.storageState()).cookies);
            const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
            expect(response?.status()).toBe(200);
            await expect(page.locator('body')).not.toContainText('Application error');
            await expect(page.getByText('Failed to fetch data.', { exact: true })).toHaveCount(0);
            await expect(page).not.toHaveURL(/\/login\?/) ;
            await expect.poll(() => page.locator('h1, h2, form').count()).toBeGreaterThan(0);
            await page.evaluate(() => document.fonts.ready);
            if (await page.locator('[data-motion]').count()) await expect(page.locator('body')).toHaveAttribute('data-entrance-observed', 'true');
            await expect(page.locator('.animate-spin:visible')).toHaveCount(0);
            await expect(page.getByText('Failed to fetch data.', { exact: true })).toHaveCount(0);
            if (route === '/') await expect(page.getByRole('button', { name: /^(พักลูกข่าง|Pause)$/ })).toBeEnabled();
            if (route.startsWith('/admin/tournament/')) {
                // No audio/provider side effects: trial checks scrolling and hit-testing only.
                await page.getByRole('button', { name: 'เล่นเพลง', exact: true }).click({ trial: true });
                await page.evaluate(() => window.scrollTo(0, 0));
            }
            await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), { message: `Horizontal document overflow: ${route}` }).toBe(true);
            // CSS animations may be disabled in screenshots, but GSAP must settle itself.
            await expect.poll(() => page.locator('[data-motion]').evaluateAll(elements => elements
                .filter(element => { const r = element.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })
                .every(element => Number(getComputedStyle(element).opacity) >= 0.99))).toBe(true);
            const buttons = await page.getByRole('button').allTextContents();
            const blockedControls = await page.locator('button, a[href], input, select, textarea').evaluateAll(elements => elements.filter(element => {
                const closedDetails = element.closest('details:not([open])');
                if (closedDetails && !closedDetails.querySelector('summary')?.contains(element)) return false;
                const box = element.getBoundingClientRect(), style = getComputedStyle(element);
                if (element.matches(':disabled, [type="hidden"]') || style.visibility !== 'visible' || Number(style.opacity) === 0 || box.width < 8 || box.height < 8) return false;
                const x = box.left + box.width / 2, y = box.top + box.height / 2;
                if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) return false;
                return !element.contains(document.elementFromPoint(x, y));
            }).map(element => element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 90) || element.tagName));
            audit.push({ route, buttons: buttons.map(value => value.trim()), links: await page.getByRole('link').count(), blockedControls });
            expect(blockedControls, `Visible controls obscured by another layer: ${route}`).toEqual([]);
            await page.screenshot({ path: info.outputPath(`${String(index).padStart(2, '0')}-page.png`), fullPage: false, scale: 'css', timeout: 60_000 });
        });
    }
    await info.attach('page-control-inventory', { body: JSON.stringify(audit, null, 2), contentType: 'application/json' });

    await page.goto('/login');
    await page.getByLabel('Username', { exact: true }).fill(lab.organizer.username);
    await page.getByLabel('Password', { exact: true }).fill(lab.organizer.password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto(`/${lab.organizer.shop}/${startedId.replaceAll('-', '').slice(-8)}`);
    const enter = page.getByRole('button', { name: /^(มินิเกม|Mini game)$/ });
    await enter.click();
    await expect(page.getByRole('button', { name: /^(เริ่มมินิเกม|Start mini game)$/ })).toBeEnabled();
    await page.getByRole('button', { name: /^(ผู้สมัคร|ผู้เล่น|Players)$/ }).click();
    await expect(enter).toHaveAttribute('aria-pressed', 'false');
    const players = page.getByRole('button', { name: /^(ผู้สมัคร|ผู้เล่น|Players)$/ });
    if (await players.count()) await players.click();
    await expect(page.locator('body')).not.toContainText('Unknown Player');
    // Motion preference can change while the page is already open.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('[data-motion="home"]').first()).toHaveCSS('opacity', '1');
    await page.getByRole('link', { name: /มินิเกม|Mini Game/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/minigame$/);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    const card = page.locator('[data-motion-surface]').first();
    if (info.project.name === 'desktop') {
        await card.hover(); await expect(card).toHaveAttribute('data-motion-hover', 'true');
    }
    expect(errors).toEqual([]);
    // Fixture identity is checked by a real login, not a mock session.
    expect((await jsonOK(await lab.organizer.api.get('/api/admin/profile'))).user.username).toBe(lab.organizer.username);
});

test('calendar month controls do not skip February and locale hydration stays clean', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-01-31T12:00:00Z') });
    await page.goto('/events');
    const next = page.getByRole('button', { name: 'Next month' });
    await expect(next).toBeVisible();
    await next.click();
    await expect(page.locator('h4')).toContainText(/February|กุมภาพันธ์/);
    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(page.locator('h4')).toContainText(/January|มกราคม/);
    expect(errors).toEqual([]);
});

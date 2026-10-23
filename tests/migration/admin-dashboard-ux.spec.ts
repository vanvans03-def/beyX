import { test, expect, jsonOK } from './support/fixture';

test('dashboard groups menus and creates an internal tournament by default', async ({ lab, page }, info) => {
    await page.context().addCookies((await lab.organizer.api.storageState()).cookies);
    await page.goto('/admin');
    const menu = page.getByTestId('admin-menu');
    await expect(menu).not.toHaveAttribute('open');
    await expect(menu.getByRole('navigation', { name: 'Dashboard sections' })).not.toBeVisible();
    await menu.locator(':scope > summary').click();
    await expect(menu.getByRole('navigation', { name: 'Dashboard sections' })).toBeVisible();
    await expect(menu.getByRole('navigation', { name: 'Account tools' })).toBeVisible();
    const settings = menu.locator('details');
    await expect(settings).not.toHaveAttribute('open');
    await settings.locator('summary').click();
    await expect(menu.getByRole('link', { name: 'Change Password' })).toBeVisible();
    await settings.locator('summary').click();
    const system = page.getByLabel('Tournament System', { exact: true });
    await expect(system).toHaveValue('INTERNAL');
    await system.selectOption('CHALLONGE'); await expect(system).toHaveValue('CHALLONGE');
    await system.selectOption('INTERNAL');
    const panel = page.getByTestId('create-tournament-panel');
    if (page.viewportSize()!.width < 640) {
        const rules = (await page.getByLabel('Rules & Points', { exact: true }).boundingBox())!;
        const provider = (await system.boundingBox())!;
        expect(provider.y).toBeGreaterThanOrEqual(rules.y + rules.height);
        expect(provider.width).toBeGreaterThan(280);
    }
    const name = `${lab.tag} Internal default`;
    await page.getByLabel(/ชื่อทัวร์นาเมนต์|Tournament Name/).fill(name);
    const response = page.waitForResponse(res => res.url().endsWith('/api/admin/tournaments') && res.request().method() === 'POST');
    await panel.getByRole('button', { name: /สร้าง|Create/ }).click();
    const created = await jsonOK(await response);
    expect((await lab.db.query('SELECT provider FROM tournaments WHERE id=$1', [created.data.id])).rows[0].provider).toBe('INTERNAL');
    await expect(page.locator('body')).toContainText(name);
    const sections = menu.getByRole('navigation', { name: 'Dashboard sections' });
    await sections.getByRole('button', { name: 'Events', exact: true }).click();
    await expect(sections.getByRole('button', { name: 'Events', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await sections.getByRole('button', { name: 'Tournaments', exact: true }).click();
    await expect(system).toHaveValue('INTERNAL');
    await menu.locator(':scope > summary').click();
    await expect(menu).not.toHaveAttribute('open');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('admin-compact.png'), scale: 'css' });
});

test('dashboard respects disabled internal-bracket permissions', async ({ lab, page }) => {
    await jsonOK(await lab.superadmin.api.patch('/api/admin/users/manage', { data: { userId: lab.organizer.id, internal_bracket_enabled: false } }));
    await page.context().addCookies((await lab.organizer.api.storageState()).cookies);
    await page.goto('/admin');
    const system = page.getByLabel('Tournament System', { exact: true });
    await expect(system).toHaveValue('CHALLONGE');
    await expect(system.locator('option[value="INTERNAL"]')).toBeDisabled();
    // Do not create an external tournament or call Challonge in this permission check.
});

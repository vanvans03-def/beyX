import { test, expect } from '@playwright/test';
import sharp from 'sharp';

test('social crawler receives complete OG tags and public PNG images without JavaScript', async ({ request, baseURL }) => {
    for (const [path, image] of [['/', 'beyx-share-v2.png'], ['/Team-Lungpuk/05fe6661', 'beyx-bracket-v2.png'], ['/register/11111111-1111-4111-8111-111111111111', 'beyx-bracket-v2.png']]) {
        const response = await request.get(path, { headers: { 'user-agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' } });
        expect(response.status()).toBe(200);
        const html = await response.text();
        const head = html.split('</head>')[0];
        for (const property of ['og:title', 'og:description', 'og:type', 'og:url', 'og:image', 'og:image:alt']) expect(head).toContain(`property="${property}"`);
        const ogUrl = head.match(/property="og:url" content="([^"]+)"/)?.[1];
        expect(new URL(ogUrl!).href).toBe(new URL(path, baseURL).href);
        expect(head).toContain(`content="${baseURL}/${image}"`);
        expect(head).toContain('property="og:image:width" content="1200"');
        expect(head).toContain('property="og:image:height" content="630"');
        expect(head).not.toContain('/og-image.jpg');
        const png = await request.get(`/${image}`, { headers: { 'user-agent': 'facebookexternalhit/1.1' } });
        expect(png.status()).toBe(200);
        expect(png.headers()['content-type']).toContain('image/png');
        const buffer = await png.body();
        expect(buffer.length).toBeLessThan(200_000);
        const size = await sharp(buffer).metadata();
        expect([size.width, size.height]).toEqual([1200, 630]);
    }
    for (const path of ['/opengraph-image', '/register/11111111-1111-4111-8111-111111111111/opengraph-image']) {
        const legacy = await request.get(path);
        expect(legacy.status()).toBe(200);
        expect(legacy.headers()['content-type']).toContain('image/png');
    }
});

test('social homepage has no Facebook share button and the Bey area has no frame', async ({ page }, info) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeAttached();
    await expect(page.locator('a[href*="facebook.com/sharer"]')).toHaveCount(0);
    const area = page.getByTestId('home-bey-area');
    await expect(area).toBeVisible();
    const style = await area.evaluate(element => {
        const css = getComputedStyle(element);
        return [css.borderTopWidth, css.borderRightWidth, css.borderBottomWidth, css.borderLeftWidth, css.backgroundColor];
    });
    expect(style).toEqual(['0px', '0px', '0px', '0px', 'rgba(0, 0, 0, 0)']);
    await expect(page.locator('canvas')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('home-no-frame.png'), scale: 'css' });
});

test('social public bracket has no Facebook share button at every viewport', async ({ page }, info) => {
    const path = '/Team-%E0%B8%97%E0%B8%94%E0%B8%AA%E0%B8%AD%E0%B8%9A/05fe6661';
    await page.route('**/api/public/tournaments/**', route => route.fulfill({ json: route.request().url().includes('/registrations') ? { registrations: [] } : { tournament: { id: '11111111-1111-4111-8111-111111111111', name: 'BeyX Weekly Cup', status: 'OPEN', type: 'Open', provider: 'INTERNAL', organizer_name: 'Team ทดสอบ' } } }));
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'BeyX Weekly Cup' })).toBeVisible();
    await expect(page.locator('a[href*="facebook.com/sharer"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('social-bracket.png'), scale: 'css' });
});

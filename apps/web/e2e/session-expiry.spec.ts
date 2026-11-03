import { expect, test } from '@playwright/test';
import { webUrl } from './support/stack';

const COOKIE = 'sg_session';

async function sessionCookie(page: import('@playwright/test').Page) {
    return (await page.context().cookies()).find((c) => c.name === COOKIE);
}

test('a rejected token ends on /login with the cookie cleared and no redirect loop', async ({
    page,
}) => {
    await page
        .context()
        .addCookies([{ name: COOKIE, value: 'garbage', url: webUrl, httpOnly: true }]);
    await page.goto('/groups');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
    expect(await sessionCookie(page)).toBeUndefined();
});

test('opening the old expiry URL or the expiry page never signs a valid session out', async ({
    page,
}) => {
    const email = `e2e-exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

    await page.goto('/register');
    await page.getByLabel('Nome', { exact: true }).fill('Ana');
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByLabel('Senha', { exact: true }).fill('senha-e2e-123');
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/groups$/);
    const before = await sessionCookie(page);

    expect(before?.value).toBeTruthy();

    // Top-level GET navigations, as a link from another site would cause.
    const old = await page.goto('/api/auth/expired');

    expect(old?.status()).toBe(404);
    expect((await sessionCookie(page))?.value).toBe(before?.value);

    await page.goto('/session-expired');
    await expect(page).toHaveURL(/\/groups$/);
    expect((await sessionCookie(page))?.value).toBe(before?.value);

    // A cross-origin POST to logout is refused and keeps the session.
    const forged = await page.request.post('/api/auth/logout', {
        headers: { origin: 'https://evil.example' },
        maxRedirects: 0,
    });

    expect(forged.status()).toBe(403);
    expect((await sessionCookie(page))?.value).toBe(before?.value);
});

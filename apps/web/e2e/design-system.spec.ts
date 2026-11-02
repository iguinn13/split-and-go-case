import { expect, test, type Page } from '@playwright/test';

/**
 * Keyboard and layout behaviour of the design system foundation (issue #52), checked against the
 * real built app: skip link, visible focus ring, keyboard order and the 4-tab bar at 360 px.
 */
const RING = 'rgb(11, 122, 84)'; // --ring in globals.css

async function focusedText(page: Page) {
  return page.evaluate(() => document.activeElement?.textContent?.trim());
}

test('skip link is the first tab stop and moves focus to the main content', async ({ page }) => {
  await page.goto('/login');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Pular para o conteúdo' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#conteudo')).toBeFocused();
});

test('keyboard order on the login form shows a visible focus ring', async ({ page }) => {
  await page.goto('/login');
  const email = page.getByLabel('E-mail', { exact: true });
  const password = page.getByLabel('Senha', { exact: true });
  const submit = page.getByRole('button', { name: 'Entrar' });
  await email.focus();
  await expect(email).toHaveCSS('outline-color', RING);
  await expect(email).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Tab');
  await expect(password).toBeFocused();
  await expect(password).toHaveCSS('outline-color', RING);
  await page.keyboard.press('Tab');
  await expect(submit).toBeFocused();
  await expect(submit).toHaveCSS('outline-color', RING);
});

test('group tabs fit in 360 px and are reachable by keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const email = `ds-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Nome', { exact: true }).fill('Ana');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('senha-e2e-123');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/groups$/);
  await page.getByRole('link', { name: 'Criar grupo' }).first().click();
  await page.getByLabel('Nome do grupo').fill('Layout');
  await page.getByLabel('Nome do participante 1', { exact: true }).fill('Bruno');
  await page.getByRole('button', { name: 'Criar grupo' }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);

  const tabs = page.getByRole('navigation', { name: 'Seções do grupo' });
  const links = tabs.getByRole('link');
  await expect(links).toHaveCount(4);
  // Every tab is fully visible: no horizontal scroll, no clipped label, no page overflow.
  const overflow = await page.evaluate(() => {
    const list = document.querySelector('nav[aria-label="Seções do grupo"] ul')!;
    return {
      listScrolls: list.scrollWidth > list.clientWidth,
      page: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  expect(overflow).toEqual({ listScrolls: false, page: false });
  for (const link of await links.all()) await expect(link).toBeInViewport({ ratio: 1 });

  await links.first().focus();
  for (const name of ['Saldos', 'Participantes', 'Quitação']) {
    await page.keyboard.press('Tab');
    expect(await focusedText(page)).toBe(name);
  }
  await page.keyboard.press('Enter');
  await expect(links.last()).toHaveAttribute('aria-current', 'page');
});

test('logged-in layout has no horizontal overflow at 320 px or with 200% text', async ({
  page,
}) => {
  const email = `ds-ov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/register');
  await page.getByLabel('Nome', { exact: true }).fill('Ana');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('senha-e2e-123');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/groups$/);
  const overflows = () =>
    page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

  expect(await overflows()).toBe(false);
  // "Sair" stays reachable by its accessible name even when only the icon is visible.
  await expect(page.getByRole('button', { name: 'Sair' })).toBeInViewport({ ratio: 1 });

  await page.setViewportSize({ width: 360, height: 700 });
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  expect(await overflows()).toBe(false);
  await expect(page.getByRole('button', { name: 'Sair' })).toBeInViewport({ ratio: 1 });
});

test('active tab keeps a non-colour cue in forced-colors mode', async ({ page }) => {
  const email = `ds-fc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/register');
  await page.getByLabel('Nome', { exact: true }).fill('Ana');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('senha-e2e-123');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/groups$/);
  await page.getByRole('link', { name: 'Criar grupo' }).first().click();
  await page.getByLabel('Nome do grupo').fill('Contraste');
  await page.getByLabel('Nome do participante 1', { exact: true }).fill('Bruno');
  await page.getByRole('button', { name: 'Criar grupo' }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
  const tabs = page.getByRole('navigation', { name: 'Seções do grupo' }).getByRole('link');
  await expect(page.locator('[aria-current="page"]')).toHaveCSS(
    'text-decoration-line',
    'underline',
  );
  await expect(tabs.first()).toHaveCSS('text-decoration-line', 'none');
});

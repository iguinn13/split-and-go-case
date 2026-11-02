import { expect, test, type Page } from '@playwright/test';

/**
 * Redesigned group detail, expenses list and expense form (issue #54) at 360 px, the narrowest
 * supported width: summary, tabs without clipping, dense list, pagination, a very long unbroken
 * member name and the double-submit guard.
 */
test.use({ viewport: { width: 360, height: 800 } });

const LONG_NAME = 'Maximiliano'.repeat(8); // 88 characters without any break opportunity

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function setupGroup(page: Page) {
  const email = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Nome', { exact: true }).fill('Ana Souza');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('senha-e2e-123');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/groups$/);
  await page.getByRole('link', { name: 'Criar grupo' }).first().click();
  await page.getByLabel('Nome do grupo').fill('Viagem');
  await page.getByLabel('Nome do participante 1', { exact: true }).fill(LONG_NAME);
  await page.getByRole('button', { name: 'Criar grupo' }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
  return /\/groups\/([0-9a-f-]{36})/.exec(page.url())![1]!;
}

test('group summary, tabs, dense list, pagination and long names fit in 360 px', async ({
  page,
}) => {
  const groupId = await setupGroup(page);

  // Summary: base currency, status and total (zero without expenses).
  const summary = page.getByRole('region', { name: 'Resumo do grupo' });
  await expect(summary).toContainText('Moeda-base');
  await expect(summary.getByText('Aberto', { exact: true })).toBeVisible();
  await expect(page.getByTestId('group-total')).toHaveText(/^R\$\s0,00$/);
  await expectNoHorizontalOverflow(page);

  // All four tabs are fully visible, Quitação included.
  const tabs = page.getByRole('navigation', { name: 'Seções do grupo' });
  for (const name of ['Despesas', 'Saldos', 'Participantes', 'Quitação']) {
    await expect(tabs.getByRole('link', { name })).toBeInViewport({ ratio: 1 });
  }

  // Empty state of the list, with the call to create.
  await tabs.getByRole('link', { name: 'Despesas' }).click();
  await expect(page.getByRole('heading', { name: 'Nenhuma despesa lançada' })).toBeVisible();

  // Form with the long unbroken member name: no horizontal overflow.
  await page.getByRole('link', { name: 'Nova despesa' }).first().click();
  await expect(page.getByLabel('Descrição')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const fieldsetOverflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll('fieldset')).some((f) => f.scrollWidth > f.clientWidth),
  );
  expect(fieldsetOverflow).toBe(false);

  // Double submit: two fast clicks create exactly one expense.
  const memberId = await page.getByLabel('Pago por').inputValue();
  await page.getByLabel('Descrição').fill('Gasolina');
  await page.getByLabel('Valor (BRL)', { exact: true }).fill('45,50');
  const save = page.getByRole('button', { name: 'Salvar' });
  await save.dblclick();
  await expect(page).toHaveURL(/\?tab=expenses$/);
  const list = page.getByRole('list', { name: 'Despesas do grupo' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list).toContainText('Gasolina');
  await expect(list).toContainText(/R\$\s45,50/);
  await expect(page.getByTestId('group-total')).toHaveText(/^R\$\s45,50$/);
  await expectNoHorizontalOverflow(page);

  // Pagination: 20 per page, so 22 expenses make two pages.
  for (let i = 0; i < 21; i += 1) {
    const response = await page.request.post(`/api/groups/${groupId}/expenses`, {
      data: {
        description: `Item ${i + 1}`,
        currency: 'BRL',
        originalAmountMinor: 1000,
        paidByMemberId: memberId,
        occurredOn: '2026-07-10',
        split: { type: 'EQUAL', participantIds: [memberId] },
      },
    });
    expect(response.ok()).toBe(true);
  }
  await page.goto(`/groups/${groupId}?tab=expenses`);
  await expect(page.getByText('Página 1 de 2')).toBeVisible();
  await expect(page.getByTestId('group-total')).toHaveText(/^R\$\s255,50$/);
  await page.getByRole('link', { name: 'Próxima' }).click();
  await expect(page.getByText('Página 2 de 2')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

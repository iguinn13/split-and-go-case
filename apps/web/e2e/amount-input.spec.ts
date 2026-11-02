import { expect, test, type Page } from '@playwright/test';

/**
 * Form wiring of the amount field (issue #51): the raw text is parsed with the SELECTED
 * currency on every render, invalid text disables Save and shows a visible, announced message,
 * and the ambiguous "1.234" shape says how it was read.
 */
async function openNewExpense(page: Page) {
  const email = `amount-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Nome', { exact: true }).fill('Ana');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('senha-e2e-123');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/groups$/);
  await page.getByRole('link', { name: 'Criar grupo' }).first().click();
  await page.getByLabel('Nome do grupo').fill('Valores');
  await page.getByLabel('Nome do participante 1', { exact: true }).fill('Bruno');
  await page.getByRole('button', { name: 'Criar grupo' }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
  await page.getByRole('link', { name: 'Despesas' }).click();
  await page.getByRole('link', { name: 'Nova despesa' }).click();
  await page.getByLabel('Descrição').fill('Teste de valor');
}

test('amount field: warning, hint, save state and re-parse on currency switch', async ({
  page,
}) => {
  await openNewExpense(page);
  const amount = page.getByLabel(/^Valor \(/);
  const save = page.getByRole('button', { name: 'Salvar' });
  const preview = page.getByTestId('amount-formatted');
  const hint = page.getByTestId('amount-hint');
  const alert = page.locator('#expense-amount-error');

  // Valid text typed key by key: preview, no warning, Save enabled; the preview is linked.
  await amount.pressSequentially('1.234,56');
  await expect(preview).toHaveText(/^R\$\s1\.234,56$/);
  await expect(alert).toHaveCount(0);
  await expect(hint).toHaveCount(0);
  await expect(save).toBeEnabled();
  await expect(amount).toHaveAttribute('aria-describedby', /expense-amount-preview/);

  // The ambiguous shape is read as thousands and says so.
  await amount.fill('');
  await amount.pressSequentially('1.234');
  await expect(preview).toHaveText(/^R\$\s1\.234,00$/);
  await expect(hint).toContainText(/Lido como R\$\s1\.234,00/);
  await expect(save).toBeEnabled();
  await amount.fill('12.345');
  await expect(hint).toContainText(/Lido como R\$\s12\.345,00/);
  await amount.fill('1,5');
  await expect(preview).toHaveText(/^R\$\s1,50$/);
  await expect(hint).toHaveCount(0);

  // Invalid text: visible, announced warning; no stale value; Save disabled.
  await amount.fill('1,234');
  await expect(preview).toBeVisible();
  await amount.fill('1,2345');
  await expect(page.getByRole('alert').filter({ hasText: 'no máximo 2 casas' })).toBeVisible();
  await expect(amount).toHaveAttribute('aria-invalid', 'true');
  await expect(amount).toHaveAttribute('aria-describedby', /expense-amount-error/);
  await expect(preview).toHaveCount(0);
  await expect(save).toBeDisabled();
  await amount.fill('12 50');
  await expect(page.getByRole('alert').filter({ hasText: 'Espaço no meio' })).toBeVisible();
  await expect(save).toBeDisabled();
  await amount.fill('US$ 10');
  await expect(page.getByRole('alert').filter({ hasText: 'Este campo é em BRL' })).toBeVisible();
  await expect(save).toBeDisabled();

  // Currency switch re-reads the same text with the new decimals: BRL -> JPY -> USD.
  await amount.fill('10,50');
  await expect(preview).toHaveText(/^R\$\s10,50$/);
  await page.getByLabel('Moeda', { exact: true }).selectOption('JPY');
  await expect(page.getByRole('alert').filter({ hasText: 'não tem casas decimais' })).toBeVisible();
  await expect(preview).toHaveCount(0);
  await expect(save).toBeDisabled();
  await page.getByLabel('Moeda', { exact: true }).selectOption('USD');
  await expect(alert).toHaveCount(0);
  await expect(preview).toHaveText(/^US\$\s10,50$/);
  await page.getByLabel('Moeda', { exact: true }).selectOption('JPY');
  await amount.fill('1.234');
  await expect(preview).toHaveText(/^JP¥\s1\.234$/);
  await expect(hint).toHaveCount(0);
});

test('percentage fields: percentage-specific warnings', async ({ page }) => {
  await openNewExpense(page);
  await page.getByLabel(/^Valor \(/).fill('100');
  await page.getByRole('radio', { name: 'Por porcentagem' }).check();
  const share = page.getByLabel('Porcentagem de Ana (%)', { exact: true });
  await share.fill('33,333');
  await expect(
    page.getByRole('alert').filter({ hasText: 'A porcentagem aceita no máximo 2 casas' }),
  ).toBeVisible();
  await share.fill('1.000');
  await expect(
    page.getByRole('alert').filter({ hasText: 'A porcentagem aceita no máximo 2 casas' }),
  ).toBeVisible();
  await share.fill('50%');
  await expect(page.locator('[id^="expense-share-"][id$="-error"]')).toHaveCount(0);
});

import { expect, test, type Page } from '@playwright/test';

/**
 * Redesigned auth and groups screens (issue #53): friendly errors, empty state, live validation,
 * summary cards, member avatars and the MEMBER_HAS_EXPENSES message. Runs at 360 px, the
 * narrowest supported width.
 */
test.use({ viewport: { width: 360, height: 800 } });

async function register(page: Page) {
  const email = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Nome', { exact: true }).fill('Ana Souza');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('senha-e2e-123');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/groups$/);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test('login shows a friendly pt-BR error and live field validation', async ({ page }) => {
  await page.goto('/login');
  await expectNoHorizontalOverflow(page);
  const email = page.getByLabel('E-mail', { exact: true });
  await email.fill('nao-e-email');
  await email.blur();
  await expect(page.getByText('Erro:').first()).toBeVisible();

  await email.fill('ninguem@example.com');
  await page.getByLabel('Senha', { exact: true }).fill('senha-errada-1');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Erro:' })).toContainText(
    'E-mail ou senha incorretos.',
  );
});

test('groups: empty state, live validation, summary card and member removal rules', async ({
  page,
}) => {
  await register(page);

  // Empty state with a call to create.
  await expect(page.getByRole('heading', { name: 'Você ainda não tem grupos' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole('link', { name: 'Criar grupo' }).first().click();

  // Live validation: the error shows on blur, before any submit attempt.
  const groupName = page.getByLabel('Nome do grupo');
  await groupName.fill('A');
  await groupName.blur();
  await expect(page.getByText('O nome deve ter pelo menos 2 caracteres.')).toBeVisible();
  await groupName.fill('Churrasco');
  await expect(page.getByText('O nome deve ter pelo menos 2 caracteres.')).toBeHidden();

  await page.getByLabel('Nome do participante 1', { exact: true }).fill('Bruno Lima');
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Criar grupo' }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);

  // Members: owner badge (text, not only color) and one row per person.
  const members = page.getByRole('list', { name: 'Participantes do grupo' });
  await expect(members.getByRole('listitem')).toHaveCount(2);
  await expect(members.getByText('Dono')).toBeVisible();
  await expect(members.getByRole('listitem').filter({ hasText: 'Bruno Lima' })).toBeVisible();

  // An expense paid by Bruno blocks removing him, with a friendly message.
  await page
    .getByRole('navigation', { name: 'Seções do grupo' })
    .getByRole('link', { name: 'Despesas' })
    .click();
  await page.getByRole('link', { name: 'Nova despesa' }).click();
  await page.getByLabel('Descrição').fill('Carvão');
  await page.getByLabel('Valor (BRL)', { exact: true }).fill('30,00');
  await page.getByLabel('Pago por').selectOption({ label: 'Bruno Lima' });
  await page.getByRole('button', { name: 'Salvar' }).last().click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}(\?tab=expenses)?$/);
  await page
    .getByRole('navigation', { name: 'Seções do grupo' })
    .getByRole('link', { name: 'Participantes' })
    .click();
  await page.getByRole('button', { name: 'Remover Bruno Lima' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Erro:' })).toContainText(
    'já participa de despesas',
  );

  // Back to the list: the group is a summary card.
  await page.goto('/groups');
  const card = page.getByRole('link', { name: /Churrasco/ });
  await expect(card).toContainText('Moeda: BRL');
  await expect(card).toContainText('2 participantes');
  await expect(card).toContainText('Aberto');
  await expectNoHorizontalOverflow(page);
});

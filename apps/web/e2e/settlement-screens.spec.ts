import { expect, test, type Page } from '@playwright/test';

/**
 * Redesigned balances, statement and settlement screens (issue #55) at 360 px: highlighted own
 * balance, statement rows, closing dialog, status indicators, keyboard focus and screen reader
 * announcements after closing the group or paying a transfer.
 */
test.use({ viewport: { width: 360, height: 800 } });

async function expectNoHorizontalOverflow(page: Page) {
    const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    expect(overflow).toBeLessThanOrEqual(0);
}

const activeTestId = (page: Page) =>
    page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null);

async function setup(page: Page) {
    const email = `settle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

    await page.goto('/register');
    await page.getByLabel('Nome', { exact: true }).fill('Ana Souza');
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByLabel('Senha', { exact: true }).fill('senha-e2e-123');
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/groups$/);
    await page.getByRole('link', { name: 'Criar grupo' }).first().click();
    await page.getByLabel('Nome do grupo').fill('Acerto');
    await page.getByLabel('Nome do participante 1', { exact: true }).fill('Bruno');
    await page.getByRole('button', { name: 'Adicionar participante' }).click();
    await page.getByLabel('Nome do participante 2', { exact: true }).fill('Carla');
    await page.getByRole('button', { name: 'Criar grupo' }).click();
    await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
    const groupId = /\/groups\/([0-9a-f-]{36})/.exec(page.url())![1]!;

    // Ana pays 90,00 split equally: Bruno and Carla owe 30,00 each to Ana.
    await page.goto(`/groups/${groupId}?tab=balances`);
    const href = await page
        .getByRole('list', { name: 'Saldos dos participantes' })
        .getByRole('listitem')
        .filter({ hasText: 'Ana Souza' })
        .getByRole('link')
        .getAttribute('href');
    const anaId = /\/members\/([0-9a-f-]{36})$/.exec(href ?? '')![1]!;
    const ids = await page
        .getByRole('list', { name: 'Saldos dos participantes' })
        .getByRole('link')
        .evaluateAll((links) =>
            links.map((l) => /\/members\/([0-9a-f-]{36})$/.exec(l.getAttribute('href') ?? '')![1]!),
        );
    const response = await page.request.post(`/api/groups/${groupId}/expenses`, {
        data: {
            description: 'Jantar',
            currency: 'BRL',
            originalAmountMinor: 9000,
            paidByMemberId: anaId,
            occurredOn: '2026-07-10',
            split: { type: 'EQUAL', participantIds: ids },
        },
    });

    expect(response.ok()).toBe(true);

    return groupId;
}

test('balances highlight, statement rows, closing and paying keep focus and announce', async ({
    page,
}) => {
    const groupId = await setup(page);

    // --- Balances: own highlight and card per participant, no overflow ----------------------
    await page.goto(`/groups/${groupId}?tab=balances`);
    const mine = page.getByTestId('my-balance');

    await expect(mine).toContainText(/Você recebe\s*R\$\s60,00/);
    const list = page.getByRole('list', { name: 'Saldos dos participantes' });

    await expect(list.getByRole('listitem').filter({ hasText: 'Bruno' })).toContainText(
        /− deve\s*R\$\s30,00/,
    );
    await expectNoHorizontalOverflow(page);

    // --- Statement ------------------------------------------------------------------------
    await list.getByRole('listitem').filter({ hasText: 'Bruno' }).getByRole('link').click();
    await expect(page.getByRole('heading', { name: 'Extrato de Bruno' })).toBeVisible();
    const row = page.getByRole('list', { name: 'Linhas do extrato' }).getByRole('listitem');

    await expect(row).toContainText('Jantar');
    await expect(row).toContainText(/Saldo acumulado\s*-R\$\s30,00/);
    await expectNoHorizontalOverflow(page);

    // --- Settlement (open): plan sentences, close dialog ---------------------------------
    await page.goto(`/groups/${groupId}?tab=settlement`);
    const transfers = page.getByRole('list', { name: 'Plano de quitação' }).getByRole('listitem');

    await expect(transfers).toHaveCount(2);
    await expect(transfers.filter({ hasText: 'Bruno paga' })).toContainText(
        /R\$\s30,00 para Ana Souza/,
    );
    await expectNoHorizontalOverflow(page);

    const closeButton = page.getByRole('button', { name: 'Fechar grupo', exact: true });

    await closeButton.click();
    const dialog = page.getByRole('dialog', { name: 'Fechar este grupo?' });

    await expect(dialog).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // Escape cancels and focus goes back to the trigger.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(closeButton).toBeFocused();

    await closeButton.click();
    await dialog.getByRole('button', { name: 'Fechar grupo definitivamente' }).click();

    // After closing: focus on the summary, announcement, status indicators with text.
    await expect(page.getByTestId('paid-summary')).toHaveText('0 de 2 pagas');
    await expect(page.getByTestId('settlement-summary')).toBeFocused();
    await expect(page.getByTestId('settlement-announcement')).toHaveText(
        'Grupo fechado. O plano de quitação está fixo. 0 de 2 pagas.',
    );
    await expect(transfers.first()).toContainText('Pendente');
    await expectNoHorizontalOverflow(page);

    // --- Pay: a failure keeps the button usable and shows an error with focus returned ----
    const payBruno = page.getByRole('button', { name: /^Marcar como paga: Bruno paga/ });

    await page.route('**/api/groups/*/transfers/*/pay', (route) =>
        route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ code: 'INTERNAL_ERROR', message: 'Erro inesperado.' }),
        }),
    );
    await payBruno.click();
    await expect(page.getByRole('alert').filter({ hasText: 'Erro:' })).toBeVisible();
    await expect(payBruno).toBeFocused();
    await page.unroute('**/api/groups/*/transfers/*/pay');

    // --- Pay: success moves focus to the summary and announces it -----------------------
    await payBruno.click();
    await expect(page.getByTestId('paid-summary')).toHaveText('1 de 2 pagas');
    await expect(page.getByTestId('settlement-summary')).toBeFocused();
    await expect(page.getByTestId('settlement-announcement')).toContainText(
        /Transferência marcada como paga: Bruno paga R\$\s30,00 para Ana Souza\. 1 de 2 pagas\./,
    );
    await expect(transfers.filter({ hasText: 'Bruno paga' })).toContainText('Paga');
    await expect(transfers.filter({ hasText: 'Carla paga' })).toContainText('Pendente');
    expect(await activeTestId(page)).toBe('settlement-summary');
    await expectNoHorizontalOverflow(page);
});

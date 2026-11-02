import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  allocate,
  convertSameDecimals,
  moneyPattern,
  settle,
  type Weighted,
} from './support/expected';

/**
 * Happy path of the whole product through the UI (docs/engineering/testing-strategy.md):
 * register -> group with 3 participants -> EQUAL / PERCENTAGE / FIXED / foreign-currency
 * expenses -> balances -> settlement plan -> closing.
 *
 * Expectations are computed here from the scenario inputs with BigInt (see support/expected.ts).
 * Member ids are random UUIDs and the extra cent goes to the lowest id, so ids are read from the
 * statement links on the balances tab and fed to the reference allocation.
 */

const NAMES = ['Ana', 'Bruno', 'Carla'] as const;
type Name = (typeof NAMES)[number];

const SUGGESTED_RATE = '5.4321'; // returned by e2e/fx-stub/server.mjs
const EDITED_RATE = '5.5';

const re = (source: string) => new RegExp(source);

async function expectMoney(locator: Locator, minor: bigint, symbol?: string) {
  await expect(locator).toContainText(re(moneyPattern(minor, symbol)));
}

async function openTab(page: Page, label: string) {
  const tab = page
    .getByRole('navigation', { name: 'Seções do grupo' })
    .getByRole('link', { name: label });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-current', 'page');
}

/** Reads name -> member id from the "Ver extrato" links of the balances tab. */
async function readMemberIds(page: Page): Promise<Record<Name, string>> {
  await openTab(page, 'Saldos');
  const list = page.getByRole('list', { name: 'Saldos dos participantes' });
  await expect(list.getByRole('listitem')).toHaveCount(NAMES.length);
  const ids = {} as Record<Name, string>;
  for (const name of NAMES) {
    const href = await list
      .getByRole('listitem')
      .filter({ hasText: name })
      .getByRole('link')
      .getAttribute('href');
    const id = /\/members\/([0-9a-f-]{36})$/.exec(href ?? '')?.[1];
    expect(id, `member id of ${name}`).toBeTruthy();
    ids[name] = id!;
  }
  return ids;
}

interface ExpenseInput {
  description: string;
  amount: string; // as typed, pt-BR
  payer: Name;
  split:
    | { type: 'EQUAL' }
    | { type: 'PERCENTAGE'; values: Record<Name, string> }
    | { type: 'FIXED'; values: Record<Name, string> };
}

async function fillSplit(page: Page, input: ExpenseInput['split'], currency: string) {
  if (input.type === 'EQUAL') return;
  const radio = input.type === 'PERCENTAGE' ? 'Por porcentagem' : 'Por valor fixo';
  await page.getByRole('radio', { name: radio }).check();
  for (const name of NAMES) {
    const label =
      input.type === 'PERCENTAGE' ? `Porcentagem de ${name} (%)` : `Valor de ${name} (${currency})`;
    await page.getByLabel(label, { exact: true }).fill(input.values[name]);
  }
}

test('happy path: register, group, expenses, balances, settlement and closing', async ({
  page,
}) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = 'senha-e2e-123';

  // --- Register -------------------------------------------------------------------------
  await page.goto('/register');
  await page.getByLabel('Nome', { exact: true }).fill('Ana');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/groups$/);
  await expect(page.getByRole('heading', { name: 'Seus grupos' })).toBeVisible();

  // --- Group with 3 participants (owner + 2) ----------------------------------------------
  await page.getByRole('link', { name: 'Criar grupo' }).first().click();
  await expect(page).toHaveURL(/\/groups\/new$/);
  await page.getByLabel('Nome do grupo').fill('Viagem E2E');
  await expect(page.getByLabel('Moeda-base')).toHaveValue('BRL');
  await page.getByLabel('Nome do participante 1', { exact: true }).fill('Bruno');
  await page.getByRole('button', { name: 'Adicionar participante' }).click();
  await page.getByLabel('Nome do participante 2', { exact: true }).fill('Carla');
  await page.getByRole('button', { name: 'Criar grupo' }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
  const groupId = /\/groups\/([0-9a-f-]{36})/.exec(page.url())![1]!;
  await expect(page.getByRole('heading', { name: 'Viagem E2E' })).toBeVisible();
  await expect(page.getByText('Moeda-base: BRL · Aberto')).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Participantes do grupo' }).getByRole('listitem'),
  ).toHaveCount(3);

  const ids = await readMemberIds(page);
  const everyone = (weight: (name: Name) => bigint): Weighted[] =>
    NAMES.map((name) => ({ id: ids[name], weight: weight(name) }));

  // Running totals, in BRL minor units, built only from the scenario inputs.
  const paid = new Map<Name, bigint>(NAMES.map((n) => [n, 0n]));
  const owed = new Map<Name, bigint>(NAMES.map((n) => [n, 0n]));
  const expenseRows: { description: string; totalMinor: bigint; foreign?: string }[] = [];

  async function addExpense(
    input: ExpenseInput,
    options: {
      currency?: string;
      originalMinor: bigint;
      weights: Weighted[];
      convertedMinor: bigint;
    },
  ) {
    await openTab(page, 'Despesas');
    await page.getByRole('link', { name: 'Nova despesa' }).click();
    await expect(page).toHaveURL(re(`/groups/${groupId}/expenses/new$`));

    const currency = options.currency ?? 'BRL';
    await page.getByLabel('Descrição').fill(input.description);
    if (currency !== 'BRL') {
      await page.getByLabel('Moeda', { exact: true }).selectOption(currency);
    }
    await page.getByLabel(`Valor (${currency})`, { exact: true }).fill(input.amount);
    await page.getByLabel('Pago por').selectOption({ label: input.payer });

    if (currency !== 'BRL') {
      // Suggestion comes from the stub provider, prefilled, then edited by the user.
      const rate = page.getByLabel(`Taxa de câmbio (1 ${currency} em BRL)`, { exact: true });
      await expect(rate).toHaveValue(SUGGESTED_RATE.replace('.', ','));
      await expect(
        page.getByText(/Taxa sugerida \(frankfurter\) em \d{2}\/\d{2}\/\d{4}/),
      ).toBeVisible();
      await expectMoney(
        page.getByTestId('converted-total'),
        convertSameDecimals(options.originalMinor, SUGGESTED_RATE),
      );
      await rate.fill(EDITED_RATE.replace('.', ','));
      await expect(rate).toHaveValue(EDITED_RATE.replace('.', ','));
    }
    await fillSplit(page, input.split, currency);

    // On-screen split preview must match the reference allocation (in BRL).
    const converted = options.convertedMinor;
    if (currency !== 'BRL') {
      await expectMoney(page.getByTestId('converted-total'), converted);
    }
    const shares = allocate(converted, options.weights);
    for (const name of NAMES) {
      await expectMoney(page.getByTestId(`share-${ids[name]}`), shares.get(ids[name])!);
    }
    await expect(
      page.getByRole('status').filter({ hasText: 'Rateio completo: 3 participante(s)' }),
    ).toContainText(re(moneyPattern(converted)));

    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page).toHaveURL(/\?tab=expenses$/);
    const item = page
      .getByRole('list', { name: 'Despesas do grupo' })
      .getByRole('listitem')
      .filter({
        hasText: input.description,
      });
    await expect(item).toHaveCount(1);
    await expectMoney(item, converted);
    if (currency !== 'BRL') {
      await expect(item).toContainText(
        re(
          `${moneyPattern(options.originalMinor, 'US\\$')}\\s*·\\s*taxa ${EDITED_RATE.replace('.', ',')}\\s*·\\s*${moneyPattern(converted)}`,
        ),
      );
    }

    paid.set(input.payer, paid.get(input.payer)! + converted);
    for (const name of NAMES) owed.set(name, owed.get(name)! + shares.get(ids[name])!);
    expenseRows.push({ description: input.description, totalMinor: converted });
  }

  // --- 1. EQUAL: R$ 100,00 / 3 leaves one extra cent (lowest member id) ----------------------
  await addExpense(
    { description: 'Jantar', amount: '100,00', payer: 'Ana', split: { type: 'EQUAL' } },
    { originalMinor: 10000n, convertedMinor: 10000n, weights: everyone(() => 1n) },
  );

  // --- 2. PERCENTAGE: R$ 10,01 at 50/30/20 --------------------------------------------------
  const pct = { Ana: 5000n, Bruno: 3000n, Carla: 2000n } as const;
  await addExpense(
    {
      description: 'Mercado',
      amount: '10,01',
      payer: 'Bruno',
      split: { type: 'PERCENTAGE', values: { Ana: '50', Bruno: '30', Carla: '20' } },
    },
    { originalMinor: 1001n, convertedMinor: 1001n, weights: everyone((n) => pct[n]) },
  );

  // --- 3. FIXED: R$ 60,00 as 10 + 20 + 30 ---------------------------------------------------
  const fixed = { Ana: 1000n, Bruno: 2000n, Carla: 3000n } as const;
  await addExpense(
    {
      description: 'Passeio',
      amount: '60,00',
      payer: 'Carla',
      split: { type: 'FIXED', values: { Ana: '10,00', Bruno: '20,00', Carla: '30,00' } },
    },
    { originalMinor: 6000n, convertedMinor: 6000n, weights: everyone((n) => fixed[n]) },
  );

  // --- 4. Foreign currency: US$ 100,00, suggested rate edited from 5,4321 to 5,5 -------------
  await addExpense(
    { description: 'Hotel', amount: '100,00', payer: 'Ana', split: { type: 'EQUAL' } },
    {
      currency: 'USD',
      originalMinor: 10000n,
      convertedMinor: convertSameDecimals(10000n, EDITED_RATE),
      weights: everyone(() => 1n),
    },
  );
  expect(convertSameDecimals(10000n, EDITED_RATE)).toBe(55000n);
  await expect(
    page.getByRole('list', { name: 'Despesas do grupo' }).getByRole('listitem'),
  ).toHaveCount(expenseRows.length);

  // --- Balances ---------------------------------------------------------------------------
  await openTab(page, 'Saldos');
  const balances = page
    .getByRole('list', { name: 'Saldos dos participantes' })
    .getByRole('listitem');
  const net = new Map<string, bigint>();
  for (const name of NAMES) {
    const netMinor = paid.get(name)! - owed.get(name)!;
    net.set(ids[name], netMinor);
    const row = balances.filter({ hasText: name });
    await expect(row).toContainText(
      re(`Pagou ${moneyPattern(paid.get(name)!)}\\s*·\\s*Parte ${moneyPattern(owed.get(name)!)}`),
    );
    const magnitude = netMinor < 0n ? -netMinor : netMinor;
    const status = netMinor > 0n ? '\\+ recebe' : netMinor < 0n ? '− deve' : '✓ quitado';
    await expect(row).toContainText(
      re(`${status}\\s*${netMinor === 0n ? '' : moneyPattern(magnitude)}`),
    );
  }
  expect([...net.values()].reduce((a, b) => a + b, 0n)).toBe(0n);

  // --- Settlement plan ---------------------------------------------------------------------
  const nameOf = (id: string) => NAMES.find((n) => ids[n] === id)!;
  const plan = settle(net);
  await openTab(page, 'Quitação');
  const transfers = page.getByRole('list', { name: 'Plano de quitação' }).getByRole('listitem');
  await expect(
    page.getByText(plan.length === 1 ? '1 transferência' : `${plan.length} transferências`, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/^Total movimentado:/)).toContainText(
    re(moneyPattern(plan.reduce((acc, t) => acc + t.amount, 0n))),
  );
  await expect(transfers).toHaveCount(plan.length);
  for (const t of plan) {
    await expect(
      transfers.filter({
        hasText: re(`${nameOf(t.from)} paga ${moneyPattern(t.amount)} para ${nameOf(t.to)}`),
      }),
    ).toHaveCount(1);
  }

  // --- Closing -----------------------------------------------------------------------------
  await page.getByRole('button', { name: 'Fechar grupo', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Fechar este grupo?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Fechar grupo definitivamente' }).click();

  await expect(page.getByText('Moeda-base: BRL · Fechado')).toBeVisible();
  await expect(page.getByText('Aviso: este grupo está fechado.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fechar grupo', exact: true })).toHaveCount(0);
  await expect(page.getByText(`0 de ${plan.length} pagas`)).toBeVisible();
  await expect(transfers).toHaveCount(plan.length);
  for (const t of plan) {
    const row = transfers.filter({
      hasText: re(`${nameOf(t.from)} paga ${moneyPattern(t.amount)} para ${nameOf(t.to)}`),
    });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Pendente');
  }

  // The frozen plan and the balances are unchanged after closing.
  await openTab(page, 'Saldos');
  for (const name of NAMES) {
    await expect(balances.filter({ hasText: name })).toContainText(
      re(`Pagou ${moneyPattern(paid.get(name)!)}\\s*·\\s*Parte ${moneyPattern(owed.get(name)!)}`),
    );
  }

  // --- Statements show "original · rate · converted" on every foreign-currency line (RF-UI-12) --
  const hotel = convertSameDecimals(10000n, EDITED_RATE);
  const hotelLine = re(
    `${moneyPattern(10000n, 'US\\$')}\\s*·\\s*taxa ${EDITED_RATE.replace('.', ',')}\\s*·\\s*${moneyPattern(hotel)}`,
  );
  // Ana paid the hotel; Bruno and Carla did not, yet their lines carry the converted total too.
  for (const name of NAMES) {
    await page.goto(`/groups/${groupId}/members/${ids[name]}`);
    await expect(page.getByRole('heading', { name: `Extrato de ${name}` })).toBeVisible();
    const lines = page.getByRole('list', { name: 'Linhas do extrato' }).getByRole('listitem');
    await expect(lines).toHaveCount(expenseRows.length);
    await expect(lines.filter({ hasText: 'Hotel' })).toContainText(hotelLine);
    // Base-currency lines show no conversion.
    await expect(lines.filter({ hasText: 'Jantar' })).not.toContainText('taxa');
  }

  // --- The groups list shows the base currency straight from the list endpoint -------------------
  await page.goto('/groups');
  await expect(
    page.getByRole('link', { name: /Viagem E2E/ }).getByText(/Moeda: BRL · 3 participantes/),
  ).toBeVisible();
});

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { serverApi } from '@/lib/api/server';
import StatementPage from './page';

vi.mock('@/lib/api/server', () => ({ serverApi: vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const GROUP = '3f0c1f4e-6f0c-4b0e-8d57-0d1c9b2a7e11';
const MEMBER = '8a2b7c1d-1b3e-4c9f-a6d2-5e4f3a2b1c00';
const flat = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ');

const render = async () =>
  renderToStaticMarkup(
    await StatementPage({ params: Promise.resolve({ id: GROUP, memberId: MEMBER }) }),
  );

const statement = {
  currency: 'BRL',
  member: { id: MEMBER, name: 'Bruno' },
  totals: { paidMinor: 0, owedMinor: 28162, netMinor: -28162 },
  lines: [
    {
      expenseId: 'e1',
      description: 'Jantar',
      occurredOn: '2026-07-10',
      original: null,
      amountMinor: 9000,
      paidMinor: 0,
      owedMinor: 3000,
      netMinor: -3000,
      runningBalanceMinor: -3000,
    },
    {
      expenseId: 'e2',
      description: 'Hotel',
      occurredOn: '2026-07-11',
      original: { currency: 'USD', amountMinor: 10000, exchangeRate: '5.50000000' },
      amountMinor: 55000,
      paidMinor: 0,
      owedMinor: 25162,
      netMinor: -25162,
      runningBalanceMinor: -28162,
    },
  ],
};

describe('StatementPage', () => {
  beforeEach(() => {
    vi.mocked(serverApi).mockReset();
  });

  it('shows an error state with a retry link on API failures', async () => {
    vi.mocked(serverApi).mockImplementation(() => {
      throw new ApiError(500, 'INTERNAL_ERROR', 'boom');
    });
    const out = await render();
    expect(out).toContain('Não foi possível carregar o extrato');
    expect(out).toContain(`href="/groups/${GROUP}/members/${MEMBER}"`);
  });

  it('turns a 404 into the not-found page', async () => {
    vi.mocked(serverApi).mockImplementation(() => {
      throw new ApiError(404, 'MEMBER_NOT_FOUND', 'nope');
    });
    await expect(render()).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('shows the empty state for a participant without lines', async () => {
    vi.mocked(serverApi).mockResolvedValue({
      ...statement,
      totals: { paidMinor: 0, owedMinor: 0, netMinor: 0 },
      lines: [],
    });
    expect(await render()).toContain('Nenhuma despesa neste extrato');
  });

  it('shows rows with running balance and the conversion on every foreign line', async () => {
    vi.mocked(serverApi).mockResolvedValue(statement);
    const out = await render();
    const text = flat(out);
    expect(out).toContain('Extrato de Bruno');
    expect(text).toMatch(/− deve R\$ 281,62/);
    expect(text).toMatch(/Saldo acumulado -R\$ 30,00/);
    expect(text).toMatch(/US\$ 100,00 · taxa 5,5 · R\$ 550,00/);
    // The base-currency line carries no conversion.
    expect(text.match(/taxa/g)).toHaveLength(1);
    expect(out).toContain('href="/groups/' + GROUP + '?tab=balances"');
  });
});

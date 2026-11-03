import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { serverApi } from '@/lib/api/server';
import type { SettlementPlan, TransferView } from '@/lib/settlement/types';
import { SettlementPanel } from './settlement-panel';

vi.mock('@/lib/api/server', () => ({ serverApi: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const flat = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ');

const transfer = (
  id: string | null,
  from: string,
  to: string,
  amountMinor: number,
  status: TransferView['status'],
): TransferView => ({
  id,
  from: { memberId: `m-${from}`, name: from },
  to: { memberId: `m-${to}`, name: to },
  amountMinor,
  status,
  paidAt: null,
});

const plan = (overrides: Partial<SettlementPlan>): SettlementPlan => ({
  groupId: 'g1',
  currency: 'BRL',
  status: 'OPEN',
  transferCount: 0,
  totalMovedMinor: 0,
  transfers: [],
  ...overrides,
});

const render = async (isOwner = true) =>
  renderToStaticMarkup(await SettlementPanel({ groupId: 'g1', isOwner }));

describe('SettlementPanel', () => {
  beforeEach(() => {
    vi.mocked(serverApi).mockReset();
  });

  it('shows an error state with a retry link back to the settlement tab', async () => {
    vi.mocked(serverApi).mockImplementation(() => {
      throw new ApiError(500, 'INTERNAL_ERROR', 'boom');
    });
    const out = await render();
    expect(out).toContain('role="alert"');
    expect(out).toContain('Não foi possível carregar a quitação');
    expect(out).toMatch(/<a [^>]*href="\/groups\/g1\?tab=settlement"[^>]*>Tentar novamente<\/a>/);
  });

  it('says nobody owes anything when the plan is empty', async () => {
    vi.mocked(serverApi).mockResolvedValue(plan({}));
    const out = await render();
    expect(out).toContain('Tudo certo! Ninguém deve nada.');
    expect(out).not.toContain('aria-label="Plano de quitação"');
  });

  it('open group: sentences, count and total, no status or pay buttons, owner can close', async () => {
    vi.mocked(serverApi).mockResolvedValue(
      plan({
        transferCount: 2,
        totalMovedMinor: 6500,
        transfers: [
          transfer(null, 'Duda', 'Ana', 5000, null),
          transfer(null, 'Bruno', 'Ana', 1500, null),
        ],
      }),
    );
    const out = await render();
    const text = flat(out);
    expect(text).toContain('Duda paga R$ 50,00 para Ana');
    expect(text).toContain('Bruno paga R$ 15,00 para Ana');
    expect(text).toContain('2 transferências');
    expect(text).toContain('Total movimentado: R$ 65,00');
    expect(out).not.toContain('Marcar como paga');
    expect(out).not.toContain('pagas');
    expect(out).toContain('Fechar grupo');
  });

  it('open group: a non-owner is told only the owner can close', async () => {
    vi.mocked(serverApi).mockResolvedValue(plan({}));
    const out = await render(false);
    expect(out).toContain('Somente o dono do grupo pode fechá-lo.');
    expect(out).not.toContain('Fechar grupo');
  });

  it('closed group: "x de y pagas", status with text, pay button only on pending', async () => {
    vi.mocked(serverApi).mockResolvedValue(
      plan({
        status: 'CLOSED',
        transferCount: 2,
        totalMovedMinor: 6500,
        transfers: [
          transfer('t1', 'Duda', 'Ana', 5000, 'PAID'),
          transfer('t2', 'Bruno', 'Ana', 1500, 'PENDING'),
        ],
      }),
    );
    const out = await render();
    const text = flat(out);
    expect(text).toContain('1 de 2 pagas');
    expect(text).toContain('Paga');
    expect(text).toContain('Pendente');
    expect(out.match(/Marcar como paga/g)).toHaveLength(2); // visible label + aria-label of one button
    expect(out).toContain('aria-label="Marcar como paga: Bruno paga');
    expect(out).not.toContain('aria-label="Marcar como paga: Duda');
    expect(out).not.toContain('Fechar grupo');
    expect(out).toContain('width:50%');
    // Focus target and live region used after closing or paying.
    expect(out).toContain('tabindex="-1"');
    expect(out).toContain('role="status"');
  });
});

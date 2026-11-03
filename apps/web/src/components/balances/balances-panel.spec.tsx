import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { serverApi } from '@/lib/api/server';
import { BalancesPanel } from './balances-panel';

vi.mock('@/lib/api/server', () => ({ serverApi: vi.fn() }));

const flat = (html: string) =>
    html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\u00a0/g, ' ');

const balances = {
    currency: 'BRL',
    balances: [
        { memberId: 'm1', name: 'Ana', paidMinor: 9000, owedMinor: 3000, netMinor: 6000 },
        { memberId: 'm2', name: 'Bruno', paidMinor: 0, owedMinor: 4500, netMinor: -4500 },
        { memberId: 'm3', name: 'Carla', paidMinor: 0, owedMinor: 1500, netMinor: -1500 },
    ],
};

const render = async (currentMemberId?: string) =>
    renderToStaticMarkup(await BalancesPanel({ groupId: 'g1', currentMemberId }));

describe('BalancesPanel', () => {
    beforeEach(() => {
        vi.mocked(serverApi).mockReset();
    });

    it('shows an error state with a retry link back to the balances tab', async () => {
        vi.mocked(serverApi).mockImplementation(() => {
            throw new ApiError(500, 'INTERNAL_ERROR', 'boom');
        });
        const out = await render();

        expect(out).toContain('role="alert"');
        expect(out).toContain('Não foi possível carregar os saldos');
        expect(out).toMatch(/<a [^>]*href="\/groups\/g1\?tab=balances"[^>]*>Tentar novamente<\/a>/);
        expect(out).not.toContain('boom');
    });

    it('shows the empty state without participants', async () => {
        vi.mocked(serverApi).mockResolvedValue({ currency: 'BRL', balances: [] });
        expect(await render()).toContain('Nenhum participante');
    });

    it('explains that everyone is settled when there are no expenses', async () => {
        vi.mocked(serverApi).mockResolvedValue({
            currency: 'BRL',
            balances: [{ memberId: 'm1', name: 'Ana', paidMinor: 0, owedMinor: 0, netMinor: 0 }],
        });
        const out = await render();

        expect(out).toContain('Ainda não há despesas lançadas');
        expect(flat(out)).toContain('✓ quitado');
    });

    it('labels each card with sign, text and amount, and links to the statement', async () => {
        vi.mocked(serverApi).mockResolvedValue(balances);
        const out = await render();
        const text = flat(out);

        expect(text).toMatch(/\+ recebe R\$ 60,00/);
        expect(text).toMatch(/− deve R\$ 45,00/);
        expect(text).toMatch(/− deve R\$ 15,00/);
        expect(out).toContain('href="/groups/g1/members/m2"');
        expect(out).toContain('Ver extrato');
        expect(out).not.toContain('data-testid="my-balance"');
    });

    it('highlights "Você recebe" for the signed-in participant', async () => {
        vi.mocked(serverApi).mockResolvedValue(balances);
        const out = await render('m1');

        expect(out).toContain('data-testid="my-balance"');
        expect(flat(out)).toMatch(/\+ Você recebe R\$ 60,00/);
        expect(out).toContain('Ver meu extrato');
    });

    it('highlights "Você deve" and "Você está quitado"', async () => {
        vi.mocked(serverApi).mockResolvedValue({
            currency: 'BRL',
            balances: [
                ...balances.balances,
                { ...balances.balances[0]!, memberId: 'm4', netMinor: 0 },
            ],
        });
        expect(flat(await render('m2'))).toMatch(/− Você deve R\$ 45,00/);
        const settled = flat(await render('m4'));

        expect(settled).toContain('✓ Você está quitado');
        expect(settled).not.toMatch(/Você está quitado R\$/);
    });

    it('formats zero-decimal base currencies without decimals', async () => {
        vi.mocked(serverApi).mockResolvedValue({
            currency: 'JPY',
            balances: [
                { memberId: 'm1', name: 'Ana', paidMinor: 5000, owedMinor: 2500, netMinor: 2500 },
            ],
        });
        expect(flat(await render())).toMatch(/\+ recebe JP¥ 2\.500/);
    });
});

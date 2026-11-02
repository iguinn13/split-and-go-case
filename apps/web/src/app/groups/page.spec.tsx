import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { serverApi } from '@/lib/api/server';
import GroupsPage from './page';

vi.mock('@/lib/api/server', () => ({ serverApi: vi.fn() }));

const render = async () => renderToStaticMarkup(await GroupsPage());

describe('GroupsPage', () => {
  beforeEach(() => {
    // Braces on purpose: a returned mock would be run by Vitest as a teardown hook.
    vi.mocked(serverApi).mockReset();
  });

  it('shows the error state with a retry link when the API fails', async () => {
    vi.mocked(serverApi).mockImplementation(() => {
      throw new ApiError(500, 'INTERNAL_ERROR', 'boom');
    });
    const out = await render();
    expect(out).toContain('role="alert"');
    expect(out).toContain('Não foi possível carregar seus grupos');
    expect(out).toMatch(/<a [^>]*href="\/groups"[^>]*>Tentar novamente<\/a>/);
  });

  it('shows the empty state with a create call to action', async () => {
    vi.mocked(serverApi).mockResolvedValue([]);
    const out = await render();
    expect(out).toContain('Você ainda não tem grupos');
    expect(out).toContain('href="/groups/new"');
  });

  it('renders one summary card per group', async () => {
    vi.mocked(serverApi).mockResolvedValue([
      {
        id: 'g1',
        name: 'Viagem',
        baseCurrency: 'BRL',
        status: 'OPEN',
        memberCount: 3,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const out = await render();
    expect(out).toContain('Viagem');
    expect(out).toContain('Moeda: BRL');
    expect(out).toContain('3 participantes');
    expect(out).toContain('Aberto');
  });
});

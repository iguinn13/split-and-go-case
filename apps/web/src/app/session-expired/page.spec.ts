import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock('@/lib/auth/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/session')>()),
  getSessionToken: () => Promise.resolve(session.token),
}));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

import { ExpiredSessionForm } from '@/components/auth/expired-session-form';
import SessionExpiredPage from './page';

const fetchMock = vi.fn();

beforeEach(() => {
  process.env['API_URL'] = 'http://api.internal:3001';
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const apiError = (status: number, code: string) =>
  new Response(JSON.stringify({ statusCode: status, code, message: 'internal detail' }), {
    status,
  });

/** Collects the element types of a React tree, to look for the sign-out form. */
function hasType(node: unknown, type: unknown): boolean {
  if (!node || typeof node !== 'object') return false;
  const element = node as { type?: unknown; props?: { children?: unknown } };
  if (element.type === type) return true;
  const children = element.props?.children;
  return (Array.isArray(children) ? children : [children]).some((child) => hasType(child, type));
}

describe('session-expired page', () => {
  it('sends visitors without a cookie to /login without calling the API', async () => {
    session.token = undefined;
    await expect(SessionExpiredPage()).rejects.toThrow('REDIRECT:/login');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('offers the sign-out form only when the API rejects the token (401)', async () => {
    session.token = 'garbage';
    fetchMock.mockResolvedValue(apiError(401, 'UNAUTHORIZED'));
    const page = await SessionExpiredPage();
    expect(hasType(page, ExpiredSessionForm)).toBe(true);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(
      'http://api.internal:3001/auth/me',
    );
  });

  it('never signs out a valid session: it goes to /groups instead (external links are harmless)', async () => {
    session.token = 'valid';
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 'u', name: 'Ana', email: 'a@b.co' }), { status: 200 }),
    );
    await expect(SessionExpiredPage()).rejects.toThrow('REDIRECT:/groups');
  });

  it('keeps the cookie and shows an error when the API is down', async () => {
    session.token = 'valid';
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const page = await SessionExpiredPage();
    expect(hasType(page, ExpiredSessionForm)).toBe(false);
  });
});

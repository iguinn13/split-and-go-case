import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ token: undefined as string | undefined }));

vi.mock('@/lib/auth/session', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/auth/session')>()),
    getSessionToken: () => Promise.resolve(session.token),
}));

import { POST as login } from './auth/login/route';
import { POST as logout } from './auth/logout/route';
import { POST as register } from './auth/register/route';
import { GET as exchangeRates } from './exchange-rates/route';
import { POST as createGroup } from './groups/route';
import { POST as closeGroup } from './groups/[id]/close/route';
import { POST as createExpense } from './groups/[id]/expenses/route';
import {
    DELETE as deleteExpense,
    PUT as updateExpense,
} from './groups/[id]/expenses/[expenseId]/route';
import { POST as addMember } from './groups/[id]/members/route';
import { DELETE as removeMember } from './groups/[id]/members/[memberId]/route';
import { PATCH as payTransfer } from './groups/[id]/transfers/[transferId]/pay/route';

const ID = '0b0f3a4e-7c1d-4f43-8f6a-3c1d2e4f5a6b';
const ID2 = '5d0f3a4e-7c1d-4f43-8f6a-3c1d2e4f5a6c';
const HOST = 'app.example:3000';
const ORIGIN = `http://${HOST}`;

type Handler = (
    request: Request,
    context: { params: Promise<Record<string, string>> },
) => Promise<Response> | Response;

interface Case {
    name: string;
    handler: Handler;
    method: string;
    /** Route params (UUIDs) the handler validates. */
    params: Record<string, string>;
    body?: unknown;
    /** Handlers without a body skip the Content-Type rule. */
    hasBody: boolean;
    needsSession: boolean;
    /** What the mocked API answers on success and the expected handler status. */
    apiOk: unknown;
    okStatus: number;
}

const expensePayload = {
    description: 'Jantar',
    currency: 'BRL',
    originalAmountMinor: 1000,
    paidByMemberId: ID,
    occurredOn: '2026-07-10',
    split: { type: 'EQUAL', participantIds: [ID, ID2] },
};

const cases: Case[] = [
    {
        name: 'login',
        handler: login,
        method: 'POST',
        params: {},
        hasBody: true,
        needsSession: false,
        body: { email: 'a@b.co', password: 'senha-forte-1' },
        apiOk: { accessToken: 'jwt', user: { id: ID, name: 'Ana', email: 'a@b.co' } },
        okStatus: 200,
    },
    {
        name: 'register',
        handler: register,
        method: 'POST',
        params: {},
        hasBody: true,
        needsSession: false,
        body: { name: 'Ana', email: 'a@b.co', password: 'senha-forte-1' },
        apiOk: { accessToken: 'jwt', user: { id: ID, name: 'Ana', email: 'a@b.co' } },
        okStatus: 201,
    },
    {
        name: 'logout',
        handler: logout,
        method: 'POST',
        params: {},
        hasBody: false,
        needsSession: false,
        apiOk: null,
        okStatus: 303,
    },
    {
        name: 'create group',
        handler: createGroup,
        method: 'POST',
        params: {},
        hasBody: true,
        needsSession: true,
        body: { name: 'Viagem', description: '', baseCurrency: 'BRL', members: [] },
        apiOk: { id: ID },
        okStatus: 201,
    },
    {
        name: 'add member',
        handler: addMember as unknown as Handler,
        method: 'POST',
        params: { id: ID },
        hasBody: true,
        needsSession: true,
        body: { name: 'Bruno', email: '' },
        apiOk: { id: ID2, name: 'Bruno' },
        okStatus: 201,
    },
    {
        name: 'remove member',
        handler: removeMember as unknown as Handler,
        method: 'DELETE',
        params: { id: ID, memberId: ID2 },
        hasBody: false,
        needsSession: true,
        apiOk: null,
        okStatus: 204,
    },
    {
        name: 'create expense',
        handler: createExpense as unknown as Handler,
        method: 'POST',
        params: { id: ID },
        hasBody: true,
        needsSession: true,
        body: expensePayload,
        apiOk: { id: ID2 },
        okStatus: 201,
    },
    {
        name: 'update expense',
        handler: updateExpense as unknown as Handler,
        method: 'PUT',
        params: { id: ID, expenseId: ID2 },
        hasBody: true,
        needsSession: true,
        body: expensePayload,
        apiOk: { id: ID2 },
        okStatus: 200,
    },
    {
        name: 'delete expense',
        handler: deleteExpense as unknown as Handler,
        method: 'DELETE',
        params: { id: ID, expenseId: ID2 },
        hasBody: false,
        needsSession: true,
        apiOk: null,
        okStatus: 204,
    },
    {
        name: 'close group',
        handler: closeGroup as unknown as Handler,
        method: 'POST',
        params: { id: ID },
        hasBody: false,
        needsSession: true,
        apiOk: { transfers: [] },
        okStatus: 200,
    },
    {
        name: 'pay transfer',
        handler: payTransfer as unknown as Handler,
        method: 'PATCH',
        params: { id: ID, transferId: ID2 },
        hasBody: false,
        needsSession: true,
        apiOk: { id: ID2 },
        okStatus: 200,
    },
];

/** Builds a request; a header set to `null` is removed (for example a header-less client). */
function build(c: Case, overrides: Record<string, string | null> = {}) {
    const headers = new Headers({ host: HOST, origin: ORIGIN });

    if (c.hasBody) headers.set('content-type', 'application/json');

    for (const [name, value] of Object.entries(overrides)) {
        if (value === null) headers.delete(name);
        else headers.set(name, value);
    }

    return new Request(`http://${HOST}/api/x`, {
        method: c.method,
        headers,
        ...(c.hasBody ? { body: JSON.stringify(c.body) } : {}),
    });
}

const call = (c: Case, request: Request, params = c.params) =>
    Promise.resolve(c.handler(request, { params: Promise.resolve(params) }));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    process.env['API_URL'] = 'http://api.internal:3001';
    session.token = 'jwt-token';
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

const okApi = (c: Case) => apiResponse(c.okStatus === 204 ? 204 : 200, c.apiOk);

const apiResponse = (status: number, body: unknown) =>
    new Response(body === null ? null : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });

describe.each(cases)('$name handler', (c) => {
    it('rejects a foreign Origin with 403 before touching the API', async () => {
        const res = await call(c, build(c, { origin: 'https://evil.example' }));

        expect(res.status).toBe(403);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects a malformed Origin with 403', async () => {
        const res = await call(c, build(c, { origin: 'not a url' }));

        expect(res.status).toBe(403);
    });

    if (c.hasBody) {
        it('rejects a non-JSON Content-Type with 415', async () => {
            const res = await call(c, build(c, { 'content-type': 'text/plain' }));

            expect(res.status).toBe(415);
            expect(fetchMock).not.toHaveBeenCalled();
        });
    } else {
        it('does not require a Content-Type', async () => {
            fetchMock.mockImplementation(() => okApi(c));
            const res = await call(c, build(c, { 'content-type': 'text/plain' }));

            expect(res.status).toBe(c.okStatus);
        });
    }

    if (c.needsSession) {
        it('answers 401 without a session cookie', async () => {
            session.token = undefined;
            const res = await call(c, build(c));

            expect(res.status).toBe(401);
            expect(fetchMock).not.toHaveBeenCalled();
        });
    }

    for (const key of Object.keys(c.params)) {
        it(`answers 422 for a malformed ${key} without calling the API`, async () => {
            const res = await call(c, build(c), { ...c.params, [key]: '../members' });

            expect(res.status).toBe(422);
            expect(await res.json()).toEqual({
                code: 'VALIDATION_ERROR',
                message: 'Verifique os dados informados.',
            });
            expect(fetchMock).not.toHaveBeenCalled();
        });
    }

    it('works on the happy path (same-origin and header-less clients)', async () => {
        for (const headers of [{}, { origin: null }] as Record<string, string | null>[]) {
            fetchMock.mockImplementation(() => okApi(c));
            const res = await call(c, build(c, headers));

            expect(res.status).toBe(c.okStatus);
        }
    });

    if (c.needsSession || c.name === 'login' || c.name === 'register') {
        it('maps API failures to a pt-BR message without leaking internals', async () => {
            fetchMock.mockResolvedValue(
                apiResponse(500, {
                    statusCode: 500,
                    code: 'INTERNAL_ERROR',
                    message: 'PrismaClientKnownRequestError at /srv/api/secret.ts',
                }),
            );
            const res = await call(c, build(c));

            expect(res.status).toBe(500);
            const text = await res.text();

            expect(text).not.toMatch(/prisma|secret|\/srv/i);
            expect(JSON.parse(text)).toEqual({
                code: 'INTERNAL_ERROR',
                message: 'Erro inesperado. Tente novamente em instantes.',
            });
        });
    }
});

describe('cookie handling', () => {
    const loginCase = cases[0]!;
    const logoutCase = cases[2]!;

    it('login sets the httpOnly session cookie and never returns the token', async () => {
        fetchMock.mockResolvedValue(apiResponse(200, loginCase.apiOk));
        const res = await call(loginCase, build(loginCase));

        expect(res.headers.get('set-cookie')).toMatch(/sg_session=jwt;.*HttpOnly/i);
        expect(JSON.stringify(await res.json())).not.toContain('jwt');
    });

    it('a rejected login (foreign Origin) sets no cookie', async () => {
        const res = await call(loginCase, build(loginCase, { origin: 'https://evil.example' }));

        expect(res.headers.get('set-cookie')).toBeNull();
    });

    it('logout clears the cookie and redirects to /login with a relative Location', async () => {
        const res = await call(logoutCase, build(logoutCase));

        expect(res.status).toBe(303);
        expect(res.headers.get('location')).toBe('/login');
        expect(res.headers.get('set-cookie')).toMatch(/sg_session=;.*(Max-Age=0|Expires=)/i);
    });

    it('a cross-site logout keeps the cookie', async () => {
        const res = await call(logoutCase, build(logoutCase, { origin: 'https://evil.example' }));

        expect(res.status).toBe(403);
        expect(res.headers.get('set-cookie')).toBeNull();
    });
});

describe('Origin null (Referrer-Policy: no-referrer)', () => {
    const logoutCase = cases[2]!;
    const post = (headers: Record<string, string | null>) =>
        call(logoutCase, build(logoutCase, headers));

    it('lets a same-origin form post through and clears the cookie', async () => {
        const res = await post({ origin: 'null', 'sec-fetch-site': 'same-origin' });

        expect(res.status).toBe(303);
        expect(res.headers.get('set-cookie')).toMatch(/sg_session=;/);
    });

    it('keeps refusing Origin null from any other context', async () => {
        for (const site of ['cross-site', 'same-site', 'none', null]) {
            const res = await post({ origin: 'null', 'sec-fetch-site': site });

            expect(res.status).toBe(403);
            expect(res.headers.get('set-cookie')).toBeNull();
        }
    });

    it('refuses a foreign Origin regardless of Sec-Fetch-Site', async () => {
        const res = await post({ origin: 'https://evil.example', 'sec-fetch-site': 'same-origin' });

        expect(res.status).toBe(403);
    });
});

describe('Origin behind a proxy', () => {
    const c = cases[3]!;

    it('ignores X-Forwarded-Host unless the proxy is declared as trusted', async () => {
        const forged = build(c, {
            origin: 'https://evil.example',
            'x-forwarded-host': 'evil.example',
        });

        expect((await call(c, forged)).status).toBe(403);
    });

    it('uses X-Forwarded-Host when WEB_TRUST_FORWARDED_HOST=1', async () => {
        vi.stubEnv('WEB_TRUST_FORWARDED_HOST', '1');
        fetchMock.mockResolvedValue(apiResponse(201, { id: ID }));
        const viaProxy = build(c, {
            host: 'web:3000',
            origin: 'https://splitgo.example',
            'x-forwarded-host': 'splitgo.example',
        });

        expect((await call(c, viaProxy)).status).toBe(201);
    });
});

describe('exchange-rates proxy (GET)', () => {
    const get = (query: string, headers: Record<string, string> = {}) =>
        exchangeRates(new Request(`http://${HOST}/api/exchange-rates?${query}`, { headers }));

    it('answers 401 without a session', async () => {
        session.token = undefined;
        expect((await get('from=USD&to=BRL')).status).toBe(401);
    });

    it('refuses cross-site browser requests', async () => {
        const res = await get('from=USD&to=BRL', { 'sec-fetch-site': 'cross-site' });

        expect(res.status).toBe(403);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('answers 422 for an invalid query without calling the API', async () => {
        for (const q of ['from=USD', 'from=USD&to=XXX', 'from=USD&to=BRL&date=ontem', '']) {
            expect((await get(q)).status).toBe(422);
        }

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('proxies a valid query with the token and same-origin requests', async () => {
        fetchMock.mockResolvedValue(
            apiResponse(200, { rate: '5.43', source: 'x', date: '2026-07-10' }),
        );
        const res = await get('from=USD&to=BRL&date=2026-07-10', {
            'sec-fetch-site': 'same-origin',
        });

        expect(res.status).toBe(200);
        const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];

        expect(String(url)).toBe(
            'http://api.internal:3001/exchange-rates?from=USD&to=BRL&date=2026-07-10',
        );
        expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer jwt-token');
    });

    it('maps API failures without leaking internals', async () => {
        fetchMock.mockResolvedValue(
            apiResponse(503, {
                statusCode: 503,
                code: 'EXCHANGE_RATE_UNAVAILABLE',
                message: 'frankfurter 502 at host',
            }),
        );
        const res = await get('from=USD&to=BRL');

        expect(res.status).toBe(503);
        expect(JSON.stringify(await res.json())).not.toContain('frankfurter');
    });
});

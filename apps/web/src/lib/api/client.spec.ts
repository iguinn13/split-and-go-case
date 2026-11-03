import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './client';
import { ApiError } from './errors';

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('apiFetch', () => {
    beforeEach(() => {
        vi.stubEnv('API_URL', 'http://api.test/');
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('sends the bearer token and parses JSON', async () => {
        const fetchMock = vi.fn().mockResolvedValue(json(200, { status: 'ok' }));

        vi.stubGlobal('fetch', fetchMock);
        const result = await apiFetch<{ status: string }>('/health', {
            token: 'abc',
            query: { page: 1 },
        });

        expect(result).toEqual({ status: 'ok' });
        const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];

        expect(url.toString()).toBe('http://api.test/health?page=1');
        expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer abc');
    });

    it('converts contract errors into ApiError', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                json(422, {
                    statusCode: 422,
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid request data',
                    details: [{ path: 'name', message: 'Required' }],
                }),
            ),
        );
        const error = await apiFetch('/groups', { method: 'POST', body: {} }).catch(
            (e: unknown) => e,
        );

        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({
            statusCode: 422,
            code: 'VALIDATION_ERROR',
            details: [{ path: 'name' }],
        });
    });

    it('maps network failures to NETWORK_ERROR', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fail')));
        await expect(apiFetch('/x')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    });
});

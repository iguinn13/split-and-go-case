import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeExchangeRateProvider } from '../../../test/support/fake-exchange-rate.provider.js';
import { AppError } from '../../common/errors/app-error.js';
import type { ExchangeRateProvider, ProviderRate } from './exchange-rate-provider.js';
import {
    CACHE_MAX_ENTRIES,
    CACHE_TTL_MS,
    GetExchangeRateUseCase,
} from './get-exchange-rate.use-case.js';

describe('GetExchangeRateUseCase', () => {
    let provider: FakeExchangeRateProvider;
    let useCase: GetExchangeRateUseCase;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-10T12:00:00Z'));
        provider = new FakeExchangeRateProvider();
        useCase = new GetExchangeRateUseCase(provider);
    });
    afterEach(() => vi.useRealTimers());

    it('returns the provider rate', async () => {
        const out = await useCase.execute({ from: 'USD', to: 'BRL', date: '2026-07-10' });

        expect(out).toEqual({
            from: 'USD',
            to: 'BRL',
            rate: '5.4325',
            date: '2026-07-10',
            source: 'fake',
        });
    });

    it('returns "1" for the same currency without calling the provider', async () => {
        const out = await useCase.execute({ from: 'EUR', to: 'EUR' });

        expect(out.rate).toBe('1');
        expect(out.date).toBe('2026-07-10');
        expect(provider.calls).toHaveLength(0);
    });

    it('defaults date to today when asking the provider', async () => {
        const out = await useCase.execute({ from: 'USD', to: 'BRL' });

        expect(out.date).toBe('2026-07-10');
        expect(provider.calls[0]?.date).toBeNull();
    });

    it('caches by pair and date for 1 hour', async () => {
        await useCase.execute({ from: 'USD', to: 'BRL', date: '2026-07-10' });
        await useCase.execute({ from: 'USD', to: 'BRL', date: '2026-07-10' });
        expect(provider.calls).toHaveLength(1);
        await useCase.execute({ from: 'USD', to: 'BRL', date: '2026-07-09' });
        expect(provider.calls).toHaveLength(2);
        vi.advanceTimersByTime(CACHE_TTL_MS - 1);
        await useCase.execute({ from: 'USD', to: 'BRL', date: '2026-07-10' });
        expect(provider.calls).toHaveLength(2);
        vi.advanceTimersByTime(2);
        await useCase.execute({ from: 'USD', to: 'BRL', date: '2026-07-10' });
        expect(provider.calls).toHaveLength(3);
    });

    it('maps failures to 503 EXCHANGE_RATE_UNAVAILABLE without leaking details and does not cache them', async () => {
        provider.failing = true;
        const error = await useCase
            .execute({ from: 'USD', to: 'BRL', date: '2026-07-10' })
            .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('EXCHANGE_RATE_UNAVAILABLE');
        expect((error as AppError).statusCode).toBe(503);
        expect((error as AppError).message).not.toContain('secret');
        provider.failing = false;
        await expect(
            useCase.execute({ from: 'USD', to: 'BRL', date: '2026-07-10' }),
        ).resolves.toMatchObject({ rate: '5.4325' });
    });

    it('maps an unknown pair to 503', async () => {
        await expect(useCase.execute({ from: 'JPY', to: 'KRW' })).rejects.toMatchObject({
            code: 'EXCHANGE_RATE_UNAVAILABLE',
        });
    });

    describe('cache bound', () => {
        const dayN = (n: number): string =>
            new Date(Date.UTC(2000, 0, 1 + n)).toISOString().slice(0, 10);

        it('never holds more than CACHE_MAX_ENTRIES and evicts the oldest first', async () => {
            for (let i = 0; i < CACHE_MAX_ENTRIES + 10; i++) {
                await useCase.execute({ from: 'USD', to: 'BRL', date: dayN(i) });
            }

            const size = (useCase as unknown as { cache: Map<string, unknown> }).cache.size;

            expect(size).toBe(CACHE_MAX_ENTRIES);
            const before = provider.calls.length;

            await useCase.execute({ from: 'USD', to: 'BRL', date: dayN(CACHE_MAX_ENTRIES + 9) }); // newest: hit
            expect(provider.calls).toHaveLength(before);
            await useCase.execute({ from: 'USD', to: 'BRL', date: dayN(0) }); // oldest: evicted
            expect(provider.calls).toHaveLength(before + 1);
        });

        it('sweeps expired entries even when the cache is not full', async () => {
            for (let i = 0; i < 20; i++) {
                await useCase.execute({ from: 'USD', to: 'BRL', date: dayN(i) });
            }

            vi.advanceTimersByTime(CACHE_TTL_MS + 1);
            await useCase.execute({ from: 'USD', to: 'BRL', date: dayN(100) });
            const size = (useCase as unknown as { cache: Map<string, unknown> }).cache.size;

            expect(size).toBe(1);
        });
    });

    describe('in-flight de-duplication', () => {
        class DeferredProvider implements ExchangeRateProvider {
            readonly source = 'deferred';
            calls = 0;
            private waiters: Array<{
                resolve: (r: ProviderRate) => void;
                reject: (e: Error) => void;
            }> = [];
            getRate(): Promise<ProviderRate> {
                this.calls++;

                return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
            }
            resolveAll(rate: string): void {
                this.waiters.splice(0).forEach((w) => w.resolve({ rate, date: '2026-07-10' }));
            }
            rejectAll(): void {
                this.waiters.splice(0).forEach((w) => w.reject(new Error('boom')));
            }
        }
        const query = { from: 'USD', to: 'BRL', date: '2026-07-10' } as const;

        it('shares one provider call between concurrent requests for the same key', async () => {
            const deferred = new DeferredProvider();
            const uc = new GetExchangeRateUseCase(deferred);
            const all = Promise.all([uc.execute(query), uc.execute(query), uc.execute(query)]);

            await Promise.resolve();
            expect(deferred.calls).toBe(1);
            deferred.resolveAll('5.5');
            const results = await all;

            expect(results.map((r) => r.rate)).toEqual(['5.5', '5.5', '5.5']);
            expect(deferred.calls).toBe(1);
        });

        it('does not share calls across different keys', async () => {
            const deferred = new DeferredProvider();
            const uc = new GetExchangeRateUseCase(deferred);
            const all = Promise.all([
                uc.execute(query),
                uc.execute({ ...query, date: '2026-07-09' }),
            ]);

            await Promise.resolve();
            expect(deferred.calls).toBe(2);
            deferred.resolveAll('5.5');
            await all;
        });

        it('fails every waiter of a failed shared call, caches nothing and recovers afterwards', async () => {
            const deferred = new DeferredProvider();
            const uc = new GetExchangeRateUseCase(deferred);
            const all = Promise.allSettled([uc.execute(query), uc.execute(query)]);

            await Promise.resolve();
            deferred.rejectAll();
            const settled = await all;

            expect(settled.map((r) => r.status)).toEqual(['rejected', 'rejected']);

            for (const r of settled) {
                expect((r as PromiseRejectedResult).reason).toMatchObject({
                    code: 'EXCHANGE_RATE_UNAVAILABLE',
                });
            }

            expect(deferred.calls).toBe(1);

            const retry = uc.execute(query);

            await Promise.resolve();
            expect(deferred.calls).toBe(2); // not poisoned: a new call is made
            deferred.resolveAll('6.1');
            await expect(retry).resolves.toMatchObject({ rate: '6.1' });
        });
    });
});

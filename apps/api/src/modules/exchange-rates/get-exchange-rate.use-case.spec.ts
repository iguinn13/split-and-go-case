import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeExchangeRateProvider } from '../../../test/support/fake-exchange-rate.provider.js';
import { AppError } from '../../common/errors/app-error.js';
import { CACHE_TTL_MS, GetExchangeRateUseCase } from './get-exchange-rate.use-case.js';

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
});

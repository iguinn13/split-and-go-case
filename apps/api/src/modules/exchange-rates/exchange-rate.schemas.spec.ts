import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exchangeRateQuerySchema, MIN_RATE_DATE } from './exchange-rate.schemas.js';

const ok = (date: string): boolean =>
  exchangeRateQuerySchema.safeParse({ from: 'USD', to: 'BRL', date }).success;

describe('exchangeRateQuerySchema date range', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('accepts weekends, holidays, today and the first supported day', () => {
    expect(ok('2026-07-11')).toBe(true); // Saturday (and tomorrow in UTC)
    expect(ok('2026-07-05')).toBe(true); // Sunday
    expect(ok('2025-12-25')).toBe(true); // holiday
    expect(ok('2026-07-10')).toBe(true); // today
    expect(ok(MIN_RATE_DATE)).toBe(true);
  });

  it('accepts a missing date', () => {
    expect(exchangeRateQuerySchema.safeParse({ from: 'USD', to: 'BRL' }).success).toBe(true);
  });

  it('rejects dates before the first supported day and beyond tomorrow (UTC)', () => {
    expect(ok('1999-01-03')).toBe(false);
    expect(ok('0001-01-01')).toBe(false);
    expect(ok('9999-12-31')).toBe(false);
    expect(ok('2026-07-12')).toBe(false);
  });

  it('has no off-by-one around UTC midnight', () => {
    vi.setSystemTime(new Date('2026-07-10T23:59:59Z'));
    expect(ok('2026-07-11')).toBe(true);
    expect(ok('2026-07-12')).toBe(false);
    vi.setSystemTime(new Date('2026-07-11T00:00:00Z'));
    expect(ok('2026-07-10')).toBe(true);
    expect(ok('2026-07-12')).toBe(true);
    expect(ok('2026-07-13')).toBe(false);
  });
});

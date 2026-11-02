import { describe, expect, it } from 'vitest';
import { CURRENCIES, currencySchema, exchangeRateSchema, getMinorUnits } from './currencies.js';

describe('currency catalog', () => {
  it('has the 10 supported currencies with JPY and KRW at 0 minor units', () => {
    expect(CURRENCIES.map((c) => c.code)).toEqual([
      'BRL',
      'USD',
      'EUR',
      'GBP',
      'CAD',
      'CHF',
      'MXN',
      'AUD',
      'JPY',
      'KRW',
    ]);
    expect(getMinorUnits('JPY')).toBe(0);
    expect(getMinorUnits('KRW')).toBe(0);
    expect(getMinorUnits('BRL')).toBe(2);
  });

  it('validates currency codes (XYZ is rejected)', () => {
    expect(currencySchema.safeParse('USD').success).toBe(true);
    expect(currencySchema.safeParse('XYZ').success).toBe(false);
    expect(currencySchema.safeParse('usd').success).toBe(false);
  });

  it.each(['1', '5.4325', '0.0345', '0.00000001', '9999999999.99999999', '1.50000000'])(
    'accepts exchange rate %s',
    (rate) => {
      expect(exchangeRateSchema.safeParse(rate).success).toBe(true);
    },
  );

  it.each([
    '0',
    '0.0',
    '0.00000000',
    '-1',
    '1.123456789',
    '1e5',
    '1E-5',
    'abc',
    '',
    '.5',
    '1.',
    '12345678901',
    ' 1',
    '1,5',
  ])('rejects exchange rate %j', (rate) => {
    expect(exchangeRateSchema.safeParse(rate).success).toBe(false);
  });

  it('rejects non-string rates', () => {
    expect(exchangeRateSchema.safeParse(5.4325).success).toBe(false);
  });
});

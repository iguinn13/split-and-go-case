import { z } from 'zod';

export interface Currency {
  code: string;
  name: string;
  minorUnits: number;
}

// Single API catalog (docs/specs/06-currencies.md). The web app keeps a mirror
// in apps/web/src/lib/money/currencies.ts; keep both in sync.
export const CURRENCIES = [
  { code: 'BRL', name: 'Real brasileiro', minorUnits: 2 },
  { code: 'USD', name: 'Dólar americano', minorUnits: 2 },
  { code: 'EUR', name: 'Euro', minorUnits: 2 },
  { code: 'GBP', name: 'Libra esterlina', minorUnits: 2 },
  { code: 'CAD', name: 'Dólar canadense', minorUnits: 2 },
  { code: 'CHF', name: 'Franco suíço', minorUnits: 2 },
  { code: 'MXN', name: 'Peso mexicano', minorUnits: 2 },
  { code: 'AUD', name: 'Dólar australiano', minorUnits: 2 },
  { code: 'JPY', name: 'Iene japonês', minorUnits: 0 },
  { code: 'KRW', name: 'Won sul-coreano', minorUnits: 0 },
] as const satisfies readonly Currency[];

export type CurrencyCode = (typeof CURRENCIES)[number]['code'];

const CURRENCY_CODES = CURRENCIES.map((currency) => currency.code) as [
  CurrencyCode,
  ...CurrencyCode[],
];

export function getMinorUnits(code: CurrencyCode): number {
  return CURRENCIES.find((currency) => currency.code === code)!.minorUnits;
}

/** Accepts only supported currency codes (AC-CUR-08). */
export const currencySchema = z.enum(CURRENCY_CODES);

/** Exchange rate as a plain decimal string: up to 8 decimals, never scientific notation, > 0. */
export const exchangeRateSchema = z
  .string()
  .regex(/^\d{1,10}(\.\d{1,8})?$/, 'Exchange rate must be a decimal with up to 8 decimal places')
  .refine((value) => /[1-9]/.test(value), 'Exchange rate must be greater than zero');

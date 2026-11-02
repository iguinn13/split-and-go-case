import { z } from 'zod';
import { currencySchema } from '../../common/money/currencies.js';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  }, 'Invalid calendar date');

export const exchangeRateQuerySchema = z.object({
  from: currencySchema,
  to: currencySchema,
  date: isoDate.optional(),
});

export type ExchangeRateQuery = z.infer<typeof exchangeRateQuerySchema>;

export interface ExchangeRateView {
  from: string;
  to: string;
  rate: string;
  date: string;
  source: string;
}

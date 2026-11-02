import { z } from 'zod';
import { currencySchema } from '../../common/money/currencies.js';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  }, 'Invalid calendar date');

/** First day with ECB reference rates (Frankfurter's earliest date). */
export const MIN_RATE_DATE = '1999-01-04';

/**
 * Accepted range: MIN_RATE_DATE up to tomorrow in UTC. The extra day tolerates clients ahead
 * of UTC asking for their own "today" around UTC midnight. Weekends and holidays are valid
 * (the provider answers with the previous business day).
 */
function maxRateDate(now: Date = new Date()): string {
  return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const rateDate = isoDate.refine(
  (value) => value >= MIN_RATE_DATE && value <= maxRateDate(),
  `Date must be between ${MIN_RATE_DATE} and tomorrow (UTC)`,
);

export const exchangeRateQuerySchema = z.object({
  from: currencySchema,
  to: currencySchema,
  date: rateDate.optional(),
});

export type ExchangeRateQuery = z.infer<typeof exchangeRateQuerySchema>;

export interface ExchangeRateView {
  from: string;
  to: string;
  rate: string;
  date: string;
  source: string;
}

import type { CurrencyCode } from '../../common/money/currencies.js';

export const EXCHANGE_RATE_PROVIDER = Symbol('EXCHANGE_RATE_PROVIDER');

export interface ProviderRate {
    /** Decimal text, up to 8 decimals, greater than zero. */
    rate: string;
    /** Reference date the provider used (YYYY-MM-DD); may precede the requested date on weekends. */
    date: string;
}

/**
 * External boundary (the only interface in the codebase): implemented by the
 * Frankfurter HTTP client and by a fake in tests. Implementations throw on any
 * failure; the use case maps it to EXCHANGE_RATE_UNAVAILABLE.
 */
export interface ExchangeRateProvider {
    readonly source: string;
    getRate(from: CurrencyCode, to: CurrencyCode, date: string | null): Promise<ProviderRate>;
}

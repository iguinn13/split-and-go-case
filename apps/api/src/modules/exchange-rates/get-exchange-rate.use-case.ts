import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { EXCHANGE_RATE_PROVIDER, type ExchangeRateProvider } from './exchange-rate-provider.js';
import type { ExchangeRateQuery, ExchangeRateView } from './exchange-rate.schemas.js';

export const CACHE_TTL_MS = 60 * 60 * 1000;
/** Upper bound of cached rates (pair x date); the oldest entries are evicted beyond it. */
export const CACHE_MAX_ENTRIES = 500;

interface CacheEntry {
    expiresAt: number;
    value: ExchangeRateView;
}

@Injectable()
export class GetExchangeRateUseCase {
    // Map keeps insertion order and every entry has the same TTL, so the first entries are
    // always the oldest (and the first to expire).
    private readonly cache = new Map<string, CacheEntry>();
    private readonly inFlight = new Map<string, Promise<ExchangeRateView>>();

    constructor(@Inject(EXCHANGE_RATE_PROVIDER) private readonly provider: ExchangeRateProvider) {}

    async execute(query: ExchangeRateQuery): Promise<ExchangeRateView> {
        const date = query.date ?? new Date().toISOString().slice(0, 10);

        if (query.from === query.to) {
            return { from: query.from, to: query.to, rate: '1', date, source: 'identity' };
        }

        const key = `${query.from}:${query.to}:${date}`;
        const now = Date.now();

        this.sweepExpired(now);
        const hit = this.cache.get(key);

        if (hit) return hit.value;

        // Concurrent requests for the same key share one provider call.
        let pending = this.inFlight.get(key);

        if (!pending) {
            pending = this.fetchAndCache(key, query).finally(() => this.inFlight.delete(key));
            this.inFlight.set(key, pending);
        }

        try {
            return await pending;
        } catch {
            // Provider details are intentionally not leaked to the client.
            throw new AppError(
                'EXCHANGE_RATE_UNAVAILABLE',
                503,
                'Exchange rate provider unavailable',
            );
        }
    }

    private async fetchAndCache(key: string, query: ExchangeRateQuery): Promise<ExchangeRateView> {
        const found = await this.provider.getRate(query.from, query.to, query.date ?? null);
        const value: ExchangeRateView = {
            from: query.from,
            to: query.to,
            rate: found.rate,
            date: found.date,
            source: this.provider.source,
        };

        // Only successes are cached; a failed shared call leaves no trace.
        this.sweepExpired(Date.now());

        while (this.cache.size >= CACHE_MAX_ENTRIES) {
            const oldest = this.cache.keys().next().value;

            if (oldest === undefined) break;

            this.cache.delete(oldest);
        }

        this.cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });

        return value;
    }

    /** Drops expired entries (they are the first ones in insertion order). */
    private sweepExpired(now: number): void {
        for (const [key, entry] of this.cache) {
            if (entry.expiresAt > now) break;

            this.cache.delete(key);
        }
    }
}

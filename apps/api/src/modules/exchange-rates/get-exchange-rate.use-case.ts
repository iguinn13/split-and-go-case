import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { EXCHANGE_RATE_PROVIDER, type ExchangeRateProvider } from './exchange-rate-provider.js';
import type { ExchangeRateQuery, ExchangeRateView } from './exchange-rate.schemas.js';

export const CACHE_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class GetExchangeRateUseCase {
  private readonly cache = new Map<string, { expiresAt: number; value: ExchangeRateView }>();

  constructor(@Inject(EXCHANGE_RATE_PROVIDER) private readonly provider: ExchangeRateProvider) {}

  async execute(query: ExchangeRateQuery): Promise<ExchangeRateView> {
    const date = query.date ?? new Date().toISOString().slice(0, 10);
    if (query.from === query.to) {
      return { from: query.from, to: query.to, rate: '1', date, source: 'identity' };
    }

    const key = `${query.from}:${query.to}:${date}`;
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;

    try {
      const found = await this.provider.getRate(query.from, query.to, query.date ?? null);
      const value: ExchangeRateView = {
        from: query.from,
        to: query.to,
        rate: found.rate,
        date: found.date,
        source: this.provider.source,
      };
      this.cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
      return value;
    } catch {
      // Provider details are intentionally not leaked to the client.
      throw new AppError('EXCHANGE_RATE_UNAVAILABLE', 503, 'Exchange rate provider unavailable');
    }
  }
}

import type { CurrencyCode } from '../../src/common/money/currencies.js';
import type {
  ExchangeRateProvider,
  ProviderRate,
} from '../../src/modules/exchange-rates/exchange-rate-provider.js';

/** Test double: deterministic rates, call counting, switchable failure. No network. */
export class FakeExchangeRateProvider implements ExchangeRateProvider {
  readonly source = 'fake';
  calls: { from: string; to: string; date: string | null }[] = [];
  failing = false;
  rates = new Map<string, string>([['USD:BRL', '5.4325']]);

  getRate(from: CurrencyCode, to: CurrencyCode, date: string | null): Promise<ProviderRate> {
    this.calls.push({ from, to, date });
    const rate = this.rates.get(`${from}:${to}`);
    if (this.failing || rate === undefined) return Promise.reject(new Error('boom: secret detail'));
    return Promise.resolve({ rate, date: date ?? '2026-07-10' });
  }
}

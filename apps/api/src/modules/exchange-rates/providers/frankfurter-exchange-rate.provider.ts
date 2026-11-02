import type { CurrencyCode } from '../../../common/money/currencies.js';
import type { ExchangeRateProvider, ProviderRate } from '../exchange-rate-provider.js';
import { extractRateToken, normalizeRate } from './rate-parser.js';

export const FX_TIMEOUT_MS = 3000;

/** Frankfurter (ECB reference rates). Base URL comes from FX_PROVIDER_URL. */
export class FrankfurterExchangeRateProvider implements ExchangeRateProvider {
  readonly source = 'frankfurter';

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number = FX_TIMEOUT_MS,
  ) {}

  async getRate(from: CurrencyCode, to: CurrencyCode, date: string | null): Promise<ProviderRate> {
    const url = `${this.baseUrl.replace(/\/+$/, '')}/${date ?? 'latest'}?base=${from}&symbols=${to}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    if (!response.ok) throw new Error(`Provider responded ${response.status}`);

    const text = await response.text();
    const token = extractRateToken(text, to);
    const rate = token === null ? null : normalizeRate(token);
    const referenceDate = /"date"\s*:\s*"(\d{4}-\d{2}-\d{2})"/.exec(text)?.[1];
    if (rate === null || referenceDate === undefined)
      throw new Error('Unexpected provider payload');
    return { rate, date: referenceDate };
  }
}

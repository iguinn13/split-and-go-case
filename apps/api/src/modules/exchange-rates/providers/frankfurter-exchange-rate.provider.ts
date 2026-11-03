import type { CurrencyCode } from '../../../common/money/currencies.js';
import type { ExchangeRateProvider, ProviderRate } from '../exchange-rate-provider.js';
import { normalizeRate, parseProviderPayload } from './rate-parser.js';

export const FX_TIMEOUT_MS = 3000;
/** A rate payload is a few hundred bytes; anything bigger is not a valid answer. */
export const FX_MAX_BODY_BYTES = 16 * 1024;

/**
 * Reads the body as a stream and aborts as soon as it exceeds `maxBytes`, so an oversized or
 * endless response never gets buffered whole. Rejects on abort (timeout) as well.
 */
async function readBodyLimited(response: Response, maxBytes: number): Promise<string> {
    const declared = Number(response.headers.get('content-length'));

    if (Number.isFinite(declared) && declared > maxBytes) {
        await response.body?.cancel();

        throw new Error('Provider response too large');
    }

    if (!response.body) return '';

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    for (;;) {
        const { done, value } = (await reader.read()) as {
            done: boolean;
            value?: Uint8Array;
        };

        if (done || value === undefined) break;

        total += value.byteLength;

        if (total > maxBytes) {
            await reader.cancel();

            throw new Error('Provider response too large');
        }

        chunks.push(value);
    }

    return Buffer.concat(chunks).toString('utf8');
}

/** Frankfurter (ECB reference rates). Base URL comes from FX_PROVIDER_URL. */
export class FrankfurterExchangeRateProvider implements ExchangeRateProvider {
    readonly source = 'frankfurter';

    constructor(
        private readonly baseUrl: string,
        private readonly timeoutMs: number = FX_TIMEOUT_MS,
        private readonly maxBodyBytes: number = FX_MAX_BODY_BYTES,
    ) {}

    async getRate(
        from: CurrencyCode,
        to: CurrencyCode,
        date: string | null,
    ): Promise<ProviderRate> {
        const url = `${this.baseUrl.replace(/\/+$/, '')}/${date ?? 'latest'}?base=${from}&symbols=${to}`;
        // The signal also covers the body read below, so a slow body hits the same timeout.
        const response = await fetch(url, {
            signal: AbortSignal.timeout(this.timeoutMs),
            redirect: 'error',
        });

        if (!response.ok) throw new Error(`Provider responded ${response.status}`);

        const parsed = parseProviderPayload(await readBodyLimited(response, this.maxBodyBytes), to);
        const rate = parsed === null ? null : normalizeRate(parsed.token);

        if (parsed === null || rate === null) throw new Error('Unexpected provider payload');

        return { rate, date: parsed.date };
    }
}

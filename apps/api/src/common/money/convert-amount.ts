import { AppError } from '../errors/app-error.js';
import { type CurrencyCode, getMinorUnits } from './currencies.js';

export const MAX_AMOUNT_MINOR = 1_000_000_000;
export const RATE_SCALE_DECIMALS = 8;
const RATE_SCALE = 10n ** BigInt(RATE_SCALE_DECIMALS);
const RATE_PATTERN = /^\d{1,10}(\.\d{1,8})?$/;

export function assertAmountInRange(amountMinor: number): void {
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 1 || amountMinor > MAX_AMOUNT_MINOR) {
        throw new AppError(
            'AMOUNT_OUT_OF_RANGE',
            422,
            `Amount must be an integer between 1 and ${MAX_AMOUNT_MINOR}`,
        );
    }
}

export function parseExchangeRate(rate: string): bigint {
    if (!RATE_PATTERN.test(rate)) {
        throw new AppError('EXCHANGE_RATE_INVALID', 422, 'Exchange rate format is invalid');
    }

    const [integerPart = '', fractionPart = ''] = rate.split('.');
    const scaled = BigInt(integerPart + fractionPart.padEnd(RATE_SCALE_DECIMALS, '0'));

    if (scaled === 0n) {
        throw new AppError('EXCHANGE_RATE_INVALID', 422, 'Exchange rate must be greater than zero');
    }

    return scaled;
}

/**
 * Converts `originalAmountMinor` to the target currency's minor unit using BigInt only,
 * rounding half up (RN-CUR-05). Both the original and the converted amounts must be
 * within 1..MAX_AMOUNT_MINOR (AMOUNT_OUT_OF_RANGE).
 */
export function convertAmount(
    originalAmountMinor: number,
    exchangeRate: string,
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
): number {
    assertAmountInRange(originalAmountMinor);
    const scaledRate = parseExchangeRate(exchangeRate);

    const numerator =
        BigInt(originalAmountMinor) * scaledRate * 10n ** BigInt(getMinorUnits(toCurrency));
    const denominator = RATE_SCALE * 10n ** BigInt(getMinorUnits(fromCurrency));
    const converted = (2n * numerator + denominator) / (2n * denominator);

    if (converted < 1n || converted > BigInt(MAX_AMOUNT_MINOR)) {
        throw new AppError(
            'AMOUNT_OUT_OF_RANGE',
            422,
            `Converted amount must be between 1 and ${MAX_AMOUNT_MINOR}`,
        );
    }

    return Number(converted);
}

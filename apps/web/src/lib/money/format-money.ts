import { CURRENCIES, isCurrencyCode } from './currencies';

/**
 * Formats an integer amount in the currency's minor unit (pt-BR locale).
 * Pure integer/string arithmetic: no floating point is involved.
 */
export function formatMoney(minor: number | bigint, currency: string): string {
    if (!isCurrencyCode(currency)) {
        throw new Error(`Unsupported currency: ${currency}`);
    }

    const value = BigInt(minor);
    const { minorUnits } = CURRENCIES[currency];
    const negative = value < 0n;
    const digits = (negative ? -value : value).toString().padStart(minorUnits + 1, '0');
    const decimal =
        minorUnits === 0 ? digits : `${digits.slice(0, -minorUnits)}.${digits.slice(-minorUnits)}`;

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency,
        minimumFractionDigits: minorUnits,
        maximumFractionDigits: minorUnits,
    }).format((negative ? `-${decimal}` : decimal) as `${number}`);
}

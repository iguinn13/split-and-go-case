import { CURRENCIES, isCurrencyCode } from '@/lib/money/currencies';

/** Largest amount accepted by the API, in minor units (RN-EXP-01). */
export const MAX_AMOUNT_MINOR = 1_000_000_000n;
const RATE_PATTERN = /^\d{1,10}(\.\d{1,8})?$/;

export function minorUnitsOf(currency: string): number {
  return isCurrencyCode(currency) ? CURRENCIES[currency].minorUnits : 2;
}

/**
 * Keeps only what a money field can hold: digits and, when the currency has decimals,
 * one separator (normalised to a comma) followed by at most `minorUnits` digits.
 */
export function sanitizeAmountInput(text: string, minorUnits: number): string {
  let integer = '';
  let fraction = '';
  let separator = false;
  for (const char of text) {
    if (char >= '0' && char <= '9') {
      if (separator) fraction += char;
      else integer += char;
    } else if ((char === ',' || char === '.') && !separator && minorUnits > 0) {
      separator = true;
    }
  }
  integer = integer.replace(/^0+(?=\d)/, '').slice(0, 12);
  fraction = fraction.slice(0, minorUnits);
  return separator ? `${integer},${fraction}` : integer;
}

/** Converts a masked amount ("1234,5") to minor units with string arithmetic only. */
export function parseAmountInput(text: string, minorUnits: number): bigint | null {
  const clean = sanitizeAmountInput(text, minorUnits);
  if (clean === '' || clean === ',') return null;
  const [integer = '', fraction = ''] = clean.split(',');
  const digits = `${integer === '' ? '0' : integer}${fraction.padEnd(minorUnits, '0')}`;
  return BigInt(digits);
}

/** Percentages are typed with up to 2 decimals and stored as basis points. */
export function parsePercentInput(text: string): bigint | null {
  return parseAmountInput(text, 2);
}

/** Formats basis points as pt-BR percentage text ("33,33%"). */
export function formatBasisPoints(basisPoints: bigint): string {
  const negative = basisPoints < 0n;
  const digits = (negative ? -basisPoints : basisPoints).toString().padStart(3, '0');
  const text = `${digits.slice(0, -2)},${digits.slice(-2)}`.replace(/,00$/, '');
  return `${negative ? '-' : ''}${text}%`;
}

/** Rate field: digits plus one separator, up to 10 integer and 8 decimal digits. */
export function sanitizeRateInput(text: string): string {
  let integer = '';
  let fraction = '';
  let separator = false;
  for (const char of text) {
    if (char >= '0' && char <= '9') {
      if (separator) fraction += char;
      else integer += char;
    } else if ((char === ',' || char === '.') && !separator) {
      separator = true;
    }
  }
  integer = integer.slice(0, 10);
  fraction = fraction.slice(0, 8);
  return separator ? `${integer},${fraction}` : integer;
}

/** Decimal text for the API ("5,4325" -> "5.4325"), or null when it is not a valid positive rate. */
export function toApiRate(text: string): string | null {
  const normalized = text.trim().replace(',', '.');
  if (!RATE_PATTERN.test(normalized)) return null;
  if (/^0+(\.0+)?$/.test(normalized)) return null;
  return normalized;
}

/** "5.43250000" -> "5,4325" (field and display text). */
export function displayRate(apiRate: string): string {
  const trimmed = apiRate.includes('.') ? apiRate.replace(/0+$/, '').replace(/\.$/, '') : apiRate;
  return trimmed.replace('.', ',');
}

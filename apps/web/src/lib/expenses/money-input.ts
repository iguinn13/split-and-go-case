import { CURRENCIES, isCurrencyCode } from '@/lib/money/currencies';

/** Largest amount accepted by the API, in minor units (RN-EXP-01). */
export const MAX_AMOUNT_MINOR = 1_000_000_000n;
const RATE_PATTERN = /^\d{1,10}(\.\d{1,8})?$/;

export function minorUnitsOf(currency: string): number {
  return isCurrencyCode(currency) ? CURRENCIES[currency].minorUnits : 2;
}

/** Result of reading amount text: minor units, or why the text cannot be read. */
export type AmountParse =
  | { ok: true; minor: bigint; error: null }
  /** `error` is null for empty text (nothing typed yet) and a pt-BR message otherwise. */
  | { ok: false; error: string | null };

const MAX_INPUT_DIGITS = 15;
/** Optional leading currency marker: "R$", "US$", "JP¥", "€", or a catalog code ("USD"). */
const SYMBOL_PREFIX = new RegExp(`^(?:[A-Za-z]{0,3}[$¥€£₩]|${Object.keys(CURRENCIES).join('|')})`);
const bad = (error: string): AmountParse => ({ ok: false, error });

/** Thousands grouping: 1-3 leading digits, then groups of exactly 3 ("1", "234", "567"). */
function validGroups(groups: string[]): boolean {
  return groups.every((g, i) => (i === 0 ? /^\d{1,3}$/.test(g) : /^\d{3}$/.test(g)));
}

/**
 * Reads what the user typed or pasted. The field keeps the RAW text and this function is the
 * only interpretation: a pure function of the text, so typing key by key and pasting the same
 * final text always give the same result, and nothing is reinterpreted after formatting.
 *
 * Rules (`units` = decimals of the currency):
 * - several equal separators are thousands marks ("1.234.567"); groups must be 1-3 digits then
 *   exactly 3 digits;
 * - with mixed separators the LAST one is the decimal mark and the earlier ones (all equal) are
 *   thousands ("1.234,56", "1,234.56");
 * - a single separator followed by 1..units digits is decimal ("1,5", "1.23");
 * - a single separator followed by exactly 3 digits (more than `units`) after 1-3 non-zero-led
 *   digits is thousands ("1.234", "25.000");
 * - anything else (extra decimals such as "0,001" or "1,2345", "12,345,67", "1,5" in JPY,
 *   letters, sign) is rejected with a message: digits are never dropped.
 * A leading currency symbol/code ("R$ ", "US$") and spaces are ignored.
 */
export function parseAmount(text: string, units: number): AmountParse {
  const trimmed = text.replace(/[\s\u00a0]/g, '').replace(SYMBOL_PREFIX, '');
  if (trimmed === '') return { ok: false, error: null };
  if (trimmed.includes('-')) return bad('O valor não pode ser negativo.');
  if (!/^[\d.,]+$/.test(trimmed)) return bad('Use apenas números, ponto e vírgula.');
  if (trimmed.replace(/[.,]/g, '').length > MAX_INPUT_DIGITS)
    return bad('O valor é grande demais.');

  const separators = [...trimmed].filter((c) => c === ',' || c === '.');
  let integer: string;
  let fraction = '';

  if (separators.length === 0) {
    integer = trimmed;
  } else {
    const last = trimmed.search(/[,.](?=[^,.]*$)/);
    const lastChar = trimmed[last] as string;
    const head = trimmed.slice(0, last);
    const tail = trimmed.slice(last + 1);
    const headSeparators = separators.slice(0, -1);
    const mixed = headSeparators.some((c) => c !== lastChar);

    if (units === 0) {
      // No decimals: every separator is a thousands mark.
      if (/[.,]$/.test(trimmed) || !validGroups(trimmed.split(/[.,]/))) {
        return bad('Esta moeda não tem casas decimais. Use ponto só para milhar (ex.: 1.234).');
      }
      integer = trimmed.replace(/[.,]/g, '');
    } else if (mixed || (separators.length === 1 && tail.length <= units)) {
      // Decimal mark is the last separator; the ones before it must be equal thousands marks.
      if (headSeparators.some((c) => c === lastChar) || (head.length === 0 && mixed)) {
        return bad('Valor ambíguo. Exemplo de formato: 1.234,56.');
      }
      if (headSeparators.length > 0 && !validGroups(head.split(/[.,]/))) {
        return bad('Valor ambíguo. Exemplo de formato: 1.234,56.');
      }
      if (tail.length > units) {
        return bad(`Esta moeda aceita no máximo ${units} casas decimais.`);
      }
      integer = head.replace(/[.,]/g, '');
      fraction = tail;
    } else if (separators.length === 1) {
      // Single separator followed by more digits than the currency has decimals.
      if (tail.length === 3 && /^[1-9]\d{0,2}$/.test(head)) {
        integer = head + tail;
      } else {
        return bad(`Esta moeda aceita no máximo ${units} casas decimais.`);
      }
    } else {
      // Several equal separators: thousands marks only.
      if (!validGroups(trimmed.split(lastChar))) {
        return bad('Valor ambíguo. Exemplo de formato: 1.234,56.');
      }
      integer = trimmed.split(lastChar).join('');
    }
  }
  const digits = `${integer === '' ? '0' : integer}${fraction.padEnd(units, '0')}`;
  return { ok: true, minor: BigInt(digits), error: null };
}

/** Minor units of the amount text, or null when it is empty or invalid. */
export function parseAmountInput(text: string, units: number): bigint | null {
  const result = parseAmount(text, units);
  return result.ok ? result.minor : null;
}

/** Canonical editable text for minor units ("123450" -> "1234,50"), with no thousands marks. */
export function amountInputText(minor: number | bigint, units: number): string {
  const digits = String(minor).padStart(units + 1, '0');
  return units === 0 ? digits : `${digits.slice(0, -units)},${digits.slice(-units)}`;
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

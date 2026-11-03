import { CURRENCIES, isCurrencyCode } from '@/lib/money/currencies';

/** Largest amount accepted by the API, in minor units (RN-EXP-01). */
export const MAX_AMOUNT_MINOR = 1_000_000_000n;
const RATE_PATTERN = /^\d{1,10}(\.\d{1,8})?$/;

export function minorUnitsOf(currency: string): number {
    return isCurrencyCode(currency) ? CURRENCIES[currency].minorUnits : 2;
}

export type AmountParse =
    /** `thousandsHint` marks the ambiguous "1.234" shape (single separator + 3 digits, read as thousands). */
    | { ok: true; minor: bigint; error: null; thousandsHint: boolean }
    /** `error` is null for empty text (nothing typed yet) and a pt-BR message otherwise. */
    | { ok: false; error: string | null };

const MAX_INPUT_DIGITS = 15;
const bad = (error: string): AmountParse => ({ ok: false, error });
const FORMAT_EXAMPLE = 'Exemplo de formato: 1.234,56.';

/** Thousands grouping: a leading group of 1-3 digits not starting with 0, then groups of 3. */
function validGroups(groups: string[]): boolean {
    return groups.every((g, i) => (i === 0 ? /^[1-9]\d{0,2}$/.test(g) : /^\d{3}$/.test(g)));
}

/** The currency's own marker as formatMoney shows it in pt-BR ("R$", "US$", "JP¥", "€"). */
function symbolOf(currency: string): string {
    let symbol = symbolCache.get(currency);

    if (symbol === undefined) {
        symbol =
            new Intl.NumberFormat('pt-BR', { style: 'currency', currency })
                .formatToParts(0)
                .find((part) => part.type === 'currency')?.value ?? currency;
        symbolCache.set(currency, symbol);
    }

    return symbol;
}

const symbolCache = new Map<string, string>();

/**
 * Reads what the user typed or pasted. The field keeps the RAW text and this function is the
 * only interpretation: a pure function of the text, so typing key by key and pasting the same
 * final text always give the same result, and nothing is reinterpreted after formatting.
 *
 * Rules (`units` = decimals of the currency):
 * - several equal separators are thousands marks ("1.234.567"); groups must be 1-3 digits (not
 *   starting with 0) then exactly 3 digits;
 * - with mixed separators the LAST one is the decimal mark and the earlier ones (all equal) are
 *   thousands ("1.234,56", "1,234.56");
 * - a single separator followed by 1..units digits is decimal ("1,5", "1.23");
 * - a single separator followed by exactly 3 digits (more than `units`) after 1-3 digits not
 *   starting with 0 is thousands ("1.234", "25.000"), flagged with `thousandsHint`;
 * - currencies without decimals: every separator is thousands, all equal ("1.234", "1,234");
 * - a space (also NBSP or thin space) is accepted only as a thousands mark between a leading
 *   group of 1-3 digits and groups of exactly 3 ("1 234,56", "10 000");
 * - only the selected currency's own marker (symbol or code) may precede the number;
 * - anything else (extra decimals such as "0,001" or "1,2345", "12,345,67", "1,5" in JPY,
 *   letters, sign, other markers, stray spaces) is rejected with a message: digits are never
 *   dropped or merged.
 */
export function parseAmount(text: string, units: number, currency?: string): AmountParse {
    let t = text.trim();
    const prefix = /^[^\d.,\s-]+/.exec(t)?.[0];

    if (prefix !== undefined) {
        const own =
            currency !== undefined &&
            (prefix === symbolOf(currency) || prefix.toUpperCase() === currency);

        if (own) t = t.slice(prefix.length).trim();
        else if (/[$€£¥₩]/.test(prefix) || isCurrencyCode(prefix.toUpperCase())) {
            return bad(
                `Este campo é em ${currency ?? 'outra moeda'}. Remova "${prefix}" ou troque a moeda.`,
            );
        } else return bad('Use apenas números, ponto e vírgula.');
    }

    if (t === '') return { ok: false, error: null };

    if (t.includes('-')) return bad('O valor não pode ser negativo.');

    if (/\s/.test(t)) {
        const grouped = /^([1-9]\d{0,2}(?:[ \u00a0\u202f\u2009]\d{3})+)([.,]\d*)?$/.exec(t);

        if (!grouped)
            return bad('Espaço no meio do número. Use espaço só para milhar (ex.: 1 234,56).');

        t = (grouped[1] as string).replace(/[ \u00a0\u202f\u2009]/g, '') + (grouped[2] ?? '');
    }

    if (!/^[\d.,]+$/.test(t)) return bad('Use apenas números, ponto e vírgula.');

    if (t.replace(/[.,]/g, '').length > MAX_INPUT_DIGITS) return bad('O valor é grande demais.');

    const separators = [...t].filter((c) => c === ',' || c === '.');
    let integer: string;
    let fraction = '';
    let thousandsHint = false;

    if (separators.length === 0) {
        integer = t;
    } else {
        const last = t.search(/[,.](?=[^,.]*$)/);
        const lastChar = t[last] as string;
        const head = t.slice(0, last);
        const tail = t.slice(last + 1);
        const headSeparators = separators.slice(0, -1);
        const mixed = headSeparators.some((c) => c !== lastChar);

        if (units === 0) {
            // No decimals: every separator is a thousands mark, and they must all be the same.
            if (mixed || /[.,]$/.test(t) || !validGroups(t.split(lastChar))) {
                return bad(
                    'Esta moeda não tem casas decimais. Use ponto só para milhar (ex.: 1.234).',
                );
            }

            integer = t.split(lastChar).join('');
        } else if (mixed || (separators.length === 1 && tail.length <= units)) {
            // Decimal mark is the last separator; the ones before it must be equal thousands marks.
            if (headSeparators.some((c) => c === lastChar) || (head.length === 0 && mixed)) {
                return bad(`Valor ambíguo. ${FORMAT_EXAMPLE}`);
            }

            if (headSeparators.length > 0 && !validGroups(head.split(/[.,]/))) {
                return bad(`Valor ambíguo. ${FORMAT_EXAMPLE}`);
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
                thousandsHint = true;
            } else {
                return bad(`Esta moeda aceita no máximo ${units} casas decimais.`);
            }
        } else {
            // Several equal separators: thousands marks only.
            if (!validGroups(t.split(lastChar))) return bad(`Valor ambíguo. ${FORMAT_EXAMPLE}`);

            integer = t.split(lastChar).join('');
        }
    }

    const digits = `${integer === '' ? '0' : integer}${fraction.padEnd(units, '0')}`;

    return { ok: true, minor: BigInt(digits), error: null, thousandsHint };
}

export function parseAmountInput(text: string, units: number, currency?: string): bigint | null {
    const result = parseAmount(text, units, currency);

    return result.ok ? result.minor : null;
}

export function amountInputText(minor: number | bigint, units: number): string {
    const digits = String(minor).padStart(units + 1, '0');

    return units === 0 ? digits : `${digits.slice(0, -units)},${digits.slice(-units)}`;
}

/**
 * Percentages: digits with one "," or "." and at most 2 decimals, stored as basis points. An
 * optional trailing "%" is accepted (it is how the app displays them). There are no thousands
 * separators, so "1.000" and "33,333" are rejected instead of being read as another value.
 */
export function parsePercent(text: string): AmountParse {
    const t = text.trim().replace(/\s*%$/, '');

    if (t === '') return { ok: false, error: null };

    if (t.includes('-')) return bad('A porcentagem não pode ser negativa.');

    if (!/^[\d.,]+$/.test(t)) return bad('Use apenas números e uma vírgula (ex.: 33,33).');

    const parts = t.split(/[.,]/);

    if (parts.length > 2) return bad('Use uma só vírgula na porcentagem (ex.: 33,33).');

    const [integer = '', fraction = ''] = parts;

    if (fraction.length > 2) return bad('A porcentagem aceita no máximo 2 casas decimais.');

    if (integer.length + fraction.length > MAX_INPUT_DIGITS) return bad('O valor é grande demais.');

    const digits = `${integer === '' ? '0' : integer}${fraction.padEnd(2, '0')}`;

    return { ok: true, minor: BigInt(digits), error: null, thousandsHint: false };
}

export function parsePercentInput(text: string): bigint | null {
    const result = parsePercent(text);

    return result.ok ? result.minor : null;
}

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

export function toApiRate(text: string): string | null {
    const normalized = text.trim().replace(',', '.');

    if (!RATE_PATTERN.test(normalized)) return null;

    if (/^0+(\.0+)?$/.test(normalized)) return null;

    return normalized;
}

export function displayRate(apiRate: string): string {
    const trimmed = apiRate.includes('.') ? apiRate.replace(/0+$/, '').replace(/\.$/, '') : apiRate;

    return trimmed.replace('.', ',');
}

const RATE_TOKEN = /^\d+(\.\d+)?$/;
const MAX_DECIMALS = 8;
const MAX_INTEGER_DIGITS = 10;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface ParsedProviderPayload {
    /** Raw numeric token of `rates.<symbol>` exactly as sent (never a double). */
    token: string;
    date: string;
}

/**
 * Throws on the first duplicate key of any object in an already syntactically valid JSON
 * text (JSON.parse silently keeps the last value, which could hide a conflicting rate).
 */
function assertNoDuplicateKeys(jsonText: string): void {
    const stack: Array<Set<string> | null> = []; // Set = object frame, null = array frame
    let expectKey = false;

    for (let i = 0; i < jsonText.length; i++) {
        const char = jsonText[i]!;

        if (char === '{') {
            stack.push(new Set());
            expectKey = true;
        } else if (char === '[') {
            stack.push(null);
            expectKey = false;
        } else if (char === '}' || char === ']') {
            stack.pop();
            expectKey = false;
        } else if (char === ',') {
            expectKey = stack[stack.length - 1] instanceof Set;
        } else if (char === '"') {
            let end = i + 1;

            while (end < jsonText.length && jsonText[end] !== '"')
                end += jsonText[end] === '\\' ? 2 : 1;

            const frame = stack[stack.length - 1];

            if (expectKey && frame instanceof Set) {
                if (end >= jsonText.length) throw new Error('Unterminated string');

                const key = JSON.parse(jsonText.slice(i, end + 1)) as string;

                if (frame.has(key)) throw new Error('Duplicate key in provider payload');

                frame.add(key);
                expectKey = false;
            }

            i = end;
        }
    }
}

/**
 * Parses a Frankfurter payload `{"date":"YYYY-MM-DD","rates":{"<symbol>":<number>}, ...}`.
 *
 * The text is validated by JSON.parse, and the reviver reads the raw numeric token through
 * `context.source` (Node 22+), so the rate never becomes an IEEE double. Strict by design:
 * returns null for duplicate keys, a `rates` key anywhere but the top level, `rates` holding
 * anything other than exactly `{ <symbol>: <JSON number> }`, a missing/invalid `date`, or a
 * token that is not a plain decimal (scientific notation, negative). Invalid JSON returns null.
 */
export function parseProviderPayload(
    jsonText: string,
    symbol: string,
): ParsedProviderPayload | null {
    const numberSources = new Map<object, Map<string, string>>();
    const ratesHolders: object[] = [];
    let root: unknown;
    // `context` (3rd argument) exists at runtime on Node 22+ but not in the ES2022 typings.
    const reviver = function (
        this: object,
        key: string,
        value: unknown,
        context: { source: string },
    ) {
        if (key === 'rates') ratesHolders.push(this);

        if (typeof value === 'number') {
            const forHolder = numberSources.get(this) ?? new Map<string, string>();

            forHolder.set(key, context.source);
            numberSources.set(this, forHolder);
        }

        return value;
    };

    try {
        // Parse first: the duplicate-key scan below assumes syntactically valid JSON.
        root = JSON.parse(jsonText, reviver as unknown as Parameters<typeof JSON.parse>[1]);
        assertNoDuplicateKeys(jsonText);
    } catch {
        return null;
    }

    if (typeof root !== 'object' || root === null || Array.isArray(root)) return null;

    if (ratesHolders.length !== 1 || ratesHolders[0] !== root) return null;

    const { rates, date } = root as { rates?: unknown; date?: unknown };

    if (typeof date !== 'string' || !ISO_DATE.test(date)) return null;

    if (typeof rates !== 'object' || rates === null || Array.isArray(rates)) return null;

    const keys = Object.keys(rates);

    if (keys.length !== 1 || keys[0] !== symbol) return null;

    const token = numberSources.get(rates)?.get(symbol);

    return token !== undefined && RATE_TOKEN.test(token) ? { token, date } : null;
}

/**
 * Normalizes a plain decimal token to at most 8 decimals, rounding half up
 * (provider decimals beyond the 8th are rounded, never truncated), and strips
 * trailing zeros. Returns null if the result is zero or exceeds 10 integer digits.
 */
export function normalizeRate(token: string): string | null {
    if (!RATE_TOKEN.test(token)) return null;

    const [intPart = '0', fracPart = ''] = token.split('.');
    let scaled = BigInt(intPart + fracPart.slice(0, MAX_DECIMALS).padEnd(MAX_DECIMALS, '0'));

    if (fracPart.length > MAX_DECIMALS && fracPart.charCodeAt(MAX_DECIMALS) >= 53 /* '5' */) {
        scaled += 1n;
    }

    if (scaled === 0n) return null;

    const digits = scaled.toString().padStart(MAX_DECIMALS + 1, '0');
    const integer = digits.slice(0, -MAX_DECIMALS).replace(/^0+(?=\d)/, '');

    if (integer.length > MAX_INTEGER_DIGITS) return null;

    const fraction = digits.slice(-MAX_DECIMALS).replace(/0+$/, '');

    return fraction ? `${integer}.${fraction}` : integer;
}

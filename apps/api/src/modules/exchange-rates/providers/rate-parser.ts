const RATE_TOKEN = /^\d+(\.\d+)?$/;
const MAX_DECIMALS = 8;
const MAX_INTEGER_DIGITS = 10;

/**
 * Extracts the raw numeric token of `rates.<symbol>` from a JSON text WITHOUT
 * going through JSON.parse, so the value never becomes an IEEE double.
 * Returns null when absent or not a plain decimal (e.g. scientific notation).
 */
export function extractRateToken(jsonText: string, symbol: string): string | null {
  const ratesMatch = /"rates"\s*:\s*\{([^{}]*)\}/.exec(jsonText);
  if (!ratesMatch) return null;
  const entry = new RegExp(`"${symbol}"\\s*:\\s*([^,}\\s]+)`).exec(ratesMatch[1]!);
  const token = entry?.[1];
  return token !== undefined && RATE_TOKEN.test(token) ? token : null;
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

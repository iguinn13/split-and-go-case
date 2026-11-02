import { formatMoney } from '@/lib/money/format-money';
import { isCurrencyCode, CURRENCIES } from '@/lib/money/currencies';
import { MAX_AMOUNT_MINOR, formatBasisPoints, toApiRate } from './money-input';

// Pure mirror of the API calculators (apps/api/src/common/money/*, split.calculator.ts).
// Everything is BigInt: no floating point is involved.

export const TOTAL_BASIS_POINTS = 10_000n;
const RATE_SCALE = 10n ** 8n;

export interface AllocationWeight {
  memberId: string;
  weight: bigint;
}

/**
 * Largest-remainder allocation (RN-EXP-06): floor(total * w / W) plus the leftover units
 * to the largest remainders, ties by ascending memberId. Results follow the input order.
 */
export function allocateProportionally(
  total: bigint,
  weights: readonly AllocationWeight[],
): { memberId: string; amountMinor: bigint }[] {
  const weightSum = weights.reduce((sum, entry) => sum + entry.weight, 0n);
  const rows = weights.map((entry, index) => {
    const product = total * entry.weight;
    return {
      index,
      memberId: entry.memberId,
      base: product / weightSum,
      remainder: product % weightSum,
    };
  });
  const leftover = Number(total - rows.reduce((sum, row) => sum + row.base, 0n));
  const winners = new Set(
    [...rows]
      .sort((a, b) => {
        if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
        if (a.memberId !== b.memberId) return a.memberId < b.memberId ? -1 : 1;
        return a.index - b.index;
      })
      .slice(0, leftover)
      .map((row) => row.index),
  );
  return rows.map((row) => ({
    memberId: row.memberId,
    amountMinor: row.base + (winners.has(row.index) ? 1n : 0n),
  }));
}

export type ConvertResult =
  { ok: true; amountMinor: bigint } | { ok: false; error: 'RATE_INVALID' | 'OUT_OF_RANGE' };

/** RN-CUR-05: original * rate * 10^(baseDecimals - originDecimals), rounded half up. */
export function convertAmount(
  originalAmountMinor: bigint,
  apiRate: string,
  fromCurrency: string,
  toCurrency: string,
): ConvertResult {
  const rate = toApiRate(apiRate);
  if (rate === null || !isCurrencyCode(fromCurrency) || !isCurrencyCode(toCurrency)) {
    return { ok: false, error: 'RATE_INVALID' };
  }
  const [integer = '', fraction = ''] = rate.split('.');
  const scaledRate = BigInt(integer + fraction.padEnd(8, '0'));
  const numerator =
    originalAmountMinor * scaledRate * 10n ** BigInt(CURRENCIES[toCurrency].minorUnits);
  const denominator = RATE_SCALE * 10n ** BigInt(CURRENCIES[fromCurrency].minorUnits);
  const converted = (2n * numerator + denominator) / (2n * denominator);
  if (converted < 1n || converted > MAX_AMOUNT_MINOR) return { ok: false, error: 'OUT_OF_RANGE' };
  return { ok: true, amountMinor: converted };
}

export type SplitDraft =
  | { type: 'EQUAL'; memberIds: string[] }
  | { type: 'PERCENTAGE'; shares: { memberId: string; basisPoints: bigint | null }[] }
  | { type: 'FIXED'; shares: { memberId: string; amountMinor: bigint | null }[] };

export interface PreviewInput {
  currency: string;
  baseCurrency: string;
  /** Null while the amount field is empty or invalid. */
  originalAmountMinor: bigint | null;
  /** Rate text as typed (comma or dot); ignored when the currency equals the base. */
  exchangeRate: string;
  split: SplitDraft;
}

export interface PreviewShare {
  memberId: string;
  originalAmountMinor: bigint;
  amountMinor: bigint;
}

export type SplitPreview =
  { ok: true; amountMinor: bigint; shares: PreviewShare[] } | { ok: false; problems: string[] };

/**
 * Live preview mirroring `calculateShares`: allocates the original total and the converted
 * total with the same weights. Returns what is missing in pt-BR when the split is not valid.
 */
export function previewSplit(input: PreviewInput): SplitPreview {
  const { currency, baseCurrency, originalAmountMinor, split } = input;
  const problems: string[] = [];
  const sameCurrency = currency === baseCurrency;

  if (originalAmountMinor === null) problems.push('Informe o valor da despesa.');
  else if (originalAmountMinor < 1n) problems.push('O valor deve ser maior que zero.');
  else if (originalAmountMinor > MAX_AMOUNT_MINOR) {
    problems.push('O valor deve ser de no máximo 1.000.000.000 na menor unidade da moeda.');
  }

  const weights = splitWeights(split, originalAmountMinor, currency, problems);

  let converted: bigint | null = null;
  if (originalAmountMinor !== null && problems.length === 0) {
    if (sameCurrency) converted = originalAmountMinor;
    else {
      const result = convertAmount(originalAmountMinor, input.exchangeRate, currency, baseCurrency);
      if (result.ok) converted = result.amountMinor;
      else if (result.error === 'RATE_INVALID') problems.push('Informe uma taxa de câmbio válida.');
      else problems.push('O valor convertido deve estar entre 1 e 1.000.000.000.');
    }
  } else if (!sameCurrency && toApiRate(input.exchangeRate) === null) {
    problems.push('Informe uma taxa de câmbio válida.');
  }

  if (problems.length > 0 || originalAmountMinor === null || converted === null || !weights) {
    return { ok: false, problems };
  }
  const original = allocateProportionally(originalAmountMinor, weights);
  const base = allocateProportionally(converted, weights);
  return {
    ok: true,
    amountMinor: converted,
    shares: original.map((part, index) => ({
      memberId: part.memberId,
      originalAmountMinor: part.amountMinor,
      amountMinor: base[index]!.amountMinor,
    })),
  };
}

function splitWeights(
  split: SplitDraft,
  originalAmountMinor: bigint | null,
  currency: string,
  problems: string[],
): AllocationWeight[] | null {
  if (split.type === 'EQUAL') {
    if (split.memberIds.length === 0) {
      problems.push('Selecione ao menos um participante.');
      return null;
    }
    return split.memberIds.map((memberId) => ({ memberId, weight: 1n }));
  }
  if (split.shares.length === 0) {
    problems.push('Selecione ao menos um participante.');
    return null;
  }

  const values = split.shares.map((s) => ({
    memberId: s.memberId,
    value:
      split.type === 'PERCENTAGE'
        ? (s as { basisPoints: bigint | null }).basisPoints
        : (s as { amountMinor: bigint | null }).amountMinor,
  }));
  if (values.some((v) => v.value === null || v.value < 1n)) {
    problems.push(
      split.type === 'PERCENTAGE'
        ? 'Informe uma porcentagem maior que zero para cada participante.'
        : 'Informe um valor maior que zero para cada participante.',
    );
    return null;
  }
  const sum = values.reduce((acc, v) => acc + (v.value ?? 0n), 0n);
  const target = split.type === 'PERCENTAGE' ? TOTAL_BASIS_POINTS : originalAmountMinor;
  if (target !== null && sum !== target) {
    const diff = target - sum;
    const abs = diff < 0n ? -diff : diff;
    const label =
      split.type === 'PERCENTAGE'
        ? formatBasisPoints(abs)
        : formatMoney(abs, isCurrencyCode(currency) ? currency : 'BRL');
    problems.push(
      diff > 0n ? `Faltam ${label} para fechar o rateio.` : `O rateio excede o total em ${label}.`,
    );
    return null;
  }
  if (target === null) return null;
  return values.map((v) => ({ memberId: v.memberId, weight: v.value ?? 0n }));
}

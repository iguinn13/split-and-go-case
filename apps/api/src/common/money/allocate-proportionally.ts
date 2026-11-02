import { AppError } from '../errors/app-error.js';

export interface AllocationWeight {
  memberId: string;
  weight: number;
}

export interface Allocation {
  memberId: string;
  amountMinor: number;
}

/**
 * Largest-remainder allocation (RN-EXP-06). Each part is floor(total * w / W); the leftover
 * units go one by one to the largest remainders, ties broken by ascending memberId.
 * The sum of the parts is always `total`. Results follow the input order.
 */
export function allocateProportionally(
  total: number,
  weights: readonly AllocationWeight[],
): Allocation[] {
  const valid =
    Number.isSafeInteger(total) &&
    total >= 0 &&
    weights.length > 0 &&
    weights.every((entry) => Number.isSafeInteger(entry.weight) && entry.weight > 0);
  if (!valid) {
    throw new AppError('VALIDATION_ERROR', 422, 'Invalid allocation input');
  }

  const bigTotal = BigInt(total);
  const weightSum = weights.reduce((sum, entry) => sum + BigInt(entry.weight), 0n);

  const rows = weights.map((entry, index) => {
    const product = bigTotal * BigInt(entry.weight);
    return {
      index,
      memberId: entry.memberId,
      base: product / weightSum,
      remainder: product % weightSum,
    };
  });

  const leftover = Number(bigTotal - rows.reduce((sum, row) => sum + row.base, 0n));
  const winners = new Set(
    [...rows]
      .sort((a, b) =>
        a.remainder !== b.remainder
          ? a.remainder > b.remainder
            ? -1
            : 1
          : a.memberId < b.memberId
            ? -1
            : a.memberId > b.memberId
              ? 1
              : a.index - b.index,
      )
      .slice(0, leftover)
      .map((row) => row.index),
  );

  return rows.map((row) => ({
    memberId: row.memberId,
    amountMinor: Number(row.base) + (winners.has(row.index) ? 1 : 0),
  }));
}

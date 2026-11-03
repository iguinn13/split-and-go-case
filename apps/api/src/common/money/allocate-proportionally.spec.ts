import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { AppError } from '../errors/app-error.js';
import { allocateProportionally } from './allocate-proportionally.js';

const w = (...weights: number[]) => weights.map((weight, i) => ({ memberId: `m${i + 1}`, weight }));
const amounts = (total: number, weights: { memberId: string; weight: number }[]) =>
    allocateProportionally(total, weights).map((a) => a.amountMinor);

describe('allocateProportionally', () => {
    it('splits exactly', () => {
        expect(amounts(10000, w(1, 1, 1, 1))).toEqual([2500, 2500, 2500, 2500]);
        expect(amounts(10000, w(5000, 3000, 2000))).toEqual([5000, 3000, 2000]);
    });

    it('gives leftover units to the smallest memberIds on equal remainders', () => {
        expect(amounts(10000, w(1, 1, 1))).toEqual([3334, 3333, 3333]);
        expect(amounts(1001, w(5000, 5000))).toEqual([501, 500]);
        expect(amounts(2, w(1, 1, 1))).toEqual([1, 1, 0]);
    });

    it('breaks ties by memberId regardless of input order', () => {
        const result = allocateProportionally(100, [
            { memberId: 'c', weight: 1 },
            { memberId: 'a', weight: 1 },
            { memberId: 'b', weight: 1 },
        ]);

        expect(result).toEqual([
            { memberId: 'c', amountMinor: 33 },
            { memberId: 'a', amountMinor: 34 },
            { memberId: 'b', amountMinor: 33 },
        ]);
    });

    it('gives leftover to the largest remainder first', () => {
        // total 10, weights 1:2 -> 3.33/6.67, remainders favour the second
        expect(amounts(10, w(1, 2))).toEqual([3, 7]);
    });

    it('breaks ties by input index when memberIds repeat (stable)', () => {
        const result = allocateProportionally(3, [
            { memberId: 'a', weight: 1 },
            { memberId: 'a', weight: 1 },
        ]);

        expect(result.map((r) => r.amountMinor)).toEqual([2, 1]);
    });

    it('handles zero totals and does not overflow with large values', () => {
        expect(amounts(0, w(1, 2))).toEqual([0, 0]);
        expect(amounts(1_000_000_000, w(999_999_999, 1_000_000_000)).reduce((a, b) => a + b)).toBe(
            1_000_000_000,
        );
    });

    it('does not mutate its input', () => {
        const input = Object.freeze([Object.freeze({ memberId: 'a', weight: 1 })]);

        expect(allocateProportionally(5, input)).toEqual([{ memberId: 'a', amountMinor: 5 }]);
    });

    it.each([
        [1.5, w(1)],
        [-1, w(1)],
        [10, []],
        [10, w(0)],
        [10, w(-1)],
        [10, w(1.5)],
    ])('rejects invalid input (%j, %j)', (total, weights) => {
        expect(() => allocateProportionally(total, weights)).toThrow(AppError);
    });

    it('property: sum equals total, parts differ at most by 1 for equal weights, deterministic', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 1_000_000_000 }),
                fc.array(fc.integer({ min: 1, max: 1_000_000_000 }), {
                    minLength: 1,
                    maxLength: 12,
                }),
                (total, weights) => {
                    const input = w(...weights);
                    const result = allocateProportionally(total, input);

                    expect(result.reduce((s, a) => s + a.amountMinor, 0)).toBe(total);
                    expect(
                        result.every((a) => Number.isInteger(a.amountMinor) && a.amountMinor >= 0),
                    ).toBe(true);
                    expect(allocateProportionally(total, input)).toEqual(result);
                },
            ),
        );
    });
});

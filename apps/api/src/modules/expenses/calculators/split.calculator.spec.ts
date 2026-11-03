import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../../common/errors/app-error.js';
import { CURRENCIES } from '../../../common/money/currencies.js';
import { type CalculateSharesInput, calculateShares } from './split.calculator.js';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `m${i + 1}`);
const equal = (n: number) => ({ type: 'EQUAL' as const, participantIds: ids(n) });
const base = { currency: 'BRL', baseCurrency: 'BRL' } as const;

function errorCode(input: CalculateSharesInput): string | undefined {
    try {
        calculateShares(input);
    } catch (error) {
        return error instanceof AppError ? error.code : 'OTHER';
    }

    return undefined;
}

const originals = (input: CalculateSharesInput) =>
    calculateShares(input).shares.map((s) => s.originalAmountMinor);
const converted = (input: CalculateSharesInput) =>
    calculateShares(input).shares.map((s) => s.amountMinor);

describe('calculateShares', () => {
    it('EQUAL: 100/4 and 100/3', () => {
        expect(originals({ ...base, originalAmountMinor: 10000, split: equal(4) })).toEqual([
            2500, 2500, 2500, 2500,
        ]);
        const r = calculateShares({ ...base, originalAmountMinor: 10000, split: equal(3) });

        expect(r.exchangeRate).toBe('1');
        expect(r.amountMinor).toBe(10000);
        expect(r.shares.map((s) => s.originalAmountMinor)).toEqual([3334, 3333, 3333]);
        expect(r.shares.map((s) => s.amountMinor)).toEqual([3334, 3333, 3333]);
    });

    it('PERCENTAGE: 50/30/20 and 10.01 with 50/50', () => {
        const pct = (...bps: number[]) => ({
            type: 'PERCENTAGE' as const,
            shares: bps.map((basisPoints, i) => ({ memberId: `m${i + 1}`, basisPoints })),
        });

        expect(
            originals({ ...base, originalAmountMinor: 10000, split: pct(5000, 3000, 2000) }),
        ).toEqual([5000, 3000, 2000]);
        expect(originals({ ...base, originalAmountMinor: 1001, split: pct(5000, 5000) })).toEqual([
            501, 500,
        ]);
    });

    it('FIXED: 60/40 returns exactly the informed values in the same currency', () => {
        const split = {
            type: 'FIXED' as const,
            shares: [
                { memberId: 'a', originalAmountMinor: 6000 },
                { memberId: 'b', originalAmountMinor: 4000 },
            ],
        };

        expect(originals({ ...base, originalAmountMinor: 10000, split })).toEqual([6000, 4000]);
        expect(converted({ ...base, originalAmountMinor: 10000, split })).toEqual([6000, 4000]);
    });

    it('foreign currency EQUAL: USD 100 / 3 at 5.4325', () => {
        const r = calculateShares({
            currency: 'USD',
            baseCurrency: 'BRL',
            exchangeRate: '5.4325',
            originalAmountMinor: 10000,
            split: equal(3),
        });

        expect(r.amountMinor).toBe(54325);
        expect(r.shares.map((s) => s.originalAmountMinor)).toEqual([3334, 3333, 3333]);
        expect(r.shares.map((s) => s.amountMinor)).toEqual([18109, 18108, 18108]);
    });

    it('foreign currency FIXED and PERCENTAGE', () => {
        const input = {
            currency: 'USD',
            baseCurrency: 'BRL',
            exchangeRate: '5.4325',
            originalAmountMinor: 10000,
        } as const;

        expect(
            converted({
                ...input,
                split: {
                    type: 'FIXED',
                    shares: [
                        { memberId: 'a', originalAmountMinor: 6000 },
                        { memberId: 'b', originalAmountMinor: 4000 },
                    ],
                },
            }),
        ).toEqual([32595, 21730]);
        expect(
            converted({
                currency: 'JPY',
                baseCurrency: 'BRL',
                exchangeRate: '0.0345',
                originalAmountMinor: 5000,
                split: {
                    type: 'PERCENTAGE',
                    shares: [
                        { memberId: 'a', basisPoints: 5000 },
                        { memberId: 'b', basisPoints: 5000 },
                    ],
                },
            }),
        ).toEqual([8625, 8625]);
    });

    it('accepts rate 1.00000000 for the base currency', () => {
        expect(
            calculateShares({
                ...base,
                exchangeRate: '1.00000000',
                originalAmountMinor: 100,
                split: equal(1),
            }).amountMinor,
        ).toBe(100);
    });

    it('keeps input order and never mutates the input', () => {
        const split = Object.freeze({
            type: 'EQUAL' as const,
            participantIds: Object.freeze(['z', 'a']),
        });
        const input = Object.freeze({ ...base, originalAmountMinor: 101, split });
        const r = calculateShares(input);

        expect(r.shares).toEqual([
            { memberId: 'z', originalAmountMinor: 50, amountMinor: 50 },
            { memberId: 'a', originalAmountMinor: 51, amountMinor: 51 },
        ]);
        expect(split.participantIds).toEqual(['z', 'a']);
    });

    it('errors', () => {
        const pct = (...bps: number[]) => ({
            type: 'PERCENTAGE' as const,
            shares: bps.map((basisPoints, i) => ({ memberId: `m${i + 1}`, basisPoints })),
        });
        const fixed = (...v: number[]) => ({
            type: 'FIXED' as const,
            shares: v.map((originalAmountMinor, i) => ({
                memberId: `m${i + 1}`,
                originalAmountMinor,
            })),
        });
        const b = { ...base, originalAmountMinor: 10000 };

        expect(errorCode({ ...b, split: pct(3333, 3333, 3333) })).toBe(
            'SPLIT_PERCENTAGE_SUM_INVALID',
        );
        expect(errorCode({ ...b, split: pct(10000, 0) })).toBe('VALIDATION_ERROR');
        expect(errorCode({ ...b, split: pct(9999.5, 0.5) })).toBe('VALIDATION_ERROR');
        expect(errorCode({ ...b, split: fixed(6000, 3000) })).toBe('SPLIT_FIXED_SUM_INVALID');
        expect(errorCode({ ...b, split: fixed(10000, 0) })).toBe('VALIDATION_ERROR');
        expect(errorCode({ ...b, split: fixed(9999.5, 0.5) })).toBe('VALIDATION_ERROR');
        expect(errorCode({ ...b, split: equal(0) })).toBe('INVALID_SPLIT_PARTICIPANTS');
        expect(errorCode({ ...b, split: { type: 'EQUAL', participantIds: ['a', 'a'] } })).toBe(
            'INVALID_SPLIT_PARTICIPANTS',
        );
        expect(
            errorCode({
                ...b,
                split: {
                    type: 'FIXED',
                    shares: [
                        { memberId: 'a', originalAmountMinor: 5000 },
                        { memberId: 'a', originalAmountMinor: 5000 },
                    ],
                },
            }),
        ).toBe('INVALID_SPLIT_PARTICIPANTS');
    });

    it('rate errors', () => {
        const b = { originalAmountMinor: 10000, split: equal(2) };

        expect(errorCode({ ...b, currency: 'USD', baseCurrency: 'BRL' })).toBe(
            'EXCHANGE_RATE_INVALID',
        );
        expect(errorCode({ ...b, currency: 'USD', baseCurrency: 'BRL', exchangeRate: '0' })).toBe(
            'EXCHANGE_RATE_INVALID',
        );
        expect(errorCode({ ...b, currency: 'USD', baseCurrency: 'BRL', exchangeRate: '1e3' })).toBe(
            'EXCHANGE_RATE_INVALID',
        );
        expect(errorCode({ ...b, ...base, exchangeRate: '1.5' })).toBe('EXCHANGE_RATE_INVALID');
    });

    it('amount range errors', () => {
        expect(errorCode({ ...base, originalAmountMinor: 0, split: equal(2) })).toBe(
            'AMOUNT_OUT_OF_RANGE',
        );
        expect(errorCode({ ...base, originalAmountMinor: 1_000_000_001, split: equal(2) })).toBe(
            'AMOUNT_OUT_OF_RANGE',
        );
        expect(
            errorCode({
                currency: 'JPY',
                baseCurrency: 'BRL',
                exchangeRate: '0.00000001',
                originalAmountMinor: 1,
                split: equal(1),
            }),
        ).toBe('AMOUNT_OUT_OF_RANGE');
        expect(
            errorCode({
                currency: 'BRL',
                baseCurrency: 'JPY',
                exchangeRate: '9999999999',
                originalAmountMinor: 1_000_000_000,
                split: equal(1),
            }),
        ).toBe('AMOUNT_OUT_OF_RANGE');
    });

    describe('properties', () => {
        const code = fc.constantFrom(...CURRENCIES.map((c) => c.code));
        const rate = fc
            .tuple(fc.integer({ min: 0, max: 500 }), fc.integer({ min: 0, max: 99999999 }))
            .filter(([i, f]) => i > 0 || f > 0)
            .map(([i, f]) => `${i}.${String(f).padStart(8, '0')}`);
        const memberIds = fc.uniqueArray(fc.uuid(), { minLength: 1, maxLength: 10 });

        function build(
            type: 'EQUAL' | 'PERCENTAGE' | 'FIXED',
            members: string[],
            amount: number,
            seeds: number[],
        ): CalculateSharesInput['split'] {
            if (type === 'EQUAL') return { type, participantIds: members };

            const weights = members.map((_, i) => seeds[i % seeds.length]! + 1);
            const sum = weights.reduce((a, b) => a + b, 0);
            const parts = type === 'PERCENTAGE' ? 10000 : amount;
            // build integer parts >= 1 that sum to `parts` (skip when impossible)
            const raw = weights.map((x) => Math.max(1, Math.floor((x * parts) / sum)));

            raw[0] = raw[0]! + (parts - raw.reduce((a, b) => a + b, 0));

            return type === 'PERCENTAGE'
                ? {
                      type,
                      shares: members.map((memberId, i) => ({ memberId, basisPoints: raw[i]! })),
                  }
                : {
                      type,
                      shares: members.map((memberId, i) => ({
                          memberId,
                          originalAmountMinor: raw[i]!,
                      })),
                  };
        }

        it('sums are exact in both currencies, EQUAL differs by at most 1, deterministic', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom('EQUAL', 'PERCENTAGE', 'FIXED' as const),
                    memberIds,
                    fc.integer({ min: 10000, max: 1_000_000 }),
                    fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 1, maxLength: 10 }),
                    code,
                    code,
                    rate,
                    (type, members, amount, seeds, currency, baseCurrency, r) => {
                        const split = build(type, members, amount, seeds);

                        if (
                            split.type !== 'EQUAL' &&
                            split.shares.some(
                                (s) =>
                                    ('basisPoints' in s ? s.basisPoints : s.originalAmountMinor) <
                                    1,
                            )
                        ) {
                            return;
                        }

                        const input: CalculateSharesInput = {
                            currency,
                            baseCurrency,
                            originalAmountMinor: amount,
                            exchangeRate: currency === baseCurrency ? '1' : r,
                            split,
                        };
                        let result;

                        try {
                            result = calculateShares(input);
                        } catch (error) {
                            expect((error as AppError).code).toBe('AMOUNT_OUT_OF_RANGE');

                            return;
                        }

                        expect(result.shares.reduce((s, x) => s + x.originalAmountMinor, 0)).toBe(
                            amount,
                        );
                        expect(result.shares.reduce((s, x) => s + x.amountMinor, 0)).toBe(
                            result.amountMinor,
                        );

                        if (type === 'EQUAL') {
                            for (const key of ['originalAmountMinor', 'amountMinor'] as const) {
                                const values = result.shares.map((s) => s[key]);

                                expect(
                                    Math.max(...values) - Math.min(...values),
                                ).toBeLessThanOrEqual(1);
                            }
                        }

                        expect(calculateShares(input)).toEqual(result);
                    },
                ),
            );
        });
    });
});

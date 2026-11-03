import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { AppError } from '../errors/app-error.js';
import {
    assertAmountInRange,
    convertAmount,
    MAX_AMOUNT_MINOR,
    parseExchangeRate,
} from './convert-amount.js';
import { CURRENCIES, getMinorUnits } from './currencies.js';

function codeOf(fn: () => unknown): string | undefined {
    try {
        fn();
    } catch (error) {
        return error instanceof AppError ? error.code : 'OTHER';
    }

    return undefined;
}

describe('convertAmount', () => {
    it.each([
        [10000, '5.4325', 'USD', 'BRL', 54325],
        [5000, '0.0345', 'JPY', 'BRL', 17250],
        [3333, '6.0712', 'EUR', 'BRL', 20235],
        [10000, '0.1841', 'BRL', 'USD', 1841],
        [1000, '157.25', 'USD', 'JPY', 1573],
        [1000, '1', 'BRL', 'BRL', 1000],
    ] as const)('%i at %s %s->%s = %i', (amount, rate, from, to, expected) => {
        expect(convertAmount(amount, rate, from, to)).toBe(expected);
    });

    it('rounds half up and below half down', () => {
        expect(convertAmount(10, '157.25', 'USD', 'JPY')).toBe(16);
        expect(convertAmount(5, '0.3', 'BRL', 'BRL')).toBe(2);
        expect(convertAmount(7, '0.3', 'BRL', 'BRL')).toBe(2);
        expect(convertAmount(6, '0.3', 'BRL', 'BRL')).toBe(2);
        expect(convertAmount(4, '0.3', 'BRL', 'BRL')).toBe(1);
    });

    it('rejects invalid rates', () => {
        for (const rate of ['0', '-1', '1.123456789', '1e3', 'abc']) {
            expect(codeOf(() => convertAmount(100, rate, 'USD', 'BRL'))).toBe(
                'EXCHANGE_RATE_INVALID',
            );
        }
    });

    it('rejects originals out of range', () => {
        for (const amount of [0, -1, 1.5, MAX_AMOUNT_MINOR + 1]) {
            expect(codeOf(() => convertAmount(amount, '1', 'BRL', 'BRL'))).toBe(
                'AMOUNT_OUT_OF_RANGE',
            );
        }

        expect(codeOf(() => assertAmountInRange(MAX_AMOUNT_MINOR))).toBeUndefined();
    });

    it('rejects converted amounts that round to zero or exceed the limit', () => {
        expect(codeOf(() => convertAmount(1, '0.00000001', 'JPY', 'BRL'))).toBe(
            'AMOUNT_OUT_OF_RANGE',
        );
        expect(codeOf(() => convertAmount(1, '0.0001', 'BRL', 'JPY'))).toBe('AMOUNT_OUT_OF_RANGE');
        expect(codeOf(() => convertAmount(MAX_AMOUNT_MINOR, '2', 'BRL', 'BRL'))).toBe(
            'AMOUNT_OUT_OF_RANGE',
        );
    });

    it('parseExchangeRate scales by 1e8', () => {
        expect(parseExchangeRate('5.4325')).toBe(543250000n);
        expect(parseExchangeRate('1')).toBe(100000000n);
    });

    describe('properties', () => {
        const code = fc.constantFrom(...CURRENCIES.map((c) => c.code));
        const rate = fc
            .tuple(fc.integer({ min: 0, max: 1000 }), fc.integer({ min: 0, max: 99999999 }))
            .filter(([i, f]) => i > 0 || f > 0)
            .map(([i, f]) => `${i}.${String(f).padStart(8, '0')}`);

        it('matches a BigInt reference and is deterministic', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 1_000_000 }),
                    rate,
                    code,
                    code,
                    (amount, r, from, to) => {
                        const [i, f] = r.split('.') as [string, string];
                        const scaled = BigInt(i + f);
                        const num = BigInt(amount) * scaled * 10n ** BigInt(getMinorUnits(to));
                        const den = 10n ** BigInt(8 + getMinorUnits(from));
                        // floor((num + den/2) / den) written without division of den
                        const expected = (2n * num + den) / (2n * den);
                        let result: number | undefined;

                        try {
                            result = convertAmount(amount, r, from, to);
                        } catch (error) {
                            expect((error as AppError).code).toBe('AMOUNT_OUT_OF_RANGE');
                            expect(expected < 1n || expected > BigInt(MAX_AMOUNT_MINOR)).toBe(true);

                            return;
                        }

                        expect(Number.isInteger(result)).toBe(true);
                        expect(BigInt(result)).toBe(expected);
                        expect(convertAmount(amount, r, from, to)).toBe(result);
                    },
                ),
            );
        });

        it('is monotonic in the amount', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 100000 }),
                    fc.integer({ min: 0, max: 1000 }),
                    (a, d) => {
                        expect(
                            convertAmount(a + d, '3.14159265', 'USD', 'BRL'),
                        ).toBeGreaterThanOrEqual(convertAmount(a, '3.14159265', 'USD', 'BRL'));
                    },
                ),
            );
        });

        it('returns the original amount for rate 1 in the same currency', () => {
            fc.assert(
                fc.property(fc.integer({ min: 1, max: MAX_AMOUNT_MINOR }), code, (a, c) => {
                    expect(convertAmount(a, '1', c, c)).toBe(a);
                }),
            );
        });
    });
});

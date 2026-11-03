import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
    DebtSimplifierInputError,
    EXACT_SOLVER_MAX_PARTICIPANTS,
    simplifyDebts,
    simplifyDebtsGreedy,
    type DebtBalance,
    type Transfer,
} from './debt-simplifier.js';

const bal = (entries: Record<string, number>): DebtBalance[] =>
    Object.entries(entries).map(([memberId, netMinor]) => ({ memberId, netMinor }));

const applyPlan = (balances: DebtBalance[], plan: Transfer[]): Map<string, number> => {
    const result = new Map(balances.map((b) => [b.memberId, b.netMinor]));

    for (const t of plan) {
        result.set(t.from, (result.get(t.from) as number) + t.amountMinor);
        result.set(t.to, (result.get(t.to) as number) - t.amountMinor);
    }

    return result;
};

describe('simplifyDebts examples', () => {
    it('returns an empty plan for no members', () => {
        expect(simplifyDebts([])).toEqual([]);
    });

    it('returns an empty plan when all balances are zero', () => {
        expect(simplifyDebts(bal({ a: 0, b: 0, c: 0 }))).toEqual([]);
    });

    it('collapses a chain A->B->C into A->C', () => {
        expect(simplifyDebts(bal({ a: -50, b: 0, c: 50 }))).toEqual([
            { from: 'a', to: 'c', amountMinor: 50 },
        ]);
    });

    it('cancels a cycle (all net balances are zero)', () => {
        expect(simplifyDebts(bal({ a: 0, b: 0, c: 0 }))).toEqual([]);
    });

    it('solves +5 -3 -2 +4 -4 with 3 transfers (greedy needs 4)', () => {
        const balances = bal({ a: 5, b: -3, c: -2, d: 4, e: -4 });
        const plan = simplifyDebts(balances);

        expect(plan).toHaveLength(3);
        expect(simplifyDebtsGreedy(balances)).toHaveLength(4);
        expect([...applyPlan(balances, plan).values()].every((v) => v === 0)).toBe(true);
    });

    it('settles a single pair', () => {
        expect(simplifyDebts(bal({ a: 100, b: -100 }))).toEqual([
            { from: 'b', to: 'a', amountMinor: 100 },
        ]);
    });

    it('does not mutate the input', () => {
        const balances = bal({ b: -3, a: 3 });
        const copy = structuredClone(balances);

        simplifyDebts(balances);
        expect(balances).toEqual(copy);
    });

    it('breaks ties by ascending memberId', () => {
        expect(simplifyDebts(bal({ z: 10, y: 10, b: -10, a: -10 }))).toEqual([
            { from: 'a', to: 'y', amountMinor: 10 },
            { from: 'b', to: 'z', amountMinor: 10 },
        ]);
    });

    it('exposes the exact solver limit as 16', () => {
        expect(EXACT_SOLVER_MAX_PARTICIPANTS).toBe(16);
    });
});

describe('simplifyDebts input validation', () => {
    it('rejects balances that do not sum to zero', () => {
        expect(() => simplifyDebts(bal({ a: 5, b: -3 }))).toThrow(DebtSimplifierInputError);
    });

    it('rejects non-integer balances', () => {
        expect(() => simplifyDebts(bal({ a: 0.5, b: -0.5 }))).toThrow(DebtSimplifierInputError);
    });

    it('rejects duplicate members', () => {
        expect(() =>
            simplifyDebts([
                { memberId: 'a', netMinor: 1 },
                { memberId: 'a', netMinor: -1 },
            ]),
        ).toThrow(DebtSimplifierInputError);
    });
});

describe('simplifyDebts greedy path (above the exact limit)', () => {
    it('uses at most n - 1 transfers and settles everyone', () => {
        const n = EXACT_SOLVER_MAX_PARTICIPANTS + 4;
        const entries: Record<string, number> = {};

        for (let i = 0; i < n - 1; i++)
            entries[`m${String(i).padStart(2, '0')}`] = i % 2 ? -(i + 1) : i + 1;

        const sum = Object.values(entries).reduce((a, b) => a + b, 0);

        entries[`m${String(n - 1).padStart(2, '0')}`] = -sum;
        const balances = bal(entries);
        const plan = simplifyDebts(balances);

        expect(plan).toEqual(simplifyDebtsGreedy(balances));
        expect(plan.length).toBeLessThanOrEqual(n - 1);
        expect([...applyPlan(balances, plan).values()].every((v) => v === 0)).toBe(true);
    });
});

/** Generates a zero-sum balance list with unique ids. */
const balancesArb = (maxSize: number, maxAmount = 100_000) =>
    fc
        .array(fc.integer({ min: -maxAmount, max: maxAmount }), {
            minLength: 0,
            maxLength: maxSize,
        })
        .map((values) => {
            const sum = values.reduce((a, b) => a + b, 0);
            const all = [...values, 0 - sum];

            return all.map((netMinor, i) => ({
                memberId: `m${String(i).padStart(3, '0')}`,
                netMinor,
            }));
        });

const nonZero = (b: DebtBalance[]): number => b.filter((x) => x.netMinor !== 0).length;

describe('simplifyDebts properties', () => {
    const checkInvariants = (balances: DebtBalance[], plan: Transfer[]): void => {
        const final = applyPlan(balances, plan);

        for (const v of final.values()) expect(v).toBe(0);

        const pairs = new Set<string>();
        const byId = new Map(balances.map((b) => [b.memberId, b.netMinor]));

        for (const t of plan) {
            expect(Number.isSafeInteger(t.amountMinor)).toBe(true);
            expect(t.amountMinor).toBeGreaterThan(0);
            expect(t.from).not.toBe(t.to);
            expect(byId.get(t.from) as number).toBeLessThan(0);
            expect(byId.get(t.to) as number).toBeGreaterThan(0);
            const key = `${t.from}->${t.to}`;

            expect(pairs.has(key)).toBe(false);
            pairs.add(key);
        }

        expect(plan.length).toBeLessThanOrEqual(Math.max(nonZero(balances) - 1, 0));
    };

    it('zeroes balances, has valid transfers and at most n - 1 (exact path)', () => {
        fc.assert(
            fc.property(balancesArb(15), (balances) => {
                checkInvariants(balances, simplifyDebts(balances));
            }),
            { numRuns: 300 },
        );
    });

    it('holds the same invariants on the greedy path', () => {
        fc.assert(
            fc.property(balancesArb(40), (balances) => {
                checkInvariants(balances, simplifyDebts(balances));
                checkInvariants(balances, simplifyDebtsGreedy(balances));
            }),
            { numRuns: 200 },
        );
    });

    it('exact path is never worse than greedy', () => {
        fc.assert(
            fc.property(balancesArb(15), (balances) => {
                expect(simplifyDebts(balances).length).toBeLessThanOrEqual(
                    simplifyDebtsGreedy(balances).length,
                );
            }),
            { numRuns: 300 },
        );
    });

    it('exact path hits n - g on planted zero-sum groups', () => {
        // Planted groups of 2 and 3 members each: optimum is at most n - groups.
        fc.assert(
            fc.property(
                fc.array(
                    fc.tuple(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 1, max: 1000 })),
                    {
                        minLength: 1,
                        maxLength: 5,
                    },
                ),
                (groups) => {
                    const balances: DebtBalance[] = [];

                    groups.forEach(([x, y], g) => {
                        balances.push({ memberId: `g${g}a`, netMinor: x + y });
                        balances.push({ memberId: `g${g}b`, netMinor: -x });
                        balances.push({ memberId: `g${g}c`, netMinor: -y });
                    });
                    expect(simplifyDebts(balances).length).toBeLessThanOrEqual(groups.length * 2);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('is independent of input order and repeatable', () => {
        fc.assert(
            fc.property(balancesArb(25), fc.integer(), (balances, seed) => {
                const shuffled = [...balances].sort(
                    (a, b) =>
                        ((a.memberId.charCodeAt(2) * seed) % 7) -
                        ((b.memberId.charCodeAt(2) * seed) % 7),
                );
                const reversed = [...balances].reverse();
                const plan = simplifyDebts(balances);

                expect(simplifyDebts(balances)).toEqual(plan);
                expect(simplifyDebts(reversed)).toEqual(plan);
                expect(simplifyDebts(shuffled)).toEqual(plan);
            }),
            { numRuns: 200 },
        );
    });
});

describe('simplifyDebts performance', () => {
    const worst = (n: number): DebtBalance[] => {
        // Many distinct magnitudes, no zero-sum proper subset in most cases: worst case for the DP.
        const values = Array.from(
            { length: n - 1 },
            (_, i) => (i % 2 === 0 ? 1 : -1) * (1009 * (i + 1) + 7),
        );
        const sum = values.reduce((a, b) => a + b, 0);

        return [...values, 0 - sum].map((netMinor, i) => ({
            memberId: `m${String(i).padStart(3, '0')}`,
            netMinor,
        }));
    };

    it('solves 16 non-zero balances in under 200 ms', () => {
        const balances = worst(16);

        expect(nonZero(balances)).toBe(16);
        simplifyDebts(balances); // warm-up (JIT), not measured
        const start = performance.now();
        const plan = simplifyDebts(balances);
        const elapsed = performance.now() - start;

        console.info(`16 balances: ${elapsed.toFixed(1)} ms, ${plan.length} transfers`);
        expect(elapsed).toBeLessThan(200);
    });

    it('solves 50 participants in under 1 s', () => {
        const balances = worst(50);
        const start = performance.now();
        const plan = simplifyDebts(balances);
        const elapsed = performance.now() - start;

        console.info(`50 balances: ${elapsed.toFixed(1)} ms, ${plan.length} transfers`);
        expect(plan.length).toBeLessThanOrEqual(49);
        expect(elapsed).toBeLessThan(1000);
    });

    it('rejects inputs whose sum of absolute balances exceeds the safe integer range', () => {
        const half = Math.floor(Number.MAX_SAFE_INTEGER / 2) + 1;
        const balances = bal({ a: half, b: -half });

        expect(() => simplifyDebts(balances)).toThrow(DebtSimplifierInputError);
        expect(() => simplifyDebtsGreedy(balances)).toThrow(DebtSimplifierInputError);
    });

    it('accepts a sum of absolute balances exactly at the safe integer limit', () => {
        const half = Math.floor(Number.MAX_SAFE_INTEGER / 2);
        const plan = simplifyDebts(bal({ a: half, b: -half }));

        expect(plan).toEqual([{ from: 'b', to: 'a', amountMinor: half }]);
    });
});

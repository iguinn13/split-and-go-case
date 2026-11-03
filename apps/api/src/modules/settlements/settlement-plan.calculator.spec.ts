import { describe, expect, it } from 'vitest';
import { calculateSettlementPlan } from './settlement-plan.calculator.js';

const ANA = '00000000-0000-4000-8000-000000000001';
const BIA = '00000000-0000-4000-8000-000000000002';

const expense = (
    id: string,
    currency: string,
    originalAmountMinor: number,
    exchangeRate: string,
    amountMinor: number,
    paidByMemberId: string,
    shares: [string, number][],
) => ({
    id,
    description: id,
    occurredOn: '2026-07-10',
    currency,
    originalAmountMinor,
    exchangeRate,
    amountMinor,
    paidByMemberId,
    shares: shares.map(([memberId, amount]) => ({ memberId, amountMinor: amount })),
});

describe('calculateSettlementPlan', () => {
    it('AC-BAL-15: mixed currencies in the base currency (Ana has the lowest id)', () => {
        const plan = calculateSettlementPlan(
            [ANA, BIA],
            [
                expense('e1', 'BRL', 10000, '1.00000000', 10000, ANA, [
                    [ANA, 5000],
                    [BIA, 5000],
                ]),
                expense('e2', 'USD', 10000, '5.43250000', 54325, BIA, [
                    [ANA, 27163],
                    [BIA, 27162],
                ]),
            ],
        );

        expect(plan).toEqual([{ from: ANA, to: BIA, amountMinor: 22163 }]);
    });

    it('returns an empty plan without expenses', () => {
        expect(calculateSettlementPlan([ANA, BIA], [])).toEqual([]);
    });
});

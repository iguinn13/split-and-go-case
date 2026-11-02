import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  BalanceInvariantError,
  buildStatement,
  calculateBalances,
  type BalanceExpense,
} from './balance.calculator.js';

const expense = (over: Partial<BalanceExpense> & Pick<BalanceExpense, 'id'>): BalanceExpense => ({
  description: 'x',
  occurredOn: '2026-07-10',
  currency: 'BRL',
  originalAmountMinor: 0,
  exchangeRate: '1.00000000',
  amountMinor: 0,
  paidByMemberId: 'a',
  shares: [],
  ...over,
});

type Raw = { payer: string; shares: [string, number][] };
const toExpenses = (raws: Raw[]): BalanceExpense[] =>
  raws.map(({ payer, shares }, i) =>
    expense({
      id: `e${i}`,
      paidByMemberId: payer,
      amountMinor: shares.reduce((acc, [, amount]) => acc + amount, 0),
      shares: shares.map(([memberId, amountMinor]) => ({ memberId, amountMinor })),
    }),
  );

describe('calculateBalances', () => {
  it('AC-BAL-01: single payer split equally', () => {
    const e = expense({
      id: 'e1',
      amountMinor: 10000,
      shares: ['a', 'b', 'c', 'd'].map((memberId) => ({ memberId, amountMinor: 2500 })),
    });
    const result = calculateBalances(['a', 'b', 'c', 'd'], [e]);
    expect(result.map((b) => b.netMinor)).toEqual([7500, -2500, -2500, -2500]);
    expect(result[0]).toEqual({ memberId: 'a', paidMinor: 10000, owedMinor: 2500, netMinor: 7500 });
  });

  it('returns zero balances for members without expenses and for no expenses', () => {
    expect(calculateBalances(['a', 'b'], [])).toEqual([
      { memberId: 'a', paidMinor: 0, owedMinor: 0, netMinor: 0 },
      { memberId: 'b', paidMinor: 0, owedMinor: 0, netMinor: 0 },
    ]);
  });

  it('a payer who is not in the split owes nothing', () => {
    const e = expense({
      id: 'e1',
      paidByMemberId: 'a',
      amountMinor: 100,
      shares: [{ memberId: 'b', amountMinor: 100 }],
    });
    expect(calculateBalances(['a', 'b'], [e]).map((b) => b.netMinor)).toEqual([100, -100]);
  });

  it('throws when the invariant is violated', () => {
    const e = expense({
      id: 'e1',
      amountMinor: 100,
      shares: [{ memberId: 'b', amountMinor: 99 }],
    });
    expect(() => calculateBalances(['a', 'b'], [e])).toThrow(BalanceInvariantError);
  });

  it('throws for an unknown member', () => {
    const e = expense({ id: 'e1', amountMinor: 1, shares: [{ memberId: 'z', amountMinor: 1 }] });
    expect(() => calculateBalances(['a'], [e])).toThrow(/unknown member/);
  });

  it('property: sum of net balances is 0 for consistent expenses', () => {
    const ids = ['m0', 'm1', 'm2', 'm3', 'm4'];
    const rawArb = fc.record({
      payer: fc.constantFrom(...ids),
      shares: fc.array(fc.tuple(fc.constantFrom(...ids), fc.integer({ min: 1, max: 1_000_000 })), {
        minLength: 1,
        maxLength: 8,
      }),
    });
    fc.assert(
      fc.property(fc.array(rawArb, { maxLength: 20 }), (raws) => {
        const expenses = toExpenses(raws);
        const balances = calculateBalances(ids, expenses);
        expect(balances.reduce((acc, b) => acc + b.netMinor, 0)).toBe(0);
        for (const b of balances) expect(b.netMinor).toBe(b.paidMinor - b.owedMinor);
      }),
    );
  });
});

describe('buildStatement', () => {
  const e1 = expense({
    id: 'e1',
    occurredOn: '2026-07-01',
    amountMinor: 10000,
    paidByMemberId: 'a',
    shares: [
      { memberId: 'a', amountMinor: 5000 },
      { memberId: 'b', amountMinor: 5000 },
    ],
  });
  const e2 = expense({
    id: 'e2',
    occurredOn: '2026-07-02',
    currency: 'USD',
    originalAmountMinor: 10000,
    exchangeRate: '5.43250000',
    amountMinor: 54325,
    paidByMemberId: 'b',
    shares: [
      { memberId: 'a', amountMinor: 27163 },
      { memberId: 'b', amountMinor: 27162 },
    ],
  });
  const e3 = expense({
    id: 'e3',
    occurredOn: '2026-07-03',
    amountMinor: 300,
    paidByMemberId: 'b',
    shares: [{ memberId: 'b', amountMinor: 300 }],
  });

  it('AC-BAL-15: lines with running balance and original data', () => {
    const s = buildStatement('a', 'BRL', [e1, e2]);
    expect(s.lines).toEqual([
      {
        expenseId: 'e1',
        description: 'x',
        occurredOn: '2026-07-01',
        original: null,
        paidMinor: 10000,
        owedMinor: 5000,
        netMinor: 5000,
        runningBalanceMinor: 5000,
      },
      {
        expenseId: 'e2',
        description: 'x',
        occurredOn: '2026-07-02',
        original: { currency: 'USD', amountMinor: 10000, exchangeRate: '5.43250000' },
        paidMinor: 0,
        owedMinor: 27163,
        netMinor: -27163,
        runningBalanceMinor: -22163,
      },
    ]);
    expect(s.totals).toEqual({ paidMinor: 10000, owedMinor: 32163, netMinor: -22163 });
  });

  it('skips expenses where the member neither paid nor has a share', () => {
    expect(buildStatement('a', 'BRL', [e1, e3]).lines.map((l) => l.expenseId)).toEqual(['e1']);
  });

  it('a payer-only line has paid and zero owed', () => {
    const e = expense({
      id: 'e',
      amountMinor: 50,
      paidByMemberId: 'a',
      shares: [{ memberId: 'b', amountMinor: 50 }],
    });
    expect(buildStatement('a', 'BRL', [e]).lines[0]).toMatchObject({
      paidMinor: 50,
      owedMinor: 0,
      netMinor: 50,
    });
  });

  it('empty statement', () => {
    expect(buildStatement('a', 'BRL', []).totals).toEqual({
      paidMinor: 0,
      owedMinor: 0,
      netMinor: 0,
    });
  });

  it('property: last running balance equals the member balance', () => {
    const ids = ['m0', 'm1', 'm2'];
    const rawArb = fc.record({
      payer: fc.constantFrom(...ids),
      shares: fc.array(fc.tuple(fc.constantFrom(...ids), fc.integer({ min: 1, max: 100000 })), {
        minLength: 1,
        maxLength: 5,
      }),
    });
    fc.assert(
      fc.property(fc.array(rawArb, { maxLength: 15 }), (raws) => {
        const expenses = toExpenses(raws);
        const balances = calculateBalances(ids, expenses);
        for (const b of balances) {
          const s = buildStatement(b.memberId, 'BRL', expenses);
          expect(s.lines.at(-1)?.runningBalanceMinor ?? 0).toBe(b.netMinor);
          expect(s.totals).toEqual({
            paidMinor: b.paidMinor,
            owedMinor: b.owedMinor,
            netMinor: b.netMinor,
          });
        }
      }),
    );
  });
});

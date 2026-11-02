import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { E2eHarness } from './support/e2e-harness.js';

interface Group {
  id: string;
  status: string;
  members: { id: string; name: string; userId: string | null }[];
}
interface Balances {
  currency: string;
  balances: { name: string; paidMinor: number; owedMinor: number; netMinor: number }[];
}
interface Transfer {
  id: string | null;
  from: { memberId: string; name: string };
  to: { memberId: string; name: string };
  amountMinor: number;
  status: 'PENDING' | 'PAID' | null;
  paidAt: string | null;
}
interface Plan {
  groupId: string;
  currency: string;
  status: 'OPEN' | 'CLOSED';
  transferCount: number;
  totalMovedMinor: number;
  transfers: Transfer[];
}
interface Expense {
  amountMinor: number;
  exchangeRate: string;
  shares: { memberId: string; amountMinor: number; originalAmountMinor: number }[];
}
interface Statement {
  totals: { paidMinor: number; owedMinor: number; netMinor: number };
  lines: {
    description: string;
    paidMinor: number;
    owedMinor: number;
    runningBalanceMinor: number;
    original: { currency: string; amountMinor: number; exchangeRate: string } | null;
  }[];
}

/**
 * The whole product in one scenario. Every expected figure was worked out by hand and is
 * explained in the comments; none of them comes from calling the code under test.
 */
describe('Main flow (e2e)', () => {
  const h = new E2eHarness('main-flow-e2e');

  beforeAll(() => h.start());
  afterAll(() => h.stop());

  it('register, login, group, three split types (one in USD), balances, plan, close, pay', async () => {
    // --- Accounts: ana owns the group, bia is a linked member -------------------------
    await h.signUp('ana');
    await h.signUp('bia');
    const me = await h.as('ana').get('/auth/me').expect(200);
    expect(me.body).toMatchObject({ name: 'ana', email: h.email('ana') });

    // --- Group in BRL: ana (owner, added automatically), bia (linked by e-mail), caio and duda
    const created = await h
      .as('ana')
      .post('/groups')
      .send({
        name: 'Floripa trip',
        baseCurrency: 'BRL',
        members: [{ name: 'bia', email: h.email('bia') }, { name: 'caio' }, { name: 'duda' }],
      })
      .expect(201);
    const group = created.body as Group;
    expect(group.status).toBe('OPEN');
    const id = Object.fromEntries(group.members.map((m) => [m.name, m.id])) as Record<
      string,
      string
    >;
    expect(group.members.find((m) => m.name === 'bia')?.userId).toBe(h.user('bia').id);
    const base = `/groups/${group.id}`;

    const addExpense = async (user: string, body: object): Promise<Expense> =>
      (await h.as(user).post(`${base}/expenses`).send(body).expect(201)).body as Expense;

    // --- E1: EQUAL, BRL 120,00, paid by ana, split by all four: 3000 each ---------------
    const e1 = await addExpense('ana', {
      description: 'Rental house',
      originalAmountMinor: 12000,
      paidByMemberId: id['ana'],
      occurredOn: '2026-07-01',
      split: { type: 'EQUAL', participantIds: [id['ana'], id['bia'], id['caio'], id['duda']] },
    });
    expect(e1.amountMinor).toBe(12000);
    expect(e1.shares.map((x) => x.amountMinor)).toEqual([3000, 3000, 3000, 3000]);

    // --- E2: PERCENTAGE, BRL 200,00, paid by bia: ana 50%, bia 25%, caio 25% -------------
    const e2 = await addExpense('bia', {
      description: 'Groceries',
      originalAmountMinor: 20000,
      paidByMemberId: id['bia'],
      occurredOn: '2026-07-02',
      split: {
        type: 'PERCENTAGE',
        shares: [
          { memberId: id['ana'], basisPoints: 5000 },
          { memberId: id['bia'], basisPoints: 2500 },
          { memberId: id['caio'], basisPoints: 2500 },
        ],
      },
    });
    const byMember = (e: Expense) =>
      Object.fromEntries(e.shares.map((x) => [x.memberId, x.amountMinor]));
    expect(byMember(e2)).toEqual({ [id['ana']!]: 10000, [id['bia']!]: 5000, [id['caio']!]: 5000 });

    // --- E3: FIXED in USD, rate 5.5, paid by caio: duda US$ 30,00, bia US$ 20,00 ---------
    // 5000 cents * 5.5 = 27500 centavos; 3000 * 5.5 = 16500 and 2000 * 5.5 = 11000 (exact).
    const e3 = await addExpense('ana', {
      description: 'Boat tour',
      currency: 'USD',
      exchangeRate: '5.5',
      originalAmountMinor: 5000,
      paidByMemberId: id['caio'],
      occurredOn: '2026-07-03',
      split: {
        type: 'FIXED',
        shares: [
          { memberId: id['duda'], originalAmountMinor: 3000 },
          { memberId: id['bia'], originalAmountMinor: 2000 },
        ],
      },
    });
    expect(e3).toMatchObject({ exchangeRate: '5.50000000', amountMinor: 27500 });
    expect(byMember(e3)).toEqual({ [id['duda']!]: 16500, [id['bia']!]: 11000 });

    // --- E4: EQUAL in USD, rate 5.4325, paid by duda, split by ana, bia, caio ------------
    // US$ 100,00 * 5.4325 = 54325 centavos (the total is converted once). 54325 / 3 =
    // 18108 + 1 left over; every remainder ties, so the smallest memberId takes the extra
    // centavo (RN-EXP-06). Original: 10000 / 3 = 3333 + 1, same rule.
    const e4 = await addExpense('ana', {
      description: 'Dinner',
      currency: 'USD',
      exchangeRate: '5.4325',
      originalAmountMinor: 10000,
      paidByMemberId: id['duda'],
      occurredOn: '2026-07-04',
      split: { type: 'EQUAL', participantIds: [id['ana'], id['bia'], id['caio']] },
    });
    expect(e4.amountMinor).toBe(54325);
    const extraHolder = [id['ana']!, id['bia']!, id['caio']!].sort()[0]!;
    expect(byMember(e4)).toEqual(
      Object.fromEntries(
        ['ana', 'bia', 'caio'].map((n) => [id[n]!, id[n] === extraHolder ? 18109 : 18108]),
      ),
    );
    expect(e4.shares.find((x) => x.memberId === extraHolder)?.originalAmountMinor).toBe(3334);
    expect(e4.shares.reduce((acc, x) => acc + x.originalAmountMinor, 0)).toBe(10000);

    // --- Balances ------------------------------------------------------------------------
    // paid:  ana 12000 | bia 20000 | caio 27500 | duda 54325            (total 113825)
    // owed:  ana 3000+10000+18108 = 31108 | bia 3000+5000+11000+18108 = 37108
    //        caio 3000+5000+18108 = 26108 | duda 3000+16500 = 19500     (+1 to extraHolder)
    const owed: Record<string, number> = { ana: 31108, bia: 37108, caio: 26108, duda: 19500 };
    const paid: Record<string, number> = { ana: 12000, bia: 20000, caio: 27500, duda: 54325 };
    for (const n of Object.keys(owed)) if (id[n] === extraHolder) owed[n]! += 1;
    const expectedNet = Object.fromEntries(Object.keys(owed).map((n) => [n, paid[n]! - owed[n]!]));
    // Without the extra centavo: ana -19108, bia -17108, caio +1392, duda +34825.

    const balances = (await h.as('bia').get(`${base}/balances`).expect(200)).body as Balances;
    expect(balances.currency).toBe('BRL');
    expect(Object.fromEntries(balances.balances.map((b) => [b.name, b.netMinor]))).toEqual(
      expectedNet,
    );
    expect(Object.fromEntries(balances.balances.map((b) => [b.name, b.paidMinor]))).toEqual(paid);
    expect(Object.fromEntries(balances.balances.map((b) => [b.name, b.owedMinor]))).toEqual(owed);
    expect(balances.balances.reduce((acc, b) => acc + b.netMinor, 0)).toBe(0);

    // Statement of duda: chronological lines; E1 (owes 3000), E3 (owes 16500), E4 (paid 54325).
    const statement = (await h.as('bia').get(`${base}/members/${id['duda']}/statement`).expect(200))
      .body as Statement;
    expect(statement.totals).toEqual({ paidMinor: 54325, owedMinor: 19500, netMinor: 34825 });
    expect(
      statement.lines.map((l) => [l.description, l.paidMinor, l.owedMinor, l.runningBalanceMinor]),
    ).toEqual([
      ['Rental house', 0, 3000, -3000],
      ['Boat tour', 0, 16500, -19500],
      ['Dinner', 54325, 0, 34825],
    ]);
    expect(statement.lines[1]?.original).toEqual({
      currency: 'USD',
      amountMinor: 5000,
      exchangeRate: '5.50000000',
    });
    expect(statement.lines[0]?.original).toBeNull();

    // --- Plan (open): calculated on the fly --------------------------------------------
    // Four non-zero balances forming one zero-sum group: at most n - 1 = 3 transfers and
    // none of the proper subsets sums to zero, so exactly 3. Money moved = sum of debts.
    const debts = Object.values(expectedNet)
      .filter((v) => v < 0)
      .reduce((a, v) => a - v, 0);
    const open = (await h.as('bia').get(`${base}/settlement-plan`).expect(200)).body as Plan;
    expect(open).toMatchObject({
      groupId: group.id,
      currency: 'BRL',
      status: 'OPEN',
      transferCount: 3,
      totalMovedMinor: debts,
    });
    expect(
      open.transfers.every((t) => t.id === null && t.status === null && t.paidAt === null),
    ).toBe(true);

    // Applying the transfers settles every balance, and only debtors pay creditors.
    const settle = (plan: Plan): Record<string, number> => {
      const after = { ...expectedNet };
      for (const t of plan.transfers) {
        after[t.from.name]! += t.amountMinor;
        after[t.to.name]! -= t.amountMinor;
        expect(expectedNet[t.from.name]).toBeLessThan(0);
        expect(expectedNet[t.to.name]).toBeGreaterThan(0);
      }
      return after;
    };
    expect(Object.values(settle(open)).every((v) => v === 0)).toBe(true);

    // --- Close (owner only), plan frozen -------------------------------------------------
    await h.as('bia').post(`${base}/close`).expect(403);
    const closed = (await h.as('ana').post(`${base}/close`).expect(200)).body as Plan;
    expect(closed).toMatchObject({ status: 'CLOSED', transferCount: 3, totalMovedMinor: debts });
    expect(closed.transfers.map((t) => [t.from.name, t.to.name, t.amountMinor])).toEqual(
      open.transfers.map((t) => [t.from.name, t.to.name, t.amountMinor]),
    );
    expect(closed.transfers.every((t) => t.status === 'PENDING' && t.paidAt === null && t.id)).toBe(
      true,
    );
    expect(Object.values(settle(closed)).every((v) => v === 0)).toBe(true);
    expect(((await h.as('bia').get(base).expect(200)).body as Group).status).toBe('CLOSED');

    // Writes are now rejected.
    const late = await h
      .as('ana')
      .post(`${base}/expenses`)
      .send({
        description: 'Late',
        originalAmountMinor: 100,
        paidByMemberId: id['ana'],
        occurredOn: '2026-07-05',
        split: { type: 'EQUAL', participantIds: [id['ana'], id['bia']] },
      })
      .expect(409);
    expect(late.body).toMatchObject({ code: 'GROUP_CLOSED' });

    // --- Pay a transfer (linked member), idempotently ------------------------------------
    const transfer = closed.transfers[0]!;
    const first = await h.as('bia').patch(`${base}/transfers/${transfer.id}/pay`).expect(200);
    expect(first.body).toMatchObject({
      id: transfer.id,
      status: 'PAID',
      amountMinor: transfer.amountMinor,
    });
    const paidAt = (first.body as Transfer).paidAt;
    expect(paidAt).toEqual(expect.any(String));
    const second = await h.as('ana').patch(`${base}/transfers/${transfer.id}/pay`).expect(200);
    expect((second.body as Transfer).paidAt).toBe(paidAt);

    const final = (await h.as('bia').get(`${base}/settlement-plan`).expect(200)).body as Plan;
    expect(final.transfers.map((t) => t.status).sort()).toEqual(['PAID', 'PENDING', 'PENDING']);
    // Paying never changes the expense balances.
    const after = (await h.as('bia').get(`${base}/balances`).expect(200)).body as Balances;
    expect(Object.fromEntries(after.balances.map((b) => [b.name, b.netMinor]))).toEqual(
      expectedNet,
    );
  });
});

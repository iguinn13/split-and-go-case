import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { E2eHarness } from './support/e2e-harness.js';

interface Member {
    id: string;
    name: string;
}
interface Group {
    id: string;
    members: Member[];
}
interface Expense {
    id: string;
    amountMinor: number;
    exchangeRate: string;
    shares: { memberId: string; amountMinor: number; originalAmountMinor: number }[];
}
interface Balances {
    currency: string;
    balances: { name: string; netMinor: number }[];
}
interface Plan {
    currency: string;
    transferCount: number;
    totalMovedMinor: number;
    transfers: { from: { name: string }; to: { name: string }; amountMinor: number }[];
}

/**
 * Scenarios of docs/engineering/edge-cases.md (numbers 12 to 17 and 19 to 27) that need the
 * whole stack. Items whose scenario is already asserted exactly in another e2e file are
 * listed in the comment at the bottom instead of being duplicated here.
 */
describe('Edge cases (e2e)', () => {
    const h = new E2eHarness('edge-cases-e2e');

    beforeAll(async () => {
        await h.start();
        await h.signUp('ana');
    });
    afterAll(() => h.stop());

    async function makeGroup(
        names: string[],
        baseCurrency = 'BRL',
    ): Promise<{ id: string; m: Record<string, string> }> {
        const res = await h
            .as('ana')
            .post('/groups')
            .send({
                name: 'Edge',
                baseCurrency,
                members: names.slice(1).map((name) => ({ name })),
            })
            .expect(201);
        const group = res.body as Group;

        return { id: group.id, m: Object.fromEntries(group.members.map((x) => [x.name, x.id])) };
    }

    const expense = (body: object) => ({
        description: 'Expense',
        occurredOn: '2026-07-10',
        ...body,
    });
    const create = (groupId: string, body: object) =>
        h.as('ana').post(`/groups/${groupId}/expenses`).send(expense(body));

    describe('12 and 13: members', () => {
        it('12: a member that appears in an expense cannot be removed until the expense is gone', async () => {
            const { id, m } = await makeGroup(['ana', 'bia', 'caio']);
            const e = (
                await create(id, {
                    originalAmountMinor: 3000,
                    paidByMemberId: m['ana'],
                    split: { type: 'EQUAL', participantIds: [m['ana'], m['bia']] },
                }).expect(201)
            ).body as Expense;
            const denied = await h
                .as('ana')
                .delete(`/groups/${id}/members/${m['bia']}`)
                .expect(409);

            expect(denied.body).toMatchObject({ code: 'MEMBER_HAS_EXPENSES' });
            // caio never took part in an expense, so he can go.
            await h.as('ana').delete(`/groups/${id}/members/${m['caio']}`).expect(204);
            await h.as('ana').delete(`/groups/${id}/expenses/${e.id}`).expect(204);
            await h.as('ana').delete(`/groups/${id}/members/${m['bia']}`).expect(204);
        });

        it('13: a member of another group cannot be payer or participant, and nothing is stored', async () => {
            const mine = await makeGroup(['ana', 'bia']);
            const other = await makeGroup(['ana', 'zeca']);

            for (const body of [
                {
                    paidByMemberId: mine.m['ana'],
                    split: { type: 'EQUAL', participantIds: [mine.m['ana'], other.m['zeca']] },
                },
                {
                    paidByMemberId: other.m['zeca'],
                    split: { type: 'EQUAL', participantIds: [mine.m['ana']] },
                },
                {
                    paidByMemberId: mine.m['ana'],
                    split: {
                        type: 'FIXED',
                        shares: [{ memberId: other.m['zeca'], originalAmountMinor: 1000 }],
                    },
                },
            ]) {
                const res = await create(mine.id, { originalAmountMinor: 1000, ...body }).expect(
                    422,
                );

                expect(res.body).toMatchObject({ code: 'INVALID_SPLIT_PARTICIPANTS' });
            }

            const list = await h.as('ana').get(`/groups/${mine.id}/expenses`).expect(200);

            expect((list.body as { total: number }).total).toBe(0);
        });
    });

    describe('19 to 26: currencies', () => {
        it('19: 10 x 157.25 = 1572.5 yen rounds half up to 1573, every time; 1572.49 rounds down', async () => {
            const { id, m } = await makeGroup(['ana', 'bia'], 'JPY');
            const body = (exchangeRate: string) => ({
                currency: 'USD',
                exchangeRate,
                originalAmountMinor: 1000, // US$ 10,00
                paidByMemberId: m['ana'],
                split: { type: 'EQUAL', participantIds: [m['ana'], m['bia']] },
            });

            for (let i = 0; i < 3; i++) {
                expect(
                    ((await create(id, body('157.25')).expect(201)).body as Expense).amountMinor,
                ).toBe(1573);
            }

            expect(
                ((await create(id, body('157.249')).expect(201)).body as Expense).amountMinor,
            ).toBe(1572);
        });

        it('20: US$ 100 / 3 at 5.4325 converts the total once: 18109 + 18108 + 18108 = 54325, balances sum to 0', async () => {
            const { id, m } = await makeGroup(['ana', 'bia', 'caio']);
            const e = (
                await create(id, {
                    currency: 'USD',
                    exchangeRate: '5.4325',
                    originalAmountMinor: 10000,
                    paidByMemberId: m['ana'],
                    split: { type: 'EQUAL', participantIds: Object.values(m) },
                }).expect(201)
            ).body as Expense;

            expect(e.amountMinor).toBe(54325);
            expect(e.shares.map((x) => x.amountMinor).sort()).toEqual([18108, 18108, 18109]);
            // Converting each third separately would give 3333.33 * 5.4325 = 18108.33 -> 18108 x 3 = 54324.
            const b = (await h.as('ana').get(`/groups/${id}/balances`).expect(200))
                .body as Balances;

            expect(b.balances.reduce((acc, x) => acc + x.netMinor, 0)).toBe(0);
            expect(b.balances.find((x) => x.name === 'ana')!.netMinor).toBe(
                54325 - e.shares.find((x) => x.memberId === m['ana'])!.amountMinor,
            );
        });

        it('20: percentage and fixed splits in a foreign currency also add up to the converted total', async () => {
            const { id, m } = await makeGroup(['ana', 'bia', 'caio']);
            const pct = (
                await create(id, {
                    currency: 'USD',
                    exchangeRate: '5.4325',
                    originalAmountMinor: 10001,
                    paidByMemberId: m['ana'],
                    split: {
                        type: 'PERCENTAGE',
                        shares: [
                            { memberId: m['ana'], basisPoints: 3333 },
                            { memberId: m['bia'], basisPoints: 3333 },
                            { memberId: m['caio'], basisPoints: 3334 },
                        ],
                    },
                }).expect(201)
            ).body as Expense;

            // 10001 * 5.4325 = 54330.4325 -> 54330
            expect(pct.amountMinor).toBe(54330);
            expect(pct.shares.reduce((acc, x) => acc + x.amountMinor, 0)).toBe(54330);
            expect(pct.shares.reduce((acc, x) => acc + x.originalAmountMinor, 0)).toBe(10001);
            const fixed = (
                await create(id, {
                    currency: 'USD',
                    exchangeRate: '5.4325',
                    originalAmountMinor: 10000,
                    paidByMemberId: m['ana'],
                    split: {
                        type: 'FIXED',
                        shares: [
                            { memberId: m['ana'], originalAmountMinor: 3333 },
                            { memberId: m['bia'], originalAmountMinor: 3333 },
                            { memberId: m['caio'], originalAmountMinor: 3334 },
                        ],
                    },
                }).expect(201)
            ).body as Expense;

            expect(fixed.amountMinor).toBe(54325);
            expect(fixed.shares.reduce((acc, x) => acc + x.amountMinor, 0)).toBe(54325);
        });

        it('23: the exchange-rate provider being down does not block recording an expense', async () => {
            const { id, m } = await makeGroup(['ana', 'bia']);

            h.fx.failing = true;
            const callsBefore = h.fx.calls.length;

            try {
                const suggestion = await h
                    .as('ana')
                    .get('/exchange-rates?from=USD&to=BRL')
                    .expect(503);

                expect(suggestion.body).toMatchObject({ code: 'EXCHANGE_RATE_UNAVAILABLE' });
                const created = (
                    await create(id, {
                        currency: 'USD',
                        exchangeRate: '5.5',
                        originalAmountMinor: 1000,
                        paidByMemberId: m['ana'],
                        split: { type: 'EQUAL', participantIds: Object.values(m) },
                    }).expect(201)
                ).body as Expense;

                expect(created.amountMinor).toBe(5500);
                // Only the suggestion endpoint asked the provider, the expense never did.
                expect(h.fx.calls.length - callsBefore).toBe(1);
            } finally {
                h.fx.failing = false;
            }
        });

        it('24: a foreign amount that converts to less than one minor unit is rejected; half a unit rounds up', async () => {
            const { id, m } = await makeGroup(['ana', 'bia']);
            const body = (exchangeRate: string) => ({
                currency: 'JPY',
                exchangeRate,
                originalAmountMinor: 1, // JPY 1
                paidByMemberId: m['ana'],
                split: { type: 'EQUAL', participantIds: Object.values(m) },
            });
            // 1 yen * 0.001 = R$ 0,001 = 0.1 centavo -> 0
            const res = await create(id, body('0.001')).expect(422);

            expect(res.body).toMatchObject({ code: 'AMOUNT_OUT_OF_RANGE' });
            // 1 yen * 0.005 = 0.5 centavo -> rounds half up to 1
            expect(
                ((await create(id, body('0.005')).expect(201)).body as Expense).amountMinor,
            ).toBe(1);
            const list = await h.as('ana').get(`/groups/${id}/expenses`).expect(200);

            expect((list.body as { total: number }).total).toBe(1);
        });

        it('25: an unsupported currency is a VALIDATION_ERROR on groups, expenses and the rate suggestion', async () => {
            const { id, m } = await makeGroup(['ana', 'bia']);
            const group = await h
                .as('ana')
                .post('/groups')
                .send({ name: 'Bad', baseCurrency: 'XYZ' });
            const exp = await create(id, {
                currency: 'XYZ',
                exchangeRate: '1',
                originalAmountMinor: 1000,
                paidByMemberId: m['ana'],
                split: { type: 'EQUAL', participantIds: Object.values(m) },
            });
            const rate = await h.as('ana').get('/exchange-rates?from=XYZ&to=BRL');

            for (const res of [group, exp, rate]) {
                expect(res.status).toBe(422);
                expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
            }
        });

        it('26: yen base group with a US$ expense: 10 USD x 157.25 = 1573 yen, balances and plan in whole yen', async () => {
            const { id, m } = await makeGroup(['ana', 'bia', 'caio', 'duda'], 'JPY');
            const e = (
                await create(id, {
                    currency: 'USD',
                    exchangeRate: '157.25',
                    originalAmountMinor: 1000,
                    paidByMemberId: m['ana'],
                    // Ana pays but does not share: the others owe 1573 / 3 = 524 + 1 leftover.
                    split: { type: 'EQUAL', participantIds: [m['bia'], m['caio'], m['duda']] },
                }).expect(201)
            ).body as Expense;

            expect(e.amountMinor).toBe(1573);
            expect(e.shares.map((x) => x.amountMinor).sort()).toEqual([524, 524, 525]);

            const b = (await h.as('ana').get(`/groups/${id}/balances`).expect(200))
                .body as Balances;

            expect(b.currency).toBe('JPY');
            expect(b.balances.find((x) => x.name === 'ana')!.netMinor).toBe(1573);
            expect(b.balances.map((x) => x.netMinor).sort((x, y) => x - y)).toEqual([
                -525, -524, -524, 1573,
            ]);

            const plan = (await h.as('ana').get(`/groups/${id}/settlement-plan`).expect(200))
                .body as Plan;

            expect(plan).toMatchObject({
                currency: 'JPY',
                transferCount: 3,
                totalMovedMinor: 1573,
            });
            expect(plan.transfers.every((t) => t.to.name === 'ana')).toBe(true);
            expect(plan.transfers.map((t) => t.amountMinor).sort()).toEqual([524, 524, 525]);
        });
    });

    describe('27: base currency', () => {
        it('stays unchanged after expenses exist, and the figures stay in that currency', async () => {
            const { id, m } = await makeGroup(['ana', 'bia']);

            await create(id, {
                originalAmountMinor: 1000,
                paidByMemberId: m['ana'],
                split: { type: 'EQUAL', participantIds: Object.values(m) },
            }).expect(201);
            const res = await h
                .as('ana')
                .patch(`/groups/${id}`)
                .send({ baseCurrency: 'USD' })
                .expect(422);

            expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
            const group = (await h.as('ana').get(`/groups/${id}`).expect(200)).body as {
                baseCurrency: string;
            };

            expect(group.baseCurrency).toBe('BRL');
            const b = (await h.as('ana').get(`/groups/${id}/balances`).expect(200))
                .body as Balances;

            expect(b).toMatchObject({ currency: 'BRL' });
            expect(b.balances.find((x) => x.name === 'ana')!.netMinor).toBe(500);
        });
    });
});

/*
 * Edge cases of the 12 to 17 and 19 to 27 range whose exact scenario already has an e2e test
 * in another file (kept there, not duplicated):
 *   14  settlements.e2e-spec.ts   "AC-BAL-14" tests (writers racing the close, FOR UPDATE, pool starvation)
 *   15  settlements.e2e-spec.ts   "AC-BAL-13: closing without debts gives an empty plan"
 *   16  settlements.e2e-spec.ts   "AC-BAL-09, AC-BAL-11, AC-BAL-12" (second pay keeps paidAt)
 *   17  expenses.e2e-spec.ts      "AC-EXP-13: closed group rejects create, edit and delete"
 *   21  expenses.e2e-spec.ts      "AC-CUR-05/06/07: exchange rate rules"
 *   22  expenses.e2e-spec.ts      "AC-CUR-05/06/07: exchange rate rules" (same currency with rate 2)
 */

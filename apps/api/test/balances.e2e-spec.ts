import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { cleanupEmailDomain } from './support/e2e-harness.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

interface GroupBody {
    id: string;
    members: { id: string; name: string }[];
}
interface BalancesBody {
    currency: string;
    balances: {
        memberId: string;
        name: string;
        paidMinor: number;
        owedMinor: number;
        netMinor: number;
    }[];
}
interface StatementBody {
    currency: string;
    member: { id: string; name: string };
    totals: { paidMinor: number; owedMinor: number; netMinor: number };
    lines: {
        expenseId: string;
        original: { currency: string; amountMinor: number; exchangeRate: string } | null;
        amountMinor: number;
        paidMinor: number;
        owedMinor: number;
        netMinor: number;
        runningBalanceMinor: number;
    }[];
}

describe('Balances (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    const domain = `-${Date.now()}@balances-e2e.dev`;
    const server = (): Server => app.getHttpServer() as Server;
    const tokens: Record<string, string> = {};

    async function signUp(name: string): Promise<void> {
        const email = `${name}${domain}`;

        await request(server())
            .post('/auth/register')
            .send({ name, email, password: 'password-123' })
            .expect(201);
        const login = await request(server())
            .post('/auth/login')
            .send({ email, password: 'password-123' })
            .expect(200);

        tokens[name] = (login.body as { accessToken: string }).accessToken;
    }

    const get = (user: string, url: string) =>
        request(server())
            .get(url)
            .set({ Authorization: `Bearer ${tokens[user]}` });

    async function makeGroup(
        names: string[],
    ): Promise<{ group: GroupBody; m: Record<string, string> }> {
        const res = await request(server())
            .post('/groups')
            .set({ Authorization: `Bearer ${tokens['ana']}` })
            .send({
                name: 'Trip',
                baseCurrency: 'BRL',
                members: names.slice(1).map((name) => ({ name, email: `${name}${domain}` })),
            })
            .expect(201);
        const group = res.body as GroupBody;

        return { group, m: Object.fromEntries(group.members.map((x) => [x.name, x.id])) };
    }

    async function addExpense(groupId: string, body: object): Promise<void> {
        await request(server())
            .post(`/groups/${groupId}/expenses`)
            .set({ Authorization: `Bearer ${tokens['ana']}` })
            .send({ description: 'Dinner', occurredOn: '2026-07-10', ...body })
            .expect(201);
    }

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

        app = moduleRef.createNestApplication();
        await app.init();
        prisma = app.get(PrismaService);

        for (const name of ['ana', 'bia', 'caio', 'duda', 'stranger']) await signUp(name);
    });

    afterAll(async () => {
        await cleanupEmailDomain(prisma, domain);
        await app.close();
    });

    it('requires authentication', async () => {
        await request(server()).get(`/groups/${crypto.randomUUID()}/balances`).expect(401);
    });

    it('AC-BAL-01: basic balance', async () => {
        const { group, m } = await makeGroup(['ana', 'bia', 'caio', 'duda']);

        await addExpense(group.id, {
            originalAmountMinor: 10000,
            paidByMemberId: m['ana'],
            split: { type: 'EQUAL', participantIds: Object.values(m) },
        });
        const res = await get('bia', `/groups/${group.id}/balances`).expect(200);
        const body = res.body as BalancesBody;

        expect(body.currency).toBe('BRL');
        const net = Object.fromEntries(body.balances.map((b) => [b.name, b.netMinor]));

        expect(net).toEqual({ ana: 7500, bia: -2500, caio: -2500, duda: -2500 });
        expect(body.balances.reduce((acc, b) => acc + b.netMinor, 0)).toBe(0);
        expect(body.balances.find((b) => b.name === 'ana')).toMatchObject({
            paidMinor: 10000,
            owedMinor: 2500,
        });
    });

    it('AC-BAL-02: several expenses, mixed splits', async () => {
        const { group, m } = await makeGroup(['ana', 'bia', 'caio']);
        const all = Object.values(m);

        await addExpense(group.id, {
            originalAmountMinor: 9000,
            paidByMemberId: m['ana'],
            split: { type: 'EQUAL', participantIds: all },
        });
        await addExpense(group.id, {
            originalAmountMinor: 5000,
            paidByMemberId: m['bia'],
            split: {
                type: 'PERCENTAGE',
                shares: [
                    { memberId: m['ana'], basisPoints: 2000 },
                    { memberId: m['caio'], basisPoints: 8000 },
                ],
            },
        });
        await addExpense(group.id, {
            originalAmountMinor: 3000,
            paidByMemberId: m['caio'],
            split: {
                type: 'FIXED',
                shares: [
                    { memberId: m['ana'], originalAmountMinor: 1000 },
                    { memberId: m['bia'], originalAmountMinor: 2000 },
                ],
            },
        });
        const body = (await get('ana', `/groups/${group.id}/balances`).expect(200))
            .body as BalancesBody;
        // ana: paid 9000, owes 3000+1000+1000; bia: paid 5000, owes 3000+2000;
        // caio: paid 3000, owes 3000+4000
        const net = Object.fromEntries(body.balances.map((b) => [b.name, b.netMinor]));

        expect(net).toEqual({ ana: 4000, bia: 0, caio: -4000 });

        for (const b of body.balances) expect(b.netMinor).toBe(b.paidMinor - b.owedMinor);
    });

    it('AC-BAL-03 and AC-BAL-15: statement and mixed currencies', async () => {
        const { group, m } = await makeGroup(['ana', 'bia']);
        const ids = [m['ana'], m['bia']];

        await addExpense(group.id, {
            originalAmountMinor: 10000,
            paidByMemberId: m['ana'],
            occurredOn: '2026-07-01',
            split: { type: 'EQUAL', participantIds: ids },
        });
        await addExpense(group.id, {
            originalAmountMinor: 10000,
            currency: 'USD',
            exchangeRate: '5.4325',
            paidByMemberId: m['bia'],
            occurredOn: '2026-07-02',
            split: { type: 'EQUAL', participantIds: ids },
        });
        // The odd cent of the USD split goes to the lowest memberId (RN-SPL tie-break), so the
        // expected figures of AC-BAL-15 depend on the order of the random member ids.
        const anaFirst = m['ana']! < m['bia']!;
        const anaOwes = anaFirst ? 27163 : 27162;
        const anaNet = 10000 - 5000 - anaOwes;
        const balances = (await get('ana', `/groups/${group.id}/balances`).expect(200))
            .body as BalancesBody;

        expect(Object.fromEntries(balances.balances.map((b) => [b.name, b.netMinor]))).toEqual({
            ana: anaNet,
            bia: -anaNet,
        });

        const res = await get('bia', `/groups/${group.id}/members/${m['ana']}/statement`).expect(
            200,
        );
        const s = res.body as StatementBody;

        expect(s.currency).toBe('BRL');
        expect(s.member).toEqual({ id: m['ana'], name: 'ana' });
        expect(s.lines.map((l) => l.runningBalanceMinor)).toEqual([5000, anaNet]);
        expect(s.lines[0]).toMatchObject({
            original: null,
            amountMinor: 10000,
            paidMinor: 10000,
            owedMinor: 5000,
        });
        expect(s.lines[1]).toMatchObject({
            original: { currency: 'USD', amountMinor: 10000, exchangeRate: '5.43250000' },
            amountMinor: 54325,
            paidMinor: 0,
            owedMinor: anaOwes,
            netMinor: -anaOwes,
        });
        expect(s.lines.at(-1)!.runningBalanceMinor).toBe(s.totals.netMinor);
        expect(s.totals.netMinor).toBe(anaNet);
    });

    it('statement lines expose the persisted converted total (payer, participant, odd cents)', async () => {
        const { group, m } = await makeGroup(['ana', 'bia', 'caio']);
        const all = [m['ana'], m['bia'], m['caio']];

        // Base currency: amountMinor equals the original amount; caio is only a participant.
        await addExpense(group.id, {
            originalAmountMinor: 9999,
            paidByMemberId: m['ana'],
            occurredOn: '2026-07-01',
            split: { type: 'EQUAL', participantIds: all },
        });
        // USD 33.33 at 5.4325 = 18106.5225 -> 18107 converted (odd cents over 3 participants).
        await addExpense(group.id, {
            originalAmountMinor: 3333,
            currency: 'USD',
            exchangeRate: '5.4325',
            paidByMemberId: m['bia'],
            occurredOn: '2026-07-02',
            split: { type: 'EQUAL', participantIds: all },
        });
        // EUR 10.01 at 6.1 = 61.061 -> 6106 converted; the payer ana is not in the split.
        await addExpense(group.id, {
            originalAmountMinor: 1001,
            currency: 'EUR',
            exchangeRate: '6.1',
            paidByMemberId: m['ana'],
            occurredOn: '2026-07-03',
            split: { type: 'EQUAL', participantIds: [m['bia'], m['caio']] },
        });
        const persisted = await prisma.expense.findMany({
            where: { groupId: group.id },
            orderBy: { occurredOn: 'asc' },
            select: { id: true, amountMinor: true },
        });

        expect(persisted.map((p) => p.amountMinor)).toEqual([9999, 18107, 6106]);

        for (const who of ['ana', 'bia', 'caio']) {
            const res = await get('ana', `/groups/${group.id}/members/${m[who]}/statement`).expect(
                200,
            );
            const s = res.body as StatementBody;

            expect(s.lines.map((l) => [l.expenseId, l.amountMinor])).toEqual(
                persisted.map((p) => [p.id, p.amountMinor]),
            );
        }

        const caio = (await get('ana', `/groups/${group.id}/members/${m['caio']}/statement`))
            .body as StatementBody;

        expect(caio.lines.map((l) => l.paidMinor)).toEqual([0, 0, 0]);
    });

    it('hides the group from strangers and reports unknown members', async () => {
        const { group, m } = await makeGroup(['ana', 'bia']);
        const missing = crypto.randomUUID();

        for (const url of [
            `/groups/${group.id}/balances`,
            `/groups/${group.id}/members/${m['ana']}/statement`,
        ]) {
            const res = await get('stranger', url).expect(404);

            expect((res.body as { code: string }).code).toBe('GROUP_NOT_FOUND');
        }

        const res = await get('ana', `/groups/${group.id}/members/${missing}/statement`).expect(
            404,
        );

        expect((res.body as { code: string }).code).toBe('MEMBER_NOT_FOUND');
        await get('ana', `/groups/${group.id}/members/not-a-uuid/statement`).expect(422);
    });

    it('responds 500 INTERNAL_ERROR when the zero-sum invariant is violated', async () => {
        const { group, m } = await makeGroup(['ana', 'bia']);

        await addExpense(group.id, {
            originalAmountMinor: 10000,
            paidByMemberId: m['ana'],
            split: { type: 'EQUAL', participantIds: [m['ana'], m['bia']] },
        });
        // Corrupt the data directly: a share that no longer matches the expense amount.
        await prisma.expenseShare.updateMany({
            where: { memberId: m['bia'], expense: { groupId: group.id } },
            data: { amountMinor: 1 },
        });
        const res = await get('ana', `/groups/${group.id}/balances`).expect(500);

        expect((res.body as { code: string }).code).toBe('INTERNAL_ERROR');
        await get('ana', `/groups/${group.id}/members/${m['ana']}/statement`).expect(500);
    });
});

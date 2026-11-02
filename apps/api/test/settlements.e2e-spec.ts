import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { ExpensesService } from '../src/modules/expenses/expenses.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

interface GroupBody {
  id: string;
  members: { id: string; name: string }[];
}
interface TransferBody {
  id: string | null;
  from: { memberId: string; name: string };
  to: { memberId: string; name: string };
  amountMinor: number;
  status: 'PENDING' | 'PAID' | null;
  paidAt: string | null;
}
interface PlanBody {
  groupId: string;
  currency: string;
  status: 'OPEN' | 'CLOSED';
  transferCount: number;
  totalMovedMinor: number;
  transfers: TransferBody[];
}

describe('Settlements (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const domain = `-${Date.now()}@settlements-e2e.dev`;
  const server = (): Server => app.getHttpServer() as Server;
  const tokens: Record<string, string> = {};
  const auth = (user: string) => ({ Authorization: `Bearer ${tokens[user]}` });

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
  const get = (user: string, url: string) => request(server()).get(url).set(auth(user));
  const post = (user: string, url: string) => request(server()).post(url).set(auth(user));
  const pay = (user: string, groupId: string, transferId: string) =>
    request(server()).patch(`/groups/${groupId}/transfers/${transferId}/pay`).set(auth(user));

  async function makeGroup(
    names: string[],
  ): Promise<{ group: GroupBody; m: Record<string, string> }> {
    const res = await request(server())
      .post('/groups')
      .set(auth('ana'))
      .send({
        name: 'Trip',
        baseCurrency: 'BRL',
        members: names.slice(1).map((name) => ({ name, email: `${name}${domain}` })),
      })
      .expect(201);
    const group = res.body as GroupBody;
    return { group, m: Object.fromEntries(group.members.map((x) => [x.name, x.id])) };
  }
  const expenseBody = (body: object) => ({
    description: 'Dinner',
    occurredOn: '2026-07-10',
    ...body,
  });
  async function addExpense(groupId: string, body: object): Promise<void> {
    await request(server())
      .post(`/groups/${groupId}/expenses`)
      .set(auth('ana'))
      .send(expenseBody(body))
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
    const where = { group: { owner: { email: { endsWith: domain } } } };
    await prisma.settlementTransfer.deleteMany({ where });
    await prisma.expenseShare.deleteMany({ where: { expense: where } });
    await prisma.expense.deleteMany({ where });
    await prisma.groupMember.deleteMany({ where });
    await prisma.group.deleteMany({ where: { owner: { email: { endsWith: domain } } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: domain } } });
    await app.close();
  });

  it('requires authentication', async () => {
    const id = crypto.randomUUID();
    await request(server()).get(`/groups/${id}/settlement-plan`).expect(401);
    await request(server()).post(`/groups/${id}/close`).expect(401);
    await request(server()).patch(`/groups/${id}/transfers/${id}/pay`).expect(401);
  });

  it('returns the plan calculated on the fly while the group is open', async () => {
    const { group, m } = await makeGroup(['ana', 'bia', 'caio', 'duda']);
    await addExpense(group.id, {
      originalAmountMinor: 10000,
      paidByMemberId: m['ana'],
      split: { type: 'EQUAL', participantIds: Object.values(m) },
    });
    const res = await get('bia', `/groups/${group.id}/settlement-plan`).expect(200);
    const body = res.body as PlanBody;
    expect(body).toMatchObject({
      groupId: group.id,
      currency: 'BRL',
      status: 'OPEN',
      transferCount: 3,
      totalMovedMinor: 7500,
    });
    for (const t of body.transfers) {
      expect(t).toMatchObject({ id: null, status: null, paidAt: null, amountMinor: 2500 });
      expect(t.to.name).toBe('ana');
    }
    const again = await get('bia', `/groups/${group.id}/settlement-plan`).expect(200);
    expect(again.body).toEqual(body);
    await get('stranger', `/groups/${group.id}/settlement-plan`).expect(404);
  });

  it('plans in the base currency with multi-currency expenses (AC-BAL-15)', async () => {
    const { group, m } = await makeGroup(['ana', 'bia']);
    const both = [m['ana'], m['bia']];
    await addExpense(group.id, {
      originalAmountMinor: 10000,
      paidByMemberId: m['ana'],
      split: { type: 'EQUAL', participantIds: both },
    });
    await addExpense(group.id, {
      currency: 'USD',
      exchangeRate: '5.4325',
      originalAmountMinor: 10000,
      paidByMemberId: m['bia'],
      split: { type: 'EQUAL', participantIds: both },
    });
    const body = (await get('ana', `/groups/${group.id}/settlement-plan`).expect(200))
      .body as PlanBody;
    // The odd cent of the USD split goes to the lowest memberId, so the direction and the
    // amount of AC-BAL-15 depend on the order of the random member ids.
    const anaFirst = m['ana']! < m['bia']!;
    const anaNet = 10000 - 5000 - (anaFirst ? 27163 : 27162);
    expect(body.transfers).toHaveLength(1);
    expect(body.transfers[0]).toMatchObject({
      from: { name: anaNet < 0 ? 'ana' : 'bia' },
      to: { name: anaNet < 0 ? 'bia' : 'ana' },
      amountMinor: Math.abs(anaNet),
    });
  });

  it('AC-BAL-09, AC-BAL-11, AC-BAL-12: close, frozen plan and idempotent payment', async () => {
    const { group, m } = await makeGroup(['ana', 'bia', 'caio']);
    await addExpense(group.id, {
      originalAmountMinor: 9000,
      paidByMemberId: m['ana'],
      split: { type: 'EQUAL', participantIds: Object.values(m) },
    });
    const closed = (await post('ana', `/groups/${group.id}/close`).expect(200)).body as PlanBody;
    expect(closed).toMatchObject({ status: 'CLOSED', transferCount: 2, totalMovedMinor: 6000 });
    for (const t of closed.transfers) {
      expect(t.id).toEqual(expect.any(String));
      expect(t).toMatchObject({ status: 'PENDING', paidAt: null, amountMinor: 3000 });
    }
    const row = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
    expect(row.status).toBe('CLOSED');
    expect(row.closedAt).not.toBeNull();

    const frozen = (await get('caio', `/groups/${group.id}/settlement-plan`).expect(200))
      .body as PlanBody;
    expect(frozen).toEqual(closed);

    const transferId = closed.transfers[0]!.id!;
    const first = (await pay('bia', group.id, transferId).expect(200)).body as TransferBody;
    expect(first).toMatchObject({ id: transferId, status: 'PAID' });
    expect(first.paidAt).toEqual(expect.any(String));
    const second = (await pay('caio', group.id, transferId).expect(200)).body as TransferBody;
    expect(second.status).toBe('PAID');
    expect(second.paidAt).toBe(first.paidAt);

    const after = (await get('ana', `/groups/${group.id}/settlement-plan`).expect(200))
      .body as PlanBody;
    expect(after.transfers.map((t) => t.status).sort()).toEqual(['PAID', 'PENDING']);

    await pay('stranger', group.id, transferId).expect(404);
    await pay('ana', group.id, crypto.randomUUID()).expect(404);
    const other = await makeGroup(['ana', 'bia']);
    const res = await pay('ana', other.group.id, transferId).expect(409);
    expect((res.body as { code: string }).code).toBe('GROUP_NOT_CLOSED');
  });

  it('GROUP_NOT_CLOSED vs TRANSFER_NOT_FOUND on a closed group', async () => {
    const { group } = await makeGroup(['ana', 'bia']);
    await post('ana', `/groups/${group.id}/close`).expect(200);
    const res = await pay('ana', group.id, crypto.randomUUID()).expect(404);
    expect((res.body as { code: string }).code).toBe('TRANSFER_NOT_FOUND');
    await pay('ana', 'not-a-uuid', 'x').expect(422);
  });

  it('AC-BAL-10: a non-owner cannot close and nothing changes', async () => {
    const { group, m } = await makeGroup(['ana', 'bia']);
    await addExpense(group.id, {
      originalAmountMinor: 1000,
      paidByMemberId: m['ana'],
      split: { type: 'EQUAL', participantIds: Object.values(m) },
    });
    const res = await post('bia', `/groups/${group.id}/close`).expect(403);
    expect((res.body as { code: string }).code).toBe('FORBIDDEN');
    await post('stranger', `/groups/${group.id}/close`).expect(404);
    const row = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
    expect(row).toMatchObject({ status: 'OPEN', closedAt: null });
    expect(await prisma.settlementTransfer.count({ where: { groupId: group.id } })).toBe(0);
  });

  it('AC-BAL-13: closing without debts gives an empty plan; closing again is GROUP_CLOSED', async () => {
    const empty = await makeGroup(['ana', 'bia']);
    const body = (await post('ana', `/groups/${empty.group.id}/close`).expect(200))
      .body as PlanBody;
    expect(body).toMatchObject({ status: 'CLOSED', transferCount: 0, totalMovedMinor: 0 });
    expect(body.transfers).toEqual([]);
    const again = await post('ana', `/groups/${empty.group.id}/close`).expect(409);
    expect((again.body as { code: string }).code).toBe('GROUP_CLOSED');

    // Cycle: every balance is zero.
    const { group, m } = await makeGroup(['ana', 'bia', 'caio']);
    const pairs: [string, string][] = [
      ['ana', 'bia'],
      ['bia', 'caio'],
      ['caio', 'ana'],
    ];
    for (const [payer, debtor] of pairs) {
      await request(server())
        .post(`/groups/${group.id}/expenses`)
        .set(auth('ana'))
        .send(
          expenseBody({
            originalAmountMinor: 3000,
            paidByMemberId: m[payer],
            split: { type: 'FIXED', shares: [{ memberId: m[debtor], originalAmountMinor: 3000 }] },
          }),
        )
        .expect(201);
    }
    const cycle = (await post('ana', `/groups/${group.id}/close`).expect(200)).body as PlanBody;
    expect(cycle).toMatchObject({ status: 'CLOSED', transferCount: 0 });
  });

  it('rejects expense writes after closing', async () => {
    const { group, m } = await makeGroup(['ana', 'bia']);
    await post('ana', `/groups/${group.id}/close`).expect(200);
    const res = await request(server())
      .post(`/groups/${group.id}/expenses`)
      .set(auth('ana'))
      .send(
        expenseBody({
          originalAmountMinor: 1000,
          paidByMemberId: m['ana'],
          split: { type: 'EQUAL', participantIds: Object.values(m) },
        }),
      );
    expect(res.status).toBe(409);
    expect((res.body as { code: string }).code).toBe('GROUP_CLOSED');
  });

  it('AC-BAL-14: expenses created during closing are in the plan or rejected', async () => {
    const ROUNDS = 6;
    const WRITERS = 8;
    let included = 0;
    let rejected = 0;
    for (let round = 0; round < ROUNDS; round++) {
      const { group, m } = await makeGroup(['ana', 'bia', 'caio']);
      await addExpense(group.id, {
        originalAmountMinor: 3000,
        paidByMemberId: m['ana'],
        split: { type: 'EQUAL', participantIds: Object.values(m) },
      });
      const writers = Array.from({ length: WRITERS }, (_, i) =>
        request(server())
          .post(`/groups/${group.id}/expenses`)
          .set(auth('ana'))
          .send(
            expenseBody({
              description: `Concurrent ${i}`,
              originalAmountMinor: 1000 + i,
              paidByMemberId: m['bia'],
              split: { type: 'EQUAL', participantIds: Object.values(m) },
            }),
          )
          .then((res) => ({ status: res.status, code: (res.body as { code?: string }).code })),
      );
      const closing = post('ana', `/groups/${group.id}/close`).then((res) => res.status);
      const [closeStatus, ...results] = await Promise.all([closing, ...writers]);
      expect(closeStatus).toBe(200);

      for (const r of results) {
        if (r.status === 201) included++;
        else {
          expect(r).toEqual({ status: 409, code: 'GROUP_CLOSED' });
          rejected++;
        }
      }

      // Whatever got in must be in the frozen plan: applying it zeroes every balance.
      const expenses = await prisma.expense.findMany({
        where: { groupId: group.id },
        include: { shares: true },
      });
      const net = new Map(group.members.map((x) => [x.id, 0]));
      for (const e of expenses) {
        net.set(e.paidByMemberId, net.get(e.paidByMemberId)! + e.amountMinor);
        for (const s of e.shares) net.set(s.memberId, net.get(s.memberId)! - s.amountMinor);
      }
      const transfers = await prisma.settlementTransfer.findMany({ where: { groupId: group.id } });
      for (const t of transfers) {
        net.set(t.fromMemberId, net.get(t.fromMemberId)! + t.amountMinor);
        net.set(t.toMemberId, net.get(t.toMemberId)! - t.amountMinor);
      }
      expect([...net.values()]).toEqual([0, 0, 0]);
      expect(expenses.length).toBe(1 + results.filter((r) => r.status === 201).length);
    }
    console.info(`concurrency: ${included} expenses included, ${rejected} rejected`);
  });

  // Regression: the close used to read expenses through the pool while holding its own
  // connection, so more blocked writers than pool connections (10) starved it into a 500.
  // The read inside the lock is held open for a while so the writers pile up behind it.
  it.each([15, 30])(
    'AC-BAL-14: closing with %i writers blocked on the lock does not starve the pool',
    async (writerCount) => {
      const { group, m } = await makeGroup(['ana', 'bia', 'caio']);
      await addExpense(group.id, {
        originalAmountMinor: 3000,
        paidByMemberId: m['ana'],
        split: { type: 'EQUAL', participantIds: Object.values(m) },
      });
      const expensesService = app.get(ExpensesService);
      const original = expensesService.listForBalance.bind(expensesService);
      let insideLock = false;
      expensesService.listForBalance = async (...args) => {
        // Only the close reads while the writers exist; the group is locked at this point.
        insideLock = true;
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return original(...args);
      };
      try {
        const closing = post('ana', `/groups/${group.id}/close`).then((res) => res.status);
        const deadline = Date.now() + 5000;
        while (!insideLock && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        const writers = Array.from({ length: writerCount }, (_, i) =>
          request(server())
            .post(`/groups/${group.id}/expenses`)
            .set(auth('ana'))
            .send(
              expenseBody({
                description: `Concurrent ${i}`,
                originalAmountMinor: 1000 + i,
                paidByMemberId: m['bia'],
                split: { type: 'EQUAL', participantIds: Object.values(m) },
              }),
            )
            .then((res) => ({ status: res.status, code: (res.body as { code?: string }).code })),
        );
        const [closeStatus, ...results] = await Promise.all([closing, ...writers]);
        expect(insideLock).toBe(true);
        expect(closeStatus).toBe(200);
        for (const r of results) {
          if (r.status !== 201) expect(r).toEqual({ status: 409, code: 'GROUP_CLOSED' });
        }
        const expenses = await prisma.expense.findMany({
          where: { groupId: group.id },
          include: { shares: true },
        });
        expect(expenses.length).toBe(1 + results.filter((r) => r.status === 201).length);
        const net = new Map(group.members.map((x) => [x.id, 0]));
        for (const e of expenses) {
          net.set(e.paidByMemberId, net.get(e.paidByMemberId)! + e.amountMinor);
          for (const s of e.shares) net.set(s.memberId, net.get(s.memberId)! - s.amountMinor);
        }
        const transfers = await prisma.settlementTransfer.findMany({
          where: { groupId: group.id },
        });
        for (const t of transfers) {
          net.set(t.fromMemberId, net.get(t.fromMemberId)! + t.amountMinor);
          net.set(t.toMemberId, net.get(t.toMemberId)! - t.amountMinor);
        }
        expect([...net.values()]).toEqual([0, 0, 0]);
      } finally {
        expensesService.listForBalance = original;
      }
    },
  );
});

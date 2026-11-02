import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

interface GroupBody {
  id: string;
  members: { id: string; name: string }[];
}
interface ShareBody {
  memberId: string;
  originalAmountMinor: number;
  amountMinor: number;
  basisPoints: number | null;
}
interface ExpenseBody {
  id: string;
  currency: string;
  originalAmountMinor: number;
  exchangeRate: string;
  amountMinor: number;
  splitType: string;
  occurredOn: string;
  createdByUserId: string;
  shares: ShareBody[];
}
interface PageBody {
  items: ExpenseBody[];
  page: number;
  pageSize: number;
  total: number;
}

describe('Expenses (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const domain = `-${Date.now()}@expenses-e2e.dev`;
  const server = (): Server => app.getHttpServer() as Server;
  const tokens: Record<string, string> = {};
  const userIds: Record<string, string> = {};
  let group: GroupBody;
  let closedGroup: GroupBody;
  let m: Record<string, string>;

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
    const body = login.body as { accessToken: string; user: { id: string } };
    tokens[name] = body.accessToken;
    userIds[name] = body.user.id;
  }
  const auth = (user: string) => ({ Authorization: `Bearer ${tokens[user]}` });
  const api = (user: string) => ({
    get: (url: string) => request(server()).get(url).set(auth(user)),
    post: (url: string) => request(server()).post(url).set(auth(user)),
    put: (url: string) => request(server()).put(url).set(auth(user)),
    delete: (url: string) => request(server()).delete(url).set(auth(user)),
  });
  const base = () => `/groups/${group.id}/expenses`;
  const equal = (ids: string[], extra: object = {}) => ({
    description: 'Dinner',
    originalAmountMinor: 10000,
    paidByMemberId: m['ana'],
    occurredOn: '2026-07-10',
    split: { type: 'EQUAL', participantIds: ids },
    ...extra,
  });
  const create = async (body: object, user = 'ana'): Promise<ExpenseBody> =>
    (await api(user).post(base()).send(body).expect(201)).body as ExpenseBody;
  const amounts = (e: ExpenseBody) => e.shares.map((s) => s.amountMinor).sort((a, b) => b - a);
  const originals = (e: ExpenseBody) =>
    e.shares.map((s) => s.originalAmountMinor).sort((a, b) => b - a);

  async function makeGroup(
    owner: string,
    members: string[],
    baseCurrency = 'BRL',
  ): Promise<GroupBody> {
    const res = await api(owner)
      .post('/groups')
      .send({
        name: 'Trip',
        baseCurrency,
        // The owner is added automatically as the first member.
        members: members.slice(1).map((name) => ({ name, email: `${name}${domain}` })),
      })
      .expect(201);
    return res.body as GroupBody;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    for (const name of ['ana', 'bia', 'caio', 'stranger']) await signUp(name);
    // Ana creates the group (owner, first member); Bia and Caio are linked by e-mail.
    group = await makeGroup('ana', ['ana', 'bia', 'caio']);
    m = Object.fromEntries(group.members.map((x) => [x.name, x.id]));
    closedGroup = await makeGroup('ana', ['ana', 'bia']);
  });

  afterAll(async () => {
    const where = { group: { owner: { email: { endsWith: domain } } } };
    await prisma.expenseShare.deleteMany({ where: { expense: where } });
    await prisma.expense.deleteMany({ where });
    await prisma.groupMember.deleteMany({ where });
    await prisma.group.deleteMany({ where: { owner: { email: { endsWith: domain } } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: domain } } });
    await app.close();
  });

  it('requires authentication', async () => {
    await request(server()).get(base()).expect(401);
  });

  it('AC-EXP-01: equal split in the base currency', async () => {
    const g = await makeGroup('ana', ['ana', 'bia', 'caio', 'duda']);
    const ids = g.members.map((x) => x.id);
    const res = await api('ana')
      .post(`/groups/${g.id}/expenses`)
      .send(equal(ids, { paidByMemberId: ids[0] }))
      .expect(201);
    const body = res.body as ExpenseBody;
    expect(body).toMatchObject({
      currency: 'BRL',
      exchangeRate: '1.00000000',
      amountMinor: 10000,
      splitType: 'EQUAL',
      occurredOn: '2026-07-10',
      createdByUserId: userIds['ana'],
    });
    expect(originals(body)).toEqual([2500, 2500, 2500, 2500]);
  });

  it('AC-EXP-02: equal split with remainder', async () => {
    const body = await create(equal([m['ana']!, m['bia']!, m['caio']!]));
    expect(amounts(body)).toEqual([3334, 3333, 3333]);
  });

  it('AC-EXP-03: percentage split', async () => {
    const body = await create({
      ...equal([]),
      split: {
        type: 'PERCENTAGE',
        shares: [
          { memberId: m['ana'], basisPoints: 5000 },
          { memberId: m['bia'], basisPoints: 3000 },
          { memberId: m['caio'], basisPoints: 2000 },
        ],
      },
    });
    expect(amounts(body)).toEqual([5000, 3000, 2000]);
    expect(body.shares.map((s) => s.basisPoints).sort()).toEqual([2000, 3000, 5000]);
  });

  it('AC-EXP-04: percentage sum must be 10000', async () => {
    const res = await api('ana')
      .post(base())
      .send({
        ...equal([]),
        split: {
          type: 'PERCENTAGE',
          shares: [
            { memberId: m['ana'], basisPoints: 5000 },
            { memberId: m['bia'], basisPoints: 4000 },
          ],
        },
      })
      .expect(422);
    expect(res.body).toMatchObject({ code: 'SPLIT_PERCENTAGE_SUM_INVALID' });
  });

  it('AC-EXP-05/06: fixed split and invalid sum', async () => {
    const fixed = (a: number, b: number) => ({
      ...equal([]),
      split: {
        type: 'FIXED',
        shares: [
          { memberId: m['ana'], originalAmountMinor: a },
          { memberId: m['bia'], originalAmountMinor: b },
        ],
      },
    });
    const body = await create(fixed(6000, 4000));
    expect(amounts(body)).toEqual([6000, 4000]);
    const res = await api('ana').post(base()).send(fixed(6000, 3000)).expect(422);
    expect(res.body).toMatchObject({ code: 'SPLIT_FIXED_SUM_INVALID' });
  });

  it('AC-EXP-07: payer outside the split is accepted', async () => {
    const body = await create(
      equal([m['bia']!, m['caio']!], { originalAmountMinor: 6000, paidByMemberId: m['ana'] }),
    );
    expect(body.shares).toHaveLength(2);
    expect(body.shares.some((s) => s.memberId === m['ana'])).toBe(false);
  });

  it('AC-EXP-08: payer or participant outside the group, or repeated', async () => {
    const outsider = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    for (const body of [
      equal([m['ana']!, outsider]),
      equal([m['ana']!], { paidByMemberId: outsider }),
      equal([m['ana']!, m['ana']!]),
    ]) {
      const res = await api('ana').post(base()).send(body).expect(422);
      expect(res.body).toMatchObject({ code: 'INVALID_SPLIT_PARTICIPANTS' });
    }
  });

  it('AC-EXP-09: invalid amounts', async () => {
    for (const originalAmountMinor of [0, -5, 10.5, 1_000_000_001]) {
      const res = await api('ana')
        .post(base())
        .send(equal([m['ana']!], { originalAmountMinor }))
        .expect(422);
      expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    }
    const res = await api('ana')
      .post(base())
      .send(equal([m['ana']!], { description: '   ' }))
      .expect(422);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('AC-EXP-10/17 and AC-CUR-10: edit changes split, currency and rate', async () => {
    const created = await create(equal([m['ana']!, m['bia']!]));
    const res = await api('ana')
      .put(`${base()}/${created.id}`)
      .send(
        equal([m['ana']!, m['bia']!, m['caio']!], {
          currency: 'USD',
          exchangeRate: '5.5000',
          originalAmountMinor: 20000,
        }),
      )
      .expect(200);
    const body = res.body as ExpenseBody;
    expect(body).toMatchObject({
      id: created.id,
      currency: 'USD',
      exchangeRate: '5.50000000',
      originalAmountMinor: 20000,
      amountMinor: 110000,
    });
    expect(body.shares).toHaveLength(3);
    expect(amounts(body).reduce((a, b) => a + b, 0)).toBe(110000);
    expect(await prisma.expenseShare.count({ where: { expenseId: created.id } })).toBe(3);
  });

  it('AC-EXP-11: other members get 403, the owner may edit and delete', async () => {
    const mine = await create(equal([m['ana']!, m['bia']!]), 'bia');
    await api('caio')
      .put(`${base()}/${mine.id}`)
      .send(equal([m['ana']!]))
      .expect(403);
    const del = await api('caio').delete(`${base()}/${mine.id}`).expect(403);
    expect(del.body).toMatchObject({ code: 'FORBIDDEN' });
    // owner (Ana) is not the creator but may edit and delete
    await api('ana')
      .put(`${base()}/${mine.id}`)
      .send(equal([m['ana']!]))
      .expect(200);
    await api('ana').delete(`${base()}/${mine.id}`).expect(204);
  });

  it('AC-EXP-12: delete returns 204 and then 404', async () => {
    const created = await create(equal([m['ana']!, m['bia']!]));
    await api('ana').delete(`${base()}/${created.id}`).expect(204);
    const res = await api('ana').get(`${base()}/${created.id}`).expect(404);
    expect(res.body).toMatchObject({ code: 'EXPENSE_NOT_FOUND' });
    expect(await prisma.expenseShare.count({ where: { expenseId: created.id } })).toBe(0);
  });

  it('returns 404 to strangers and for expenses of another group', async () => {
    const created = await create(equal([m['ana']!]));
    for (const res of [
      await api('stranger').get(base()).expect(404),
      await api('stranger')
        .post(base())
        .send(equal([m['ana']!]))
        .expect(404),
      await api('stranger').get(`${base()}/${created.id}`).expect(404),
      await api('stranger').delete(`${base()}/${created.id}`).expect(404),
    ]) {
      expect(res.body).toMatchObject({ code: 'GROUP_NOT_FOUND' });
    }
    const other = await api('ana').get(`/groups/${closedGroup.id}/expenses/${created.id}`);
    expect(other.status).toBe(404);
    expect(other.body).toMatchObject({ code: 'EXPENSE_NOT_FOUND' });
  });

  it('AC-EXP-13: closed group rejects create, edit and delete', async () => {
    const [ana, bia] = closedGroup.members.map((x) => x.id);
    const url = `/groups/${closedGroup.id}/expenses`;
    const body = equal([ana!, bia!], { paidByMemberId: ana });
    const created = (await api('ana').post(url).send(body).expect(201)).body as ExpenseBody;
    await prisma.group.update({
      where: { id: closedGroup.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
    for (const res of [
      await api('ana').post(url).send(body).expect(409),
      await api('ana').put(`${url}/${created.id}`).send(body).expect(409),
      await api('ana').delete(`${url}/${created.id}`).expect(409),
    ]) {
      expect(res.body).toMatchObject({ code: 'GROUP_CLOSED' });
    }
    await api('ana').get(`${url}/${created.id}`).expect(200);
  });

  it('closing during the request wins over the write (FOR UPDATE lock)', async () => {
    const g = await makeGroup('ana', ['ana', 'bia']);
    const ids = g.members.map((x) => x.id);
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const lockTaken = new Promise<void>((resolve) => (locked = resolve));
    const closer = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "Group" WHERE "id" = ${g.id}::uuid FOR UPDATE`;
      locked();
      await held;
      await tx.group.update({ where: { id: g.id }, data: { status: 'CLOSED' } });
    });
    await lockTaken;
    const pending = api('ana')
      .post(`/groups/${g.id}/expenses`)
      .send(equal(ids, { paidByMemberId: ids[0] }))
      .then((res) => res);
    await new Promise((resolve) => setTimeout(resolve, 300));
    release();
    await closer;
    const res = await pending;
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'GROUP_CLOSED' });
    expect(await prisma.expense.count({ where: { groupId: g.id } })).toBe(0);
  });

  it('RN-EXP-13: group with fewer than 2 members', async () => {
    const g = await makeGroup('ana', ['ana']);
    const res = await api('ana')
      .post(`/groups/${g.id}/expenses`)
      .send(equal([g.members[0]!.id], { paidByMemberId: g.members[0]!.id }))
      .expect(409);
    expect(res.body).toMatchObject({ code: 'GROUP_NEEDS_MORE_MEMBERS' });
  });

  describe('foreign currency', () => {
    it('AC-CUR-02 / AC-EXP-15: USD equal split', async () => {
      const body = await create(
        equal([m['ana']!, m['bia']!, m['caio']!], { currency: 'USD', exchangeRate: '5.4325' }),
      );
      expect(body).toMatchObject({
        currency: 'USD',
        exchangeRate: '5.43250000',
        originalAmountMinor: 10000,
        amountMinor: 54325,
      });
      expect(originals(body)).toEqual([3334, 3333, 3333]);
      expect(amounts(body)).toEqual([18109, 18108, 18108]);
    });

    it('AC-EXP-16: USD fixed split', async () => {
      const body = await create({
        ...equal([]),
        currency: 'USD',
        exchangeRate: '5.4325',
        split: {
          type: 'FIXED',
          shares: [
            { memberId: m['ana'], originalAmountMinor: 6000 },
            { memberId: m['bia'], originalAmountMinor: 4000 },
          ],
        },
      });
      expect(amounts(body)).toEqual([32595, 21730]);
    });

    it('AC-CUR-03: JPY has zero decimals', async () => {
      const body = await create(
        equal([m['ana']!, m['bia']!], {
          currency: 'JPY',
          exchangeRate: '0.0345',
          originalAmountMinor: 5000,
        }),
      );
      expect(body.amountMinor).toBe(17250);
      expect(amounts(body)).toEqual([8625, 8625]);
    });

    it('AC-CUR-14: group with a different base currency', async () => {
      const g = await makeGroup('ana', ['ana', 'bia'], 'USD');
      const ids = g.members.map((x) => x.id);
      const res = await api('ana')
        .post(`/groups/${g.id}/expenses`)
        .send(equal(ids, { currency: 'BRL', exchangeRate: '0.1841', paidByMemberId: ids[0] }))
        .expect(201);
      expect((res.body as ExpenseBody).amountMinor).toBe(1841);
    });

    it('AC-CUR-05/06/07: exchange rate rules', async () => {
      const ids = [m['ana']!, m['bia']!];
      const cases: object[] = [
        equal(ids, { currency: 'USD' }),
        ...['0', '-1', '5.123456789', '1e3', 'abc', ''].map((exchangeRate) =>
          equal(ids, { currency: 'USD', exchangeRate }),
        ),
        equal(ids, { currency: 'BRL', exchangeRate: '2' }),
        equal(ids, { exchangeRate: '1.5' }),
      ];
      for (const body of cases) {
        const res = await api('ana').post(base()).send(body).expect(422);
        expect(res.body).toMatchObject({ code: 'EXCHANGE_RATE_INVALID' });
      }
      const same = await create(equal(ids, { currency: 'BRL', exchangeRate: '1.0' }));
      expect(same.exchangeRate).toBe('1.00000000');
    });

    it('AC-CUR-08: unsupported currency', async () => {
      const res = await api('ana')
        .post(base())
        .send(equal([m['ana']!], { currency: 'XYZ', exchangeRate: '1' }))
        .expect(422);
      expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('AC-CUR-11: converted amount out of range', async () => {
      for (const [rate, amount] of [
        ['0.00000001', 10],
        ['9999999999', 1_000_000],
      ] as const) {
        const res = await api('ana')
          .post(base())
          .send(
            equal([m['ana']!], {
              currency: 'USD',
              exchangeRate: rate,
              originalAmountMinor: amount,
            }),
          )
          .expect(422);
        expect(res.body).toMatchObject({ code: 'AMOUNT_OUT_OF_RANGE' });
      }
    });
  });

  it('AC-EXP-14: paginated list ordered by occurredOn and createdAt desc', async () => {
    const g = await makeGroup('ana', ['ana', 'bia']);
    const ids = g.members.map((x) => x.id);
    const url = `/groups/${g.id}/expenses`;
    const post = async (occurredOn: string, description: string) =>
      (
        await api('ana')
          .post(url)
          .send(equal(ids, { paidByMemberId: ids[0], occurredOn, description }))
          .expect(201)
      ).body as ExpenseBody;
    await post('2026-07-01', 'old');
    await post('2026-07-05', 'first-new');
    await post('2026-07-05', 'second-new');

    const res = await api('bia').get(`${url}?page=1&pageSize=2`).expect(200);
    const page = res.body as PageBody;
    expect(page).toMatchObject({ page: 1, pageSize: 2, total: 3 });
    expect(page.items.map((e) => e.occurredOn)).toEqual(['2026-07-05', '2026-07-05']);
    expect((page.items[0] as unknown as { description: string }).description).toBe('second-new');
    expect(page.items[0]!.shares).toHaveLength(2);

    const second = (await api('ana').get(`${url}?page=2&pageSize=2`).expect(200)).body as PageBody;
    expect(second.items.map((e) => e.occurredOn)).toEqual(['2026-07-01']);

    const defaults = (await api('ana').get(url).expect(200)).body as PageBody;
    expect(defaults).toMatchObject({ page: 1, pageSize: 20 });
    await api('ana').get(`${url}?pageSize=101`).expect(422);
  });

  it('rejects an invalid occurredOn and unknown fields', async () => {
    for (const extra of [{ occurredOn: '2026-02-30' }, { occurredOn: '10/07/2026' }, { x: 1 }]) {
      const res = await api('ana')
        .post(base())
        .send(equal([m['ana']!], extra))
        .expect(422);
      expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    }
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { cleanupEmailDomain } from './support/e2e-harness.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

interface MemberBody {
  id: string;
  name: string;
  email: string | null;
  userId: string | null;
}
interface GroupBody {
  id: string;
  name: string;
  status: string;
  baseCurrency: string;
  ownerId: string;
  members: MemberBody[];
}

describe('Groups (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}`;
  const domain = `-${suffix}@groups-e2e.dev`;
  const email = (name: string) => `${name}${domain}`;
  const server = (): Server => app.getHttpServer() as Server;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};

  async function signUp(name: string): Promise<void> {
    await request(server())
      .post('/auth/register')
      .send({ name, email: email(name), password: 'password-123' })
      .expect(201);
    const login = await request(server())
      .post('/auth/login')
      .send({ email: email(name), password: 'password-123' })
      .expect(200);
    const body = login.body as { accessToken: string; user: { id: string } };
    tokens[name] = body.accessToken;
    ids[name] = body.user.id;
  }
  const as = (user: string) => ({
    get: (url: string) => request(server()).get(url).set('Authorization', `Bearer ${tokens[user]}`),
    post: (url: string) =>
      request(server()).post(url).set('Authorization', `Bearer ${tokens[user]}`),
    patch: (url: string) =>
      request(server()).patch(url).set('Authorization', `Bearer ${tokens[user]}`),
    delete: (url: string) =>
      request(server()).delete(url).set('Authorization', `Bearer ${tokens[user]}`),
  });
  const createGroup = async (user: string, body: object): Promise<GroupBody> =>
    (await as(user).post('/groups').send(body).expect(201)).body as GroupBody;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    for (const name of ['owner', 'bia', 'stranger']) await signUp(name);
  });

  afterAll(async () => {
    await cleanupEmailDomain(prisma, domain);
    await app.close();
  });

  it('requires authentication', async () => {
    const res = await request(server()).get('/groups').expect(401);
    expect(res.body).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('AC-GRP-01: creates a group with the creator plus the given members', async () => {
    const group = await createGroup('owner', {
      name: 'Viagem Floripa',
      members: [{ name: 'Bia' }, { name: 'Caio' }, { name: 'Duda' }],
    });
    expect(group).toMatchObject({
      name: 'Viagem Floripa',
      status: 'OPEN',
      baseCurrency: 'BRL',
      ownerId: ids['owner'],
      description: null,
      closedAt: null,
    });
    expect(group.members.map((m) => m.name)).toEqual(['owner', 'Bia', 'Caio', 'Duda']);
    expect(group.members[0]).toMatchObject({ userId: ids['owner'], email: email('owner') });
    expect(group.members[1]).toMatchObject({ userId: null, email: null });
  });

  it('AC-GRP-02: rejects duplicate names (ignoring case) and duplicate emails', async () => {
    const names = await as('owner')
      .post('/groups')
      .send({ name: 'Dup', members: [{ name: 'Bia' }, { name: 'bia' }] })
      .expect(422);
    expect(names.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [{ path: 'members.1.name' }],
    });

    const emails = await as('owner')
      .post('/groups')
      .send({
        name: 'Dup',
        members: [
          { name: 'A', email: 'x@y.dev' },
          { name: 'B', email: 'X@y.dev' },
        ],
      })
      .expect(422);
    expect(emails.body).toMatchObject({ details: [{ path: 'members.1.email' }] });

    const creatorName = await as('owner')
      .post('/groups')
      .send({ name: 'Dup', members: [{ name: 'OWNER' }] })
      .expect(422);
    expect(creatorName.body).toMatchObject({ details: [{ path: 'members.0.name' }] });
  });

  it('AC-GRP-10: supports a base currency, rejects unsupported ones and changing it', async () => {
    const usd = await createGroup('owner', { name: 'Trip USD', baseCurrency: 'USD' });
    expect(usd.baseCurrency).toBe('USD');
    expect(usd.members).toHaveLength(1);

    const bad = await as('owner')
      .post('/groups')
      .send({ name: 'Bad', baseCurrency: 'XYZ' })
      .expect(422);
    expect(bad.body).toMatchObject({ code: 'VALIDATION_ERROR' });

    const patch = await as('owner')
      .patch(`/groups/${usd.id}`)
      .send({ baseCurrency: 'EUR' })
      .expect(422);
    expect(patch.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    const after = await as('owner').get(`/groups/${usd.id}`).expect(200);
    expect((after.body as GroupBody).baseCurrency).toBe('USD');
  });

  it('validates name length and malformed ids', async () => {
    await as('owner').post('/groups').send({ name: 'x' }).expect(422);
    const res = await as('owner').get('/groups/not-a-uuid').expect(422);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  describe('authorization and listing', () => {
    let groupA: GroupBody;
    let groupB: GroupBody;
    let groupC: GroupBody;

    beforeAll(async () => {
      groupA = await createGroup('owner', { name: 'Group A', members: [{ name: 'Zed' }] });
      groupB = await createGroup('bia', {
        name: 'Group B',
        members: [{ name: 'Owner Guest', email: email('owner') }],
      });
      groupC = await createGroup('stranger', { name: 'Group C' });
    });

    it('AC-GRP-03/RN-GRP-05: lists owned and linked groups, not unrelated ones', async () => {
      expect(groupB.members.find((m) => m.email === email('owner'))?.userId).toBe(ids['owner']);
      const res = await as('owner').get('/groups').expect(200);
      const list = res.body as { id: string; memberCount: number; status: string }[];
      const found = list.map((g) => g.id);
      expect(found).toEqual(expect.arrayContaining([groupA.id, groupB.id]));
      expect(found).not.toContain(groupC.id);
      expect(list.find((g) => g.id === groupA.id)).toMatchObject({
        name: 'Group A',
        status: 'OPEN',
        memberCount: 2,
      });
    });

    it('AC-GRP-04: stranger gets 404 GROUP_NOT_FOUND on every group route', async () => {
      const member = groupA.members[1]!;
      const calls = [
        () => as('stranger').get(`/groups/${groupA.id}`),
        () => as('stranger').patch(`/groups/${groupA.id}`).send({ name: 'Hack' }),
        () => as('stranger').post(`/groups/${groupA.id}/members`).send({ name: 'Eve' }),
        () => as('stranger').delete(`/groups/${groupA.id}/members/${member.id}`),
        () => as('stranger').get('/groups/00000000-0000-4000-8000-000000000000'),
      ];
      for (const call of calls) {
        const res = await call().expect(404);
        expect(res.body).toMatchObject({ statusCode: 404, code: 'GROUP_NOT_FOUND' });
      }
    });

    it('a linked member can read the group', async () => {
      const res = await as('owner').get(`/groups/${groupB.id}`).expect(200);
      expect((res.body as GroupBody).id).toBe(groupB.id);
    });

    it('AC-GRP-08: a non-owner member gets 403 FORBIDDEN on writes', async () => {
      const member = groupB.members.find((m) => m.userId === ids['owner'])!;
      const calls = [
        () => as('owner').patch(`/groups/${groupB.id}`).send({ name: 'Hack' }),
        () => as('owner').post(`/groups/${groupB.id}/members`).send({ name: 'Eve' }),
        () => as('owner').delete(`/groups/${groupB.id}/members/${member.id}`),
      ];
      for (const call of calls) {
        const res = await call().expect(403);
        expect(res.body).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
      }
    });

    it('RF-GRP-07: owner updates name and description', async () => {
      const res = await as('owner')
        .patch(`/groups/${groupA.id}`)
        .send({ name: ' Group A2 ', description: 'Notes' })
        .expect(200);
      expect(res.body).toMatchObject({ name: 'Group A2', description: 'Notes' });
      await as('owner').patch(`/groups/${groupA.id}`).send({}).expect(422);
    });
  });

  describe('members', () => {
    let group: GroupBody;

    beforeAll(async () => {
      group = await createGroup('owner', { name: 'Members', members: [{ name: 'Caio' }] });
    });

    it('AC-GRP-05: adds a member linked to the registered user with that email', async () => {
      const res = await as('owner')
        .post(`/groups/${group.id}/members`)
        .send({ name: 'Bia', email: email('bia').toUpperCase() })
        .expect(201);
      expect(res.body).toMatchObject({ name: 'Bia', email: email('bia'), userId: ids['bia'] });
      const list = await as('bia').get('/groups').expect(200);
      expect((list.body as { id: string }[]).map((g) => g.id)).toContain(group.id);
    });

    it('rejects duplicate name or email, and a user that is already a member', async () => {
      const name = await as('owner')
        .post(`/groups/${group.id}/members`)
        .send({ name: 'CAIO' })
        .expect(422);
      expect(name.body).toMatchObject({ code: 'VALIDATION_ERROR', details: [{ path: 'name' }] });
      const mail = await as('owner')
        .post(`/groups/${group.id}/members`)
        .send({ name: 'Other', email: email('bia') })
        .expect(422);
      expect(mail.body).toMatchObject({ details: [{ path: 'email' }] });
    });

    it('AC-GRP-06: removes a member without expenses', async () => {
      const added = await as('owner')
        .post(`/groups/${group.id}/members`)
        .send({ name: 'Temp' })
        .expect(201);
      const memberId = (added.body as MemberBody).id;
      await as('owner').delete(`/groups/${group.id}/members/${memberId}`).expect(204);
      const after = await as('owner').get(`/groups/${group.id}`).expect(200);
      expect((after.body as GroupBody).members.map((m) => m.id)).not.toContain(memberId);
      const again = await as('owner').delete(`/groups/${group.id}/members/${memberId}`).expect(404);
      expect(again.body).toMatchObject({ code: 'MEMBER_NOT_FOUND' });
    });

    it('AC-GRP-07: refuses to remove a payer or an expense participant', async () => {
      const g = await createGroup('owner', {
        name: 'Exp',
        members: [{ name: 'Payer' }, { name: 'Sharer' }, { name: 'Free' }],
      });
      const [me, payer, sharer, free] = g.members as [
        MemberBody,
        MemberBody,
        MemberBody,
        MemberBody,
      ];
      await prisma.expense.create({
        data: {
          groupId: g.id,
          description: 'Dinner',
          currency: 'BRL',
          originalAmountMinor: 1000,
          exchangeRate: '1',
          amountMinor: 1000,
          paidByMemberId: payer.id,
          splitType: 'EQUAL',
          occurredOn: new Date('2026-07-10'),
          createdByUserId: ids['owner']!,
          shares: {
            create: [
              { memberId: me.id, originalAmountMinor: 500, amountMinor: 500 },
              { memberId: sharer.id, originalAmountMinor: 500, amountMinor: 500 },
            ],
          },
        },
      });
      for (const m of [payer, sharer]) {
        const res = await as('owner').delete(`/groups/${g.id}/members/${m.id}`).expect(409);
        expect(res.body).toMatchObject({ code: 'MEMBER_HAS_EXPENSES' });
      }
      const still = await as('owner').get(`/groups/${g.id}`).expect(200);
      expect((still.body as GroupBody).members).toHaveLength(4);
      await as('owner').delete(`/groups/${g.id}/members/${free.id}`).expect(204);
    });

    it('RN-GRP-08: the owner cannot be removed', async () => {
      const ownerMember = group.members.find((m) => m.userId === ids['owner'])!;
      const res = await as('owner')
        .delete(`/groups/${group.id}/members/${ownerMember.id}`)
        .expect(403);
      expect(res.body).toMatchObject({ code: 'FORBIDDEN' });
    });

    it('AC-GRP-09: a closed group rejects member changes', async () => {
      const g = await createGroup('owner', { name: 'Closed', members: [{ name: 'Fred' }] });
      await prisma.group.update({
        where: { id: g.id },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
      const add = await as('owner')
        .post(`/groups/${g.id}/members`)
        .send({ name: 'New' })
        .expect(409);
      expect(add.body).toMatchObject({ code: 'GROUP_CLOSED' });
      const del = await as('owner')
        .delete(`/groups/${g.id}/members/${g.members[1]!.id}`)
        .expect(409);
      expect(del.body).toMatchObject({ code: 'GROUP_CLOSED' });
    });
  });
});

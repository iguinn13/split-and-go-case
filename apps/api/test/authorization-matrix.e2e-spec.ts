import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { ModulesContainer } from '@nestjs/core';
import { E2eHarness } from './support/e2e-harness.js';

type Role = 'owner' | 'member' | 'stranger' | 'anonymous';
/** Expected outcome: HTTP status, plus the error code when the call must be rejected. */
type Outcome = number | readonly [number, string];

const FORBIDDEN = [403, 'FORBIDDEN'] as const;
const NOT_FOUND = [404, 'GROUP_NOT_FOUND'] as const;
const UNAUTHORIZED = [401, 'UNAUTHORIZED'] as const;

interface Fixture {
  groupId: string;
  ids: Record<string, string>;
  /** Expense created by the owner / by the linked member. */
  ownerExpenseId: string;
  memberExpenseId: string;
  transferId: string | null;
  /** Resources of ANOTHER group (owned by eve), never reachable through `groupId`. */
  foreign: { groupId: string; expenseId: string; memberId: string; transferId: string | null };
}
interface Call {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  url: string;
  body?: object;
}
interface Row {
  route: string;
  /** Route as declared in the controllers: `METHOD /path/:param`. */
  pattern: string;
  /** Needs a closed group with a transfer. */
  closed?: boolean;
  call: (f: Fixture) => Call;
  expected: Record<Role, Outcome>;
}

const expenseBody = (f: Fixture) => ({
  description: 'Edited',
  originalAmountMinor: 4000,
  paidByMemberId: f.ids['ana'],
  occurredOn: '2026-07-10',
  split: { type: 'EQUAL', participantIds: [f.ids['ana'], f.ids['bia']] },
});
const g = (f: Fixture) => `/groups/${f.groupId}`;

/** Read routes: owner and linked member pass, stranger gets 404 so the group is not revealed. */
const readOnly = (outcome: Outcome = 200): Record<Role, Outcome> => ({
  owner: outcome,
  member: outcome,
  stranger: NOT_FOUND,
  anonymous: UNAUTHORIZED,
});
/** Owner-only writes: a linked non-owner gets 403, a stranger 404. */
const ownerOnly = (ok: number): Record<Role, Outcome> => ({
  owner: ok,
  member: FORBIDDEN,
  stranger: NOT_FOUND,
  anonymous: UNAUTHORIZED,
});

/**
 * Cross-group IDOR: a resource of another group addressed through the URL of a group where the
 * caller is owner/member must be a 404 of the resource, never a leak or a change.
 * `ownerCheck` marks owner-only routes, where a linked non-owner is stopped earlier with 403.
 */
const foreignResource = (code: string, ownerCheck = false): Record<Role, Outcome> => ({
  owner: [404, code],
  member: ownerCheck ? FORBIDDEN : [404, code],
  stranger: NOT_FOUND,
  anonymous: UNAUTHORIZED,
});

// Source: docs/architecture/api-contract.md ("Autorização") and docs/specs/02, 03, 04.
const ROWS: Row[] = [
  {
    route: 'POST /groups',
    pattern: 'POST /groups',
    call: () => ({ method: 'post', url: '/groups', body: { name: 'New group' } }),
    // Any authenticated user may create a group.
    expected: { owner: 201, member: 201, stranger: 201, anonymous: UNAUTHORIZED },
  },
  {
    route: 'GET /groups',
    pattern: 'GET /groups',
    call: () => ({ method: 'get', url: '/groups' }),
    // The list only contains the caller's own groups, so it is 200 for every user.
    expected: { owner: 200, member: 200, stranger: 200, anonymous: UNAUTHORIZED },
  },
  {
    route: 'GET /groups/:id',
    pattern: 'GET /groups/:groupId',
    call: (f) => ({ method: 'get', url: g(f) }),
    expected: readOnly(),
  },
  {
    route: 'PATCH /groups/:id',
    pattern: 'PATCH /groups/:groupId',
    call: (f) => ({ method: 'patch', url: g(f), body: { name: 'Renamed' } }),
    expected: ownerOnly(200),
  },
  {
    route: 'POST /groups/:id/members',
    pattern: 'POST /groups/:groupId/members',
    call: (f) => ({ method: 'post', url: `${g(f)}/members`, body: { name: 'Fred' } }),
    expected: ownerOnly(201),
  },
  {
    route: 'DELETE /groups/:id/members/:memberId',
    pattern: 'DELETE /groups/:groupId/members/:memberId',
    call: (f) => ({ method: 'delete', url: `${g(f)}/members/${f.ids['duda']}` }),
    expected: ownerOnly(204),
  },
  {
    route: 'POST /groups/:id/expenses',
    pattern: 'POST /groups/:groupId/expenses',
    call: (f) => ({ method: 'post', url: `${g(f)}/expenses`, body: expenseBody(f) }),
    expected: readOnly(201),
  },
  {
    route: 'GET /groups/:id/expenses',
    pattern: 'GET /groups/:groupId/expenses',
    call: (f) => ({ method: 'get', url: `${g(f)}/expenses` }),
    expected: readOnly(),
  },
  {
    route: 'GET /groups/:id/expenses/:expenseId',
    pattern: 'GET /groups/:groupId/expenses/:expenseId',
    call: (f) => ({ method: 'get', url: `${g(f)}/expenses/${f.ownerExpenseId}` }),
    expected: readOnly(),
  },
  {
    route: 'PUT expense created by the owner',
    pattern: 'PUT /groups/:groupId/expenses/:expenseId',
    call: (f) => ({
      method: 'put',
      url: `${g(f)}/expenses/${f.ownerExpenseId}`,
      body: expenseBody(f),
    }),
    // Only the creator or the owner may edit (RN-EXP-10).
    expected: ownerOnly(200),
  },
  {
    route: 'PUT expense created by the member',
    pattern: 'PUT /groups/:groupId/expenses/:expenseId',
    call: (f) => ({
      method: 'put',
      url: `${g(f)}/expenses/${f.memberExpenseId}`,
      body: expenseBody(f),
    }),
    expected: readOnly(200),
  },
  {
    route: 'DELETE expense created by the owner',
    pattern: 'DELETE /groups/:groupId/expenses/:expenseId',
    call: (f) => ({ method: 'delete', url: `${g(f)}/expenses/${f.ownerExpenseId}` }),
    expected: ownerOnly(204),
  },
  {
    route: 'DELETE expense created by the member',
    pattern: 'DELETE /groups/:groupId/expenses/:expenseId',
    call: (f) => ({ method: 'delete', url: `${g(f)}/expenses/${f.memberExpenseId}` }),
    expected: readOnly(204),
  },
  {
    route: 'GET /groups/:id/balances',
    pattern: 'GET /groups/:groupId/balances',
    call: (f) => ({ method: 'get', url: `${g(f)}/balances` }),
    expected: readOnly(),
  },
  {
    route: 'GET /groups/:id/members/:memberId/statement',
    pattern: 'GET /groups/:groupId/members/:memberId/statement',
    call: (f) => ({ method: 'get', url: `${g(f)}/members/${f.ids['bia']}/statement` }),
    expected: readOnly(),
  },
  {
    route: 'GET /groups/:id/settlement-plan',
    pattern: 'GET /groups/:groupId/settlement-plan',
    call: (f) => ({ method: 'get', url: `${g(f)}/settlement-plan` }),
    expected: readOnly(),
  },
  {
    route: 'POST /groups/:id/close',
    pattern: 'POST /groups/:groupId/close',
    call: (f) => ({ method: 'post', url: `${g(f)}/close` }),
    expected: ownerOnly(200),
  },
  {
    route: 'PATCH /groups/:id/transfers/:transferId/pay',
    pattern: 'PATCH /groups/:groupId/transfers/:transferId/pay',
    closed: true,
    call: (f) => ({ method: 'patch', url: `${g(f)}/transfers/${f.transferId}/pay` }),
    // Owner or linked member may mark a transfer as paid (RN-BAL-14).
    expected: readOnly(200),
  },
  // Cross-group IDOR rows (resource of another group through this group's URL).
  {
    route: 'GET foreign expense through own group URL',
    pattern: 'GET /groups/:groupId/expenses/:expenseId',
    call: (f) => ({ method: 'get', url: `${g(f)}/expenses/${f.foreign.expenseId}` }),
    expected: foreignResource('EXPENSE_NOT_FOUND'),
  },
  {
    route: 'PUT foreign expense through own group URL',
    pattern: 'PUT /groups/:groupId/expenses/:expenseId',
    call: (f) => ({
      method: 'put',
      url: `${g(f)}/expenses/${f.foreign.expenseId}`,
      body: expenseBody(f),
    }),
    expected: foreignResource('EXPENSE_NOT_FOUND'),
  },
  {
    route: 'DELETE foreign expense through own group URL',
    pattern: 'DELETE /groups/:groupId/expenses/:expenseId',
    call: (f) => ({ method: 'delete', url: `${g(f)}/expenses/${f.foreign.expenseId}` }),
    expected: foreignResource('EXPENSE_NOT_FOUND'),
  },
  {
    route: 'DELETE foreign member through own group URL',
    pattern: 'DELETE /groups/:groupId/members/:memberId',
    call: (f) => ({ method: 'delete', url: `${g(f)}/members/${f.foreign.memberId}` }),
    expected: foreignResource('MEMBER_NOT_FOUND', true),
  },
  {
    route: 'GET statement of foreign member through own group URL',
    pattern: 'GET /groups/:groupId/members/:memberId/statement',
    call: (f) => ({ method: 'get', url: `${g(f)}/members/${f.foreign.memberId}/statement` }),
    expected: foreignResource('MEMBER_NOT_FOUND'),
  },
  {
    route: 'PATCH pay foreign transfer through own group URL',
    pattern: 'PATCH /groups/:groupId/transfers/:transferId/pay',
    closed: true,
    call: (f) => ({ method: 'patch', url: `${g(f)}/transfers/${f.foreign.transferId}/pay` }),
    expected: foreignResource('TRANSFER_NOT_FOUND'),
  },
];

describe('Authorization matrix over every group route (e2e)', () => {
  const h = new E2eHarness('authz-e2e');

  beforeAll(async () => {
    await h.start();
    for (const name of ['ana', 'bia', 'eve']) await h.signUp(name);
  });
  afterAll(() => h.stop());

  const actor: Record<Role, string | null> = {
    owner: 'ana',
    member: 'bia',
    stranger: 'eve',
    anonymous: null,
  };

  /** ana owns the group; bia is linked by e-mail; caio and duda are pending members. */
  async function makeFixture(closed: boolean): Promise<Fixture> {
    const res = await h
      .as('ana')
      .post('/groups')
      .send({
        name: 'Matrix',
        members: [{ name: 'bia', email: h.email('bia') }, { name: 'caio' }, { name: 'duda' }],
      })
      .expect(201);
    const group = res.body as { id: string; members: { id: string; name: string }[] };
    const ids = Object.fromEntries(group.members.map((m) => [m.name, m.id])) as Record<
      string,
      string
    >;
    const create = async (user: string, payer: string): Promise<string> => {
      const created = await h
        .as(user)
        .post(`/groups/${group.id}/expenses`)
        .send({
          description: `By ${user}`,
          originalAmountMinor: 3000,
          paidByMemberId: ids[payer],
          occurredOn: '2026-07-10',
          split: { type: 'EQUAL', participantIds: [ids['ana'], ids['bia'], ids['caio']] },
        })
        .expect(201);
      return (created.body as { id: string }).id;
    };
    const ownerExpenseId = await create('ana', 'ana');
    const memberExpenseId = await create('bia', 'bia');
    let transferId: string | null = null;
    if (closed) {
      const plan = await h.as('ana').post(`/groups/${group.id}/close`).expect(200);
      transferId = (plan.body as { transfers: { id: string }[] }).transfers[0]!.id;
    }
    const foreign = await makeForeign(closed);
    return { groupId: group.id, ids, ownerExpenseId, memberExpenseId, transferId, foreign };
  }

  /** A second group owned by eve, with an expense, an unlinked member and (if closed) a transfer. */
  async function makeForeign(closed: boolean): Promise<Fixture['foreign']> {
    const res = await h
      .as('eve')
      .post('/groups')
      .send({ name: 'Foreign', members: [{ name: 'fox' }] })
      .expect(201);
    const group = res.body as { id: string; members: { id: string; name: string }[] };
    const fox = group.members.find((m) => m.name === 'fox')!;
    const eve = group.members.find((m) => m.name !== 'fox')!;
    const created = await h
      .as('eve')
      .post(`/groups/${group.id}/expenses`)
      .send({
        description: 'Foreign expense',
        originalAmountMinor: 2000,
        paidByMemberId: eve.id,
        occurredOn: '2026-07-10',
        split: { type: 'EQUAL', participantIds: [eve.id, fox.id] },
      })
      .expect(201);
    let transferId: string | null = null;
    if (closed) {
      const plan = await h.as('eve').post(`/groups/${group.id}/close`).expect(200);
      transferId = (plan.body as { transfers: { id: string }[] }).transfers[0]!.id;
    }
    return {
      groupId: group.id,
      expenseId: (created.body as { id: string }).id,
      memberId: fox.id,
      transferId,
    };
  }

  /** Everything a denied call must leave untouched. */
  async function snapshot(f: Fixture): Promise<unknown[]> {
    const read = (user: string, groupId: string) =>
      Promise.all(
        ['', '/expenses', '/balances', '/settlement-plan'].map(async (path) => {
          const res = await h.as(user).get(`/groups/${groupId}${path}`).expect(200);
          return res.body as unknown;
        }),
      );
    // The foreign group (owned by eve) must be untouched by calls through the other group.
    return [...(await read('ana', f.groupId)), ...(await read('eve', f.foreign.groupId))];
  }

  const cases = ROWS.flatMap((row) =>
    (['owner', 'member', 'stranger', 'anonymous'] as const).map(
      (role) => [row.route, role, row] as const,
    ),
  );

  it.each(cases)('%s as %s', async (_route, role, row) => {
    const f = await makeFixture(row.closed === true);
    const call = row.call(f);
    const expected = row.expected[role];
    const status = typeof expected === 'number' ? expected : expected[0];
    const rejected = status >= 400;
    const before = rejected ? await snapshot(f) : null;

    const req = h.as(actor[role])[call.method](call.url);
    const res = await (call.body ? req.send(call.body) : req);

    expect(res.status).toBe(status);
    if (typeof expected !== 'number') {
      expect(res.body).toMatchObject({ statusCode: status, code: expected[1] });
    }
    // A denied call has no side effects (the check happens before any write).
    if (before) expect(await snapshot(f)).toEqual(before);
  });

  it('covers every route that touches groups', () => {
    const modules = h.app.get(ModulesContainer);
    const declared = new Set<string>();
    for (const module of modules.values()) {
      for (const { metatype } of module.controllers.values()) {
        const prefix = Reflect.getMetadata(PATH_METADATA, metatype!) as string;
        if (!prefix.startsWith('groups')) continue;
        const proto = metatype!.prototype as Record<string, object>;
        for (const name of Object.getOwnPropertyNames(proto)) {
          const handler = proto[name]!;
          const method = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
          if (method === undefined) continue;
          const path = (Reflect.getMetadata(PATH_METADATA, handler) as string).replace(/^\/$/, '');
          declared.add(`${RequestMethod[method]} /${[prefix, path].filter(Boolean).join('/')}`);
        }
      }
    }
    expect(declared.size).toBeGreaterThanOrEqual(15);
    expect([...declared].sort()).toEqual([...new Set(ROWS.map((r) => r.pattern))].sort());
  });
});

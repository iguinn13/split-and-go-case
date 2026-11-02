import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const connectionString = process.env['DATABASE_URL'] ?? '';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

describe('database constraints', () => {
  let userId: string;
  let groupId: string;
  let memberA: string;
  let memberB: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Constraint Test',
        email: `constraints-${Date.now()}@test.dev`,
        passwordHash: 'x',
      },
    });
    userId = user.id;
    const group = await prisma.group.create({ data: { name: 'Constraints', ownerId: userId } });
    groupId = group.id;
    memberA = (await prisma.groupMember.create({ data: { groupId, name: 'Ana' } })).id;
    memberB = (await prisma.groupMember.create({ data: { groupId, name: 'Bruno' } })).id;
  });

  afterAll(async () => {
    await prisma.group.delete({ where: { id: groupId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  const expenseData = (overrides: Record<string, unknown> = {}) => ({
    groupId,
    description: 'Test',
    currency: 'BRL',
    originalAmountMinor: 100,
    exchangeRate: '1',
    amountMinor: 100,
    paidByMemberId: memberA,
    splitType: 'EQUAL' as const,
    occurredOn: new Date('2026-07-01'),
    createdByUserId: userId,
    ...overrides,
  });

  it('rejects member names that differ only by case within a group', async () => {
    await expect(prisma.groupMember.create({ data: { groupId, name: 'ANA' } })).rejects.toThrow();
  });

  it('rejects non-positive expense amounts and exchange rate', async () => {
    await expect(
      prisma.expense.create({ data: expenseData({ amountMinor: 0 }) }),
    ).rejects.toThrow();
    await expect(
      prisma.expense.create({ data: expenseData({ originalAmountMinor: 0 }) }),
    ).rejects.toThrow();
    await expect(
      prisma.expense.create({ data: expenseData({ exchangeRate: '0' }) }),
    ).rejects.toThrow();
  });

  it('rejects transfers with non-positive amount or from = to', async () => {
    await expect(
      prisma.settlementTransfer.create({
        data: { groupId, fromMemberId: memberA, toMemberId: memberA, amountMinor: 10 },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.settlementTransfer.create({
        data: { groupId, fromMemberId: memberA, toMemberId: memberB, amountMinor: 0 },
      }),
    ).rejects.toThrow();
  });
});

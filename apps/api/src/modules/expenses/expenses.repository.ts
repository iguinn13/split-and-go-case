import { Injectable } from '@nestjs/common';
import type { Prisma, SplitType } from '@prisma/client';
import { AppError } from '../../common/errors/app-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ExpenseWithShares } from './expense.mapper.js';

export interface ExpenseData {
  description: string;
  currency: string;
  originalAmountMinor: number;
  exchangeRate: string;
  amountMinor: number;
  paidByMemberId: string;
  splitType: SplitType;
  occurredOn: Date;
  shares: {
    memberId: string;
    originalAmountMinor: number;
    amountMinor: number;
    basisPoints: number | null;
  }[];
}

const withShares = {
  shares: { orderBy: [{ member: { createdAt: 'asc' } }, { memberId: 'asc' }] },
} satisfies Prisma.ExpenseInclude;

@Injectable()
export class ExpensesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findInGroup(groupId: string, expenseId: string): Promise<ExpenseWithShares | null> {
    return this.prisma.expense.findFirst({
      where: { id: expenseId, groupId },
      include: withShares,
    });
  }

  async listInGroup(
    groupId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: ExpenseWithShares[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where: { groupId },
        include: withShares,
        orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.expense.count({ where: { groupId } }),
    ]);
    return { items, total };
  }

  listAllChronological(groupId: string): Promise<ExpenseWithShares[]> {
    return this.prisma.expense.findMany({
      where: { groupId },
      include: withShares,
      orderBy: [{ occurredOn: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  create(groupId: string, createdByUserId: string, data: ExpenseData): Promise<ExpenseWithShares> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOpenGroup(tx, groupId);
      const { shares, ...expense } = data;
      return tx.expense.create({
        data: { ...expense, groupId, createdByUserId, shares: { create: shares } },
        include: withShares,
      });
    });
  }

  /** Replaces the expense fields and all of its shares (RF-EXP-04). */
  replace(groupId: string, expenseId: string, data: ExpenseData): Promise<ExpenseWithShares> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOpenGroup(tx, groupId);
      await this.assertExpenseExists(tx, groupId, expenseId);
      const { shares, ...expense } = data;
      await tx.expenseShare.deleteMany({ where: { expenseId } });
      return tx.expense.update({
        where: { id: expenseId },
        data: { ...expense, shares: { create: shares } },
        include: withShares,
      });
    });
  }

  delete(groupId: string, expenseId: string): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOpenGroup(tx, groupId);
      await this.assertExpenseExists(tx, groupId, expenseId);
      await tx.expense.delete({ where: { id: expenseId } });
    });
  }

  /**
   * Locks the group row (SELECT ... FOR UPDATE) and checks status = OPEN, so a write
   * and a group closing cannot interleave (edge case 14, RN-EXP-11).
   */
  private async lockOpenGroup(tx: Prisma.TransactionClient, groupId: string): Promise<void> {
    const rows = await tx.$queryRaw<{ status: string }[]>`
      SELECT "status"::text AS "status" FROM "Group" WHERE "id" = ${groupId}::uuid FOR UPDATE`;
    if (rows.length === 0) throw new AppError('GROUP_NOT_FOUND', 404, 'Group not found');
    if (rows[0]!.status !== 'OPEN') throw new AppError('GROUP_CLOSED', 409, 'Group is closed');
  }

  private async assertExpenseExists(
    tx: Prisma.TransactionClient,
    groupId: string,
    expenseId: string,
  ): Promise<void> {
    const found = await tx.expense.findFirst({
      where: { id: expenseId, groupId },
      select: { id: true },
    });
    if (!found) throw new AppError('EXPENSE_NOT_FOUND', 404, 'Expense not found');
  }
}

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { SettlementTransfer } from '@prisma/client';
import { AppError } from '../../common/errors/app-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Transfer } from './debt-simplifier.js';

@Injectable()
export class SettlementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listTransfers(groupId: string): Promise<SettlementTransfer[]> {
    return this.prisma.settlementTransfer.findMany({ where: { groupId } });
  }

  findTransfer(groupId: string, transferId: string): Promise<SettlementTransfer | null> {
    return this.prisma.settlementTransfer.findFirst({ where: { id: transferId, groupId } });
  }

  /**
   * Closes the group in one transaction (RN-BAL-11, RN-BAL-12). The group row is locked
   * (SELECT ... FOR UPDATE) before `buildPlan` runs, so an expense write either committed
   * before the lock (and is read by `buildPlan`) or waits and then fails with GROUP_CLOSED.
   * `buildPlan` receives the transaction client and must read through it: using the pool
   * instead would need a second connection while this one is held, and starve the pool
   * when many writers are blocked on the lock.
   */
  closeGroup(
    groupId: string,
    buildPlan: (tx: Prisma.TransactionClient) => Promise<Transfer[]>,
  ): Promise<SettlementTransfer[]> {
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<{ status: string }[]>`
        SELECT "status"::text AS "status" FROM "Group" WHERE "id" = ${groupId}::uuid FOR UPDATE`;
        if (rows.length === 0) throw new AppError('GROUP_NOT_FOUND', 404, 'Group not found');
        if (rows[0]!.status !== 'OPEN') throw new AppError('GROUP_CLOSED', 409, 'Group is closed');

        const plan = await buildPlan(tx);

        await tx.group.update({
          where: { id: groupId },
          data: { status: 'CLOSED', closedAt: new Date() },
        });
        await tx.settlementTransfer.createMany({
          data: plan.map((t) => ({
            groupId,
            fromMemberId: t.from,
            toMemberId: t.to,
            amountMinor: t.amountMinor,
          })),
        });
        return tx.settlementTransfer.findMany({ where: { groupId } });
      },
      { timeout: 15_000 },
    );
  }

  /** Marks as PAID keeping the first `paidAt` (idempotent, RN-BAL-14). */
  async markPaid(groupId: string, transferId: string): Promise<SettlementTransfer | null> {
    await this.prisma.settlementTransfer.updateMany({
      where: { id: transferId, groupId, status: 'PENDING' },
      data: { status: 'PAID', paidAt: new Date() },
    });
    return this.findTransfer(groupId, transferId);
  }
}

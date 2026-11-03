import type { Expense, ExpenseShare } from '@prisma/client';
import type { ExpenseView } from './dto/expense.schemas.js';

export type ExpenseWithShares = Expense & { shares: ExpenseShare[] };

export function toExpenseView(expense: ExpenseWithShares): ExpenseView {
    return {
        id: expense.id,
        groupId: expense.groupId,
        description: expense.description,
        currency: expense.currency,
        originalAmountMinor: expense.originalAmountMinor,
        exchangeRate: expense.exchangeRate.toFixed(8),
        amountMinor: expense.amountMinor,
        paidByMemberId: expense.paidByMemberId,
        splitType: expense.splitType,
        occurredOn: expense.occurredOn.toISOString().slice(0, 10),
        createdByUserId: expense.createdByUserId,
        createdAt: expense.createdAt,
        updatedAt: expense.updatedAt,
        shares: expense.shares.map((share) => ({
            memberId: share.memberId,
            originalAmountMinor: share.originalAmountMinor,
            amountMinor: share.amountMinor,
            basisPoints: share.basisPoints,
        })),
    };
}

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ExpensesRepository } from './expenses.repository.js';

/** An expense as the balances module needs it. Amounts are in the group base currency. */
export interface ExpenseForBalance {
    id: string;
    description: string;
    occurredOn: string;
    currency: string;
    originalAmountMinor: number;
    /** Decimal string with 8 fraction digits. */
    exchangeRate: string;
    amountMinor: number;
    paidByMemberId: string;
    shares: { memberId: string; amountMinor: number }[];
}

@Injectable()
export class ExpensesService {
    constructor(private readonly expenses: ExpensesRepository) {}

    /** All expenses of the group in chronological order (occurredOn, createdAt, id). Pass `tx` to read inside a transaction. */
    async listForBalance(
        groupId: string,
        tx?: Prisma.TransactionClient,
    ): Promise<ExpenseForBalance[]> {
        const rows = await this.expenses.listAllChronological(groupId, tx);

        return rows.map((expense) => ({
            id: expense.id,
            description: expense.description,
            occurredOn: expense.occurredOn.toISOString().slice(0, 10),
            currency: expense.currency,
            originalAmountMinor: expense.originalAmountMinor,
            exchangeRate: expense.exchangeRate.toFixed(8),
            amountMinor: expense.amountMinor,
            paidByMemberId: expense.paidByMemberId,
            shares: expense.shares.map((s) => ({
                memberId: s.memberId,
                amountMinor: s.amountMinor,
            })),
        }));
    }
}

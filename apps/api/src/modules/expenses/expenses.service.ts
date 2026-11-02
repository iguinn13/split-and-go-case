import { Injectable } from '@nestjs/common';
import { ExpensesRepository } from './expenses.repository.js';

/** An expense as the balances module needs it. Amounts are in the group base currency. */
export interface ExpenseForBalance {
  id: string;
  description: string;
  /** YYYY-MM-DD */
  occurredOn: string;
  currency: string;
  originalAmountMinor: number;
  /** Decimal string with 8 fraction digits. */
  exchangeRate: string;
  /** Converted amount, in the group base currency. */
  amountMinor: number;
  paidByMemberId: string;
  shares: { memberId: string; amountMinor: number }[];
}

/** Public read port of the expenses module for other modules. */
@Injectable()
export class ExpensesService {
  constructor(private readonly expenses: ExpensesRepository) {}

  /** All expenses of the group in chronological order (occurredOn, createdAt, id). */
  async listForBalance(groupId: string): Promise<ExpenseForBalance[]> {
    const rows = await this.expenses.listAllChronological(groupId);
    return rows.map((expense) => ({
      id: expense.id,
      description: expense.description,
      occurredOn: expense.occurredOn.toISOString().slice(0, 10),
      currency: expense.currency,
      originalAmountMinor: expense.originalAmountMinor,
      exchangeRate: expense.exchangeRate.toFixed(8),
      amountMinor: expense.amountMinor,
      paidByMemberId: expense.paidByMemberId,
      shares: expense.shares.map((s) => ({ memberId: s.memberId, amountMinor: s.amountMinor })),
    }));
  }
}

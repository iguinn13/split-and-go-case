import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { GroupAccessService } from '../groups/group-access.service.js';
import { assertCanModify, assertGroupOpen } from './expense-access.js';
import { ExpensesRepository } from './expenses.repository.js';

@Injectable()
export class DeleteExpenseUseCase {
  constructor(
    private readonly access: GroupAccessService,
    private readonly expenses: ExpensesRepository,
  ) {}

  async execute(userId: string, groupId: string, expenseId: string): Promise<void> {
    const group = await this.access.assertCanRead(groupId, userId);
    const existing = await this.expenses.findInGroup(groupId, expenseId);
    if (!existing) throw new AppError('EXPENSE_NOT_FOUND', 404, 'Expense not found');
    assertCanModify(group, existing, userId);
    assertGroupOpen(group);
    await this.expenses.delete(groupId, expenseId);
  }
}

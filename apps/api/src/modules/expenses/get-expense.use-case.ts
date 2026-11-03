import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { GroupAccessService } from '../groups/group-access.service.js';
import type { ExpenseView } from './dto/expense.schemas.js';
import { toExpenseView } from './expense.mapper.js';
import { ExpensesRepository } from './expenses.repository.js';

@Injectable()
export class GetExpenseUseCase {
    constructor(
        private readonly access: GroupAccessService,
        private readonly expenses: ExpensesRepository,
    ) {}

    async execute(userId: string, groupId: string, expenseId: string): Promise<ExpenseView> {
        await this.access.assertCanRead(groupId, userId);
        const expense = await this.expenses.findInGroup(groupId, expenseId);

        if (!expense) throw new AppError('EXPENSE_NOT_FOUND', 404, 'Expense not found');

        return toExpenseView(expense);
    }
}

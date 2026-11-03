import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { GroupAccessService } from '../groups/group-access.service.js';
import type { CreateExpenseInput, ExpenseView } from './dto/expense.schemas.js';
import { assertCanHaveExpenses, assertCanModify } from './expense-access.js';
import { buildExpenseData } from './expense-input.js';
import { toExpenseView } from './expense.mapper.js';
import { ExpensesRepository } from './expenses.repository.js';

@Injectable()
export class UpdateExpenseUseCase {
    constructor(
        private readonly access: GroupAccessService,
        private readonly expenses: ExpensesRepository,
    ) {}

    async execute(
        userId: string,
        groupId: string,
        expenseId: string,
        input: CreateExpenseInput,
    ): Promise<ExpenseView> {
        const group = await this.access.assertCanRead(groupId, userId);
        const existing = await this.expenses.findInGroup(groupId, expenseId);

        if (!existing) throw new AppError('EXPENSE_NOT_FOUND', 404, 'Expense not found');

        assertCanModify(group, existing, userId);
        assertCanHaveExpenses(group);
        const data = buildExpenseData(group, input);

        return toExpenseView(await this.expenses.replace(groupId, expenseId, data));
    }
}

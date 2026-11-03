import { Injectable } from '@nestjs/common';
import { GroupAccessService } from '../groups/group-access.service.js';
import type { CreateExpenseInput, ExpenseView } from './dto/expense.schemas.js';
import { assertCanHaveExpenses } from './expense-access.js';
import { buildExpenseData } from './expense-input.js';
import { toExpenseView } from './expense.mapper.js';
import { ExpensesRepository } from './expenses.repository.js';

@Injectable()
export class CreateExpenseUseCase {
    constructor(
        private readonly access: GroupAccessService,
        private readonly expenses: ExpensesRepository,
    ) {}

    async execute(
        userId: string,
        groupId: string,
        input: CreateExpenseInput,
    ): Promise<ExpenseView> {
        const group = await this.access.assertCanRead(groupId, userId);

        assertCanHaveExpenses(group);
        const data = buildExpenseData(group, input);

        return toExpenseView(await this.expenses.create(groupId, userId, data));
    }
}

import { Injectable } from '@nestjs/common';
import { GroupAccessService } from '../groups/group-access.service.js';
import type { ExpenseView, ListExpensesQuery, Page } from './dto/expense.schemas.js';
import { toExpenseView } from './expense.mapper.js';
import { ExpensesRepository } from './expenses.repository.js';

@Injectable()
export class ListExpensesUseCase {
    constructor(
        private readonly access: GroupAccessService,
        private readonly expenses: ExpensesRepository,
    ) {}

    async execute(
        userId: string,
        groupId: string,
        { page, pageSize }: ListExpensesQuery,
    ): Promise<Page<ExpenseView>> {
        await this.access.assertCanRead(groupId, userId);
        const { items, total } = await this.expenses.listInGroup(groupId, page, pageSize);

        return { items: items.map(toExpenseView), page, pageSize, total };
    }
}

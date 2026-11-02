import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module.js';
import { CreateExpenseUseCase } from './create-expense.use-case.js';
import { DeleteExpenseUseCase } from './delete-expense.use-case.js';
import { ExpensesController } from './expenses.controller.js';
import { ExpensesRepository } from './expenses.repository.js';
import { GetExpenseUseCase } from './get-expense.use-case.js';
import { ListExpensesUseCase } from './list-expenses.use-case.js';
import { UpdateExpenseUseCase } from './update-expense.use-case.js';

@Module({
  imports: [GroupsModule],
  controllers: [ExpensesController],
  providers: [
    ExpensesRepository,
    CreateExpenseUseCase,
    ListExpensesUseCase,
    GetExpenseUseCase,
    UpdateExpenseUseCase,
    DeleteExpenseUseCase,
  ],
})
export class ExpensesModule {}

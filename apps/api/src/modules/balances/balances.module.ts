import { Module } from '@nestjs/common';
import { ExpensesModule } from '../expenses/expenses.module.js';
import { GroupsModule } from '../groups/groups.module.js';
import { BalancesController } from './balances.controller.js';
import { GetBalancesUseCase } from './get-balances.use-case.js';
import { GetStatementUseCase } from './get-statement.use-case.js';

@Module({
  imports: [GroupsModule, ExpensesModule],
  controllers: [BalancesController],
  providers: [GetBalancesUseCase, GetStatementUseCase],
})
export class BalancesModule {}

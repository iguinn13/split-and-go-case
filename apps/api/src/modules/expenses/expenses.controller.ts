import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { CreateExpenseUseCase } from './create-expense.use-case.js';
import { DeleteExpenseUseCase } from './delete-expense.use-case.js';
import {
  type CreateExpenseInput,
  type ExpenseView,
  type ListExpensesQuery,
  type Page,
  createExpenseSchema,
  expenseParamsSchema,
  groupParamsSchema,
  listExpensesQuerySchema,
} from './dto/expense.schemas.js';
import { GetExpenseUseCase } from './get-expense.use-case.js';
import { ListExpensesUseCase } from './list-expenses.use-case.js';
import { UpdateExpenseUseCase } from './update-expense.use-case.js';

type GroupParams = { groupId: string };
type ExpenseParams = { groupId: string; expenseId: string };

const groupParams = new ZodValidationPipe<GroupParams>(groupParamsSchema);
const expenseParams = new ZodValidationPipe<ExpenseParams>(expenseParamsSchema);
const body = new ZodValidationPipe<CreateExpenseInput>(createExpenseSchema);

@Controller('groups/:groupId/expenses')
export class ExpensesController {
  constructor(
    private readonly createExpense: CreateExpenseUseCase,
    private readonly listExpenses: ListExpensesUseCase,
    private readonly getExpense: GetExpenseUseCase,
    private readonly updateExpense: UpdateExpenseUseCase,
    private readonly deleteExpense: DeleteExpenseUseCase,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param(groupParams) params: GroupParams,
    @Body(body) input: CreateExpenseInput,
  ): Promise<ExpenseView> {
    return this.createExpense.execute(user.id, params.groupId, input);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param(groupParams) params: GroupParams,
    @Query(new ZodValidationPipe<ListExpensesQuery>(listExpensesQuerySchema))
    query: ListExpensesQuery,
  ): Promise<Page<ExpenseView>> {
    return this.listExpenses.execute(user.id, params.groupId, query);
  }

  @Get(':expenseId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param(expenseParams) params: ExpenseParams,
  ): Promise<ExpenseView> {
    return this.getExpense.execute(user.id, params.groupId, params.expenseId);
  }

  @Put(':expenseId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param(expenseParams) params: ExpenseParams,
    @Body(body) input: CreateExpenseInput,
  ): Promise<ExpenseView> {
    return this.updateExpense.execute(user.id, params.groupId, params.expenseId, input);
  }

  @Delete(':expenseId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param(expenseParams) params: ExpenseParams,
  ): Promise<void> {
    return this.deleteExpense.execute(user.id, params.groupId, params.expenseId);
  }
}

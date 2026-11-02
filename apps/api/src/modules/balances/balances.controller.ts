import { Controller, Get, Param } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import {
  type BalancesView,
  type StatementView,
  groupParamsSchema,
  memberParamsSchema,
} from './dto/balance.schemas.js';
import { GetBalancesUseCase } from './get-balances.use-case.js';
import { GetStatementUseCase } from './get-statement.use-case.js';

type GroupParams = { groupId: string };
type MemberParams = { groupId: string; memberId: string };

const groupParams = new ZodValidationPipe<GroupParams>(groupParamsSchema);

@Controller('groups/:groupId')
export class BalancesController {
  constructor(
    private readonly getBalances: GetBalancesUseCase,
    private readonly getStatement: GetStatementUseCase,
  ) {}

  @Get('balances')
  balances(
    @CurrentUser() user: AuthenticatedUser,
    @Param(groupParams) params: GroupParams,
  ): Promise<BalancesView> {
    return this.getBalances.execute(user.id, params.groupId);
  }

  @Get('members/:memberId/statement')
  statement(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe<MemberParams>(memberParamsSchema)) params: MemberParams,
  ): Promise<StatementView> {
    return this.getStatement.execute(user.id, params.groupId, params.memberId);
  }
}

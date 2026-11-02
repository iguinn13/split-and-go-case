import { Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { CloseGroupUseCase } from './close-group.use-case.js';
import {
  type SettlementPlanView,
  type TransferView,
  groupParamsSchema,
  transferParamsSchema,
} from './dto/settlement.schemas.js';
import { GetSettlementPlanUseCase } from './get-settlement-plan.use-case.js';
import { PayTransferUseCase } from './pay-transfer.use-case.js';

type GroupParams = { groupId: string };
type TransferParams = { groupId: string; transferId: string };

const groupParams = new ZodValidationPipe<GroupParams>(groupParamsSchema);

@Controller('groups/:groupId')
export class SettlementsController {
  constructor(
    private readonly getPlan: GetSettlementPlanUseCase,
    private readonly closeGroup: CloseGroupUseCase,
    private readonly payTransfer: PayTransferUseCase,
  ) {}

  @Get('settlement-plan')
  plan(
    @CurrentUser() user: AuthenticatedUser,
    @Param(groupParams) params: GroupParams,
  ): Promise<SettlementPlanView> {
    return this.getPlan.execute(user.id, params.groupId);
  }

  @Post('close')
  @HttpCode(200)
  close(
    @CurrentUser() user: AuthenticatedUser,
    @Param(groupParams) params: GroupParams,
  ): Promise<SettlementPlanView> {
    return this.closeGroup.execute(user.id, params.groupId);
  }

  @Patch('transfers/:transferId/pay')
  pay(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe<TransferParams>(transferParamsSchema)) params: TransferParams,
  ): Promise<TransferView> {
    return this.payTransfer.execute(user.id, params.groupId, params.transferId);
  }
}

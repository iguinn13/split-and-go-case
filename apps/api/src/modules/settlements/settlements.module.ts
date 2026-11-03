import { Module } from '@nestjs/common';
import { ExpensesModule } from '../expenses/expenses.module.js';
import { GroupsModule } from '../groups/groups.module.js';
import { CloseGroupUseCase } from './close-group.use-case.js';
import { GetSettlementPlanUseCase } from './get-settlement-plan.use-case.js';
import { PayTransferUseCase } from './pay-transfer.use-case.js';
import { SettlementsController } from './settlements.controller.js';
import { SettlementsRepository } from './settlements.repository.js';

@Module({
    imports: [GroupsModule, ExpensesModule],
    controllers: [SettlementsController],
    providers: [
        SettlementsRepository,
        GetSettlementPlanUseCase,
        CloseGroupUseCase,
        PayTransferUseCase,
    ],
})
export class SettlementsModule {}

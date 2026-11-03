import { Injectable } from '@nestjs/common';
import { ExpensesService } from '../expenses/expenses.service.js';
import { GroupAccessService } from '../groups/group-access.service.js';
import type { SettlementPlanView } from './dto/settlement.schemas.js';
import { toClosedPlanView } from './settlement-plan.mapper.js';
import { calculateSettlementPlan } from './settlement-plan.calculator.js';
import { SettlementsRepository } from './settlements.repository.js';

@Injectable()
export class CloseGroupUseCase {
    constructor(
        private readonly access: GroupAccessService,
        private readonly expenses: ExpensesService,
        private readonly settlements: SettlementsRepository,
    ) {}

    async execute(userId: string, groupId: string): Promise<SettlementPlanView> {
        const group = await this.access.assertIsOwner(groupId, userId);
        const memberIds = group.members.map((m) => m.id);
        // The plan is computed after the repository locks the group row (RN-BAL-12), reading on its transaction.
        const rows = await this.settlements.closeGroup(groupId, async (tx) =>
            calculateSettlementPlan(memberIds, await this.expenses.listForBalance(groupId, tx)),
        );
        const names = new Map(group.members.map((m) => [m.id, m.name]));

        return toClosedPlanView(group, rows, names);
    }
}

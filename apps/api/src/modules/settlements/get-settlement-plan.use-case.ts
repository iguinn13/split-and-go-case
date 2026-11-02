import { Injectable } from '@nestjs/common';
import { ExpensesService } from '../expenses/expenses.service.js';
import { GroupAccessService } from '../groups/group-access.service.js';
import type { SettlementPlanView } from './dto/settlement.schemas.js';
import { toClosedPlanView, toOpenPlanView } from './settlement-plan.mapper.js';
import { calculateSettlementPlan } from './settlement-plan.calculator.js';
import { SettlementsRepository } from './settlements.repository.js';

@Injectable()
export class GetSettlementPlanUseCase {
  constructor(
    private readonly access: GroupAccessService,
    private readonly expenses: ExpensesService,
    private readonly settlements: SettlementsRepository,
  ) {}

  async execute(userId: string, groupId: string): Promise<SettlementPlanView> {
    const group = await this.access.assertCanRead(groupId, userId);
    const names = new Map(group.members.map((m) => [m.id, m.name]));
    if (group.status === 'CLOSED') {
      return toClosedPlanView(group, await this.settlements.listTransfers(groupId), names);
    }
    const expenses = await this.expenses.listForBalance(groupId);
    const plan = calculateSettlementPlan(
      group.members.map((m) => m.id),
      expenses,
    );
    return toOpenPlanView(group, plan, names);
  }
}

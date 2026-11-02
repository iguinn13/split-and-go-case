import { Injectable } from '@nestjs/common';
import { ExpensesService } from '../expenses/expenses.service.js';
import { GroupAccessService } from '../groups/group-access.service.js';
import type { BalancesView } from './dto/balance.schemas.js';
import { calculateBalances } from './calculators/balance.calculator.js';

@Injectable()
export class GetBalancesUseCase {
  constructor(
    private readonly access: GroupAccessService,
    private readonly expenses: ExpensesService,
  ) {}

  async execute(userId: string, groupId: string): Promise<BalancesView> {
    const group = await this.access.assertCanRead(groupId, userId);
    const expenses = await this.expenses.listForBalance(groupId);
    const balances = calculateBalances(
      group.members.map((m) => m.id),
      expenses,
    );
    const names = new Map(group.members.map((m) => [m.id, m.name]));
    return {
      currency: group.baseCurrency,
      balances: balances.map((b) => ({ ...b, name: names.get(b.memberId)! })),
    };
  }
}

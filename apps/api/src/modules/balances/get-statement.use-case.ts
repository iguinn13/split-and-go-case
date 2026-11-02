import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { ExpensesService } from '../expenses/expenses.service.js';
import { GroupAccessService } from '../groups/group-access.service.js';
import type { StatementView } from './dto/balance.schemas.js';
import { buildStatement, calculateBalances } from './calculators/balance.calculator.js';

@Injectable()
export class GetStatementUseCase {
  constructor(
    private readonly access: GroupAccessService,
    private readonly expenses: ExpensesService,
  ) {}

  async execute(userId: string, groupId: string, memberId: string): Promise<StatementView> {
    const group = await this.access.assertCanRead(groupId, userId);
    const member = group.members.find((m) => m.id === memberId);
    if (!member) throw new AppError('MEMBER_NOT_FOUND', 404, 'Member not found');
    const expenses = await this.expenses.listForBalance(groupId);
    // Validates the group-wide zero-sum invariant (RN-BAL-02) before answering.
    calculateBalances(
      group.members.map((m) => m.id),
      expenses,
    );
    const { totals, lines } = buildStatement(memberId, group.baseCurrency, expenses);
    return {
      currency: group.baseCurrency,
      member: { id: member.id, name: member.name },
      totals,
      lines,
    };
  }
}

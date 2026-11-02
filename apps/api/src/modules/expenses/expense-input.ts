import { AppError } from '../../common/errors/app-error.js';
import { currencySchema } from '../../common/money/currencies.js';
import type { GroupWithMembers } from '../groups/groups.repository.js';
import { calculateShares } from './calculators/split.calculator.js';
import type { CreateExpenseInput } from './dto/expense.schemas.js';
import type { ExpenseData } from './expenses.repository.js';

/**
 * Validates the members against the group, runs the calculators and builds the data to
 * persist (snapshot and shares). Shared by create and update.
 */
export function buildExpenseData(group: GroupWithMembers, input: CreateExpenseInput): ExpenseData {
  const memberIds = new Set(group.members.map((m) => m.id));
  const { split } = input;
  const splitMemberIds =
    split.type === 'EQUAL' ? split.participantIds : split.shares.map((s) => s.memberId);
  if (!memberIds.has(input.paidByMemberId) || splitMemberIds.some((id) => !memberIds.has(id))) {
    throw new AppError(
      'INVALID_SPLIT_PARTICIPANTS',
      422,
      'Payer and participants must be members of the group',
    );
  }

  const baseCurrency = currencySchema.parse(group.baseCurrency);
  const currency = input.currency ?? baseCurrency;
  const calculated = calculateShares({
    currency,
    baseCurrency,
    originalAmountMinor: input.originalAmountMinor,
    ...(input.exchangeRate !== undefined && { exchangeRate: input.exchangeRate }),
    split,
  });

  const basisPoints = new Map<string, number>();
  if (split.type === 'PERCENTAGE') {
    for (const s of split.shares) basisPoints.set(s.memberId, s.basisPoints);
  }

  return {
    description: input.description,
    currency,
    originalAmountMinor: input.originalAmountMinor,
    // Same-currency rates are normalised to "1" (RN-CUR-03).
    exchangeRate: currency === baseCurrency ? '1' : calculated.exchangeRate,
    amountMinor: calculated.amountMinor,
    paidByMemberId: input.paidByMemberId,
    splitType: split.type,
    occurredOn: new Date(`${input.occurredOn}T00:00:00.000Z`),
    shares: calculated.shares.map((share) => ({
      ...share,
      basisPoints: basisPoints.get(share.memberId) ?? null,
    })),
  };
}

/**
 * Pure settlement plan calculation (RN-BAL-04 to RN-BAL-09, RN-BAL-17).
 * No I/O: balances come from `calculateBalances`, the plan from `simplifyDebts`.
 */
import {
  calculateBalances,
  type BalanceExpense,
} from '../balances/calculators/balance.calculator.js';
import { simplifyDebts, type Transfer } from './debt-simplifier.js';

/** Plan in the group base currency. Throws if the zero-sum invariant is violated (RN-BAL-02). */
export function calculateSettlementPlan(
  memberIds: readonly string[],
  expenses: readonly BalanceExpense[],
): Transfer[] {
  const balances = calculateBalances(memberIds, expenses);
  return simplifyDebts(balances.map(({ memberId, netMinor }) => ({ memberId, netMinor })));
}

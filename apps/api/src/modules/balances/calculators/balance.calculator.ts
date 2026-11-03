/**
 * Pure balance and statement calculation (RN-BAL-01 to RN-BAL-03).
 * No I/O. All amounts are integers in the group base currency (converted values).
 */

export interface BalanceExpense {
    id: string;
    description: string;
    occurredOn: string;
    currency: string;
    originalAmountMinor: number;
    exchangeRate: string;
    amountMinor: number;
    paidByMemberId: string;
    shares: { memberId: string; amountMinor: number }[];
}

export interface MemberBalance {
    memberId: string;
    paidMinor: number;
    owedMinor: number;
    netMinor: number;
}

export interface StatementLine {
    expenseId: string;
    description: string;
    occurredOn: string;
    original: { currency: string; amountMinor: number; exchangeRate: string } | null;
    amountMinor: number;
    paidMinor: number;
    owedMinor: number;
    netMinor: number;
    runningBalanceMinor: number;
}

export interface Statement {
    memberId: string;
    totals: { paidMinor: number; owedMinor: number; netMinor: number };
    lines: StatementLine[];
}

/** Thrown when the sum of the balances is not zero (RN-BAL-02). Never masked. */
export class BalanceInvariantError extends Error {
    constructor(sumMinor: number) {
        super(`Balance invariant violated: sum of net balances is ${sumMinor}, expected 0`);
        this.name = 'BalanceInvariantError';
    }
}

export function calculateBalances(
    memberIds: readonly string[],
    expenses: readonly BalanceExpense[],
): MemberBalance[] {
    const totals = new Map<string, { paid: number; owed: number }>(
        memberIds.map((id) => [id, { paid: 0, owed: 0 }]),
    );
    const entry = (memberId: string) => {
        const found = totals.get(memberId);

        if (!found) throw new Error(`Expense references unknown member ${memberId}`);

        return found;
    };

    for (const expense of expenses) {
        entry(expense.paidByMemberId).paid += expense.amountMinor;

        for (const share of expense.shares) entry(share.memberId).owed += share.amountMinor;
    }

    const balances = memberIds.map((memberId) => {
        const { paid, owed } = totals.get(memberId)!;

        return { memberId, paidMinor: paid, owedMinor: owed, netMinor: paid - owed };
    });
    const sum = balances.reduce((acc, b) => acc + b.netMinor, 0);

    if (sum !== 0) throw new BalanceInvariantError(sum);

    return balances;
}

/**
 * Statement of one member: one line per expense where they paid and/or have a share,
 * in the order of `expenses` (chronological). The last running balance equals the member balance.
 */
export function buildStatement(
    memberId: string,
    baseCurrency: string,
    expenses: readonly BalanceExpense[],
): Statement {
    const lines: StatementLine[] = [];
    let running = 0;

    for (const expense of expenses) {
        const paidMinor = expense.paidByMemberId === memberId ? expense.amountMinor : 0;
        const shares = expense.shares.filter((s) => s.memberId === memberId);

        if (paidMinor === 0 && shares.length === 0) continue;

        const owedMinor = shares.reduce((acc, s) => acc + s.amountMinor, 0);
        const netMinor = paidMinor - owedMinor;

        running += netMinor;
        lines.push({
            expenseId: expense.id,
            description: expense.description,
            occurredOn: expense.occurredOn,
            original:
                expense.currency === baseCurrency
                    ? null
                    : {
                          currency: expense.currency,
                          amountMinor: expense.originalAmountMinor,
                          exchangeRate: expense.exchangeRate,
                      },
            amountMinor: expense.amountMinor,
            paidMinor,
            owedMinor,
            netMinor,
            runningBalanceMinor: running,
        });
    }

    const paid = lines.reduce((acc, l) => acc + l.paidMinor, 0);
    const owed = lines.reduce((acc, l) => acc + l.owedMinor, 0);

    return { memberId, totals: { paidMinor: paid, owedMinor: owed, netMinor: paid - owed }, lines };
}

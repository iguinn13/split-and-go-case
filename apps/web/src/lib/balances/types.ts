export interface BalanceItem {
    memberId: string;
    name: string;
    paidMinor: number;
    owedMinor: number;
    netMinor: number;
}

export interface BalancesView {
    currency: string;
    balances: BalanceItem[];
}

export interface StatementLine {
    expenseId: string;
    description: string;
    occurredOn: string;
    original: { currency: string; amountMinor: number; exchangeRate: string } | null;
    /** Expense total converted to the group's base currency (persisted value, never recomputed). */
    amountMinor: number;
    paidMinor: number;
    owedMinor: number;
    netMinor: number;
    runningBalanceMinor: number;
}

export interface Statement {
    currency: string;
    member: { id: string; name: string };
    totals: { paidMinor: number; owedMinor: number; netMinor: number };
    lines: StatementLine[];
}

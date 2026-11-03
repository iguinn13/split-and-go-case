export type SplitType = 'EQUAL' | 'PERCENTAGE' | 'FIXED';

export interface ExpenseShare {
    memberId: string;
    originalAmountMinor: number;
    amountMinor: number;
    basisPoints: number | null;
}

export interface Expense {
    id: string;
    groupId: string;
    description: string;
    currency: string;
    originalAmountMinor: number;
    exchangeRate: string;
    amountMinor: number;
    paidByMemberId: string;
    splitType: SplitType;
    occurredOn: string;
    createdByUserId: string;
    createdAt: string;
    updatedAt: string;
    shares: ExpenseShare[];
}

export interface Page<T> {
    items: T[];
    page: number;
    pageSize: number;
    total: number;
}

export interface ExchangeRateSuggestion {
    from: string;
    to: string;
    rate: string;
    date: string;
    source: string;
}

export type GroupStatus = 'OPEN' | 'CLOSED';

export interface Member {
    id: string;
    name: string;
    email: string | null;
    userId: string | null;
}

export interface Group {
    id: string;
    name: string;
    description: string | null;
    baseCurrency: string;
    status: GroupStatus;
    ownerId: string;
    closedAt: string | null;
    createdAt: string;
    members: Member[];
}

export interface GroupSummary {
    id: string;
    name: string;
    baseCurrency: string;
    status: GroupStatus;
    memberCount: number;
    createdAt: string;
}

export interface CurrencyOption {
    code: string;
    name: string;
    minorUnits: number;
}

export interface CurrentUser {
    id: string;
    name: string;
    email: string;
}

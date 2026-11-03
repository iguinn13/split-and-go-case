export type BalanceKind = 'receives' | 'owes' | 'settled';

export interface BalanceStatus {
    kind: BalanceKind;
    label: string;
    icon: string;
    textClass: string;
    borderClass: string;
    selfHeadline: string;
}

export function balanceStatus(netMinor: number): BalanceStatus {
    if (netMinor > 0) {
        return {
            kind: 'receives',
            label: 'recebe',
            icon: '+',
            selfHeadline: 'Você recebe',
            textClass: 'text-positive',
            borderClass: 'border-l-positive',
        };
    }

    if (netMinor < 0) {
        return {
            kind: 'owes',
            label: 'deve',
            icon: '−',
            selfHeadline: 'Você deve',
            textClass: 'text-negative',
            borderClass: 'border-l-negative',
        };
    }

    return {
        kind: 'settled',
        label: 'quitado',
        icon: '✓',
        selfHeadline: 'Você está quitado',
        textClass: 'text-muted-foreground',
        borderClass: 'border-l-input',
    };
}

export function magnitude(minor: number): number {
    return minor < 0 ? -minor : minor;
}

export function statementHref(groupId: string, memberId: string): string {
    return `/groups/${groupId}/members/${memberId}`;
}

export function balancesHref(groupId: string): string {
    return `/groups/${groupId}?tab=balances`;
}

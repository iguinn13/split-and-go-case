import type { SettlementTransfer } from '@prisma/client';
import type { Transfer } from './debt-simplifier.js';
import type { SettlementPlanView, TransferView } from './dto/settlement.schemas.js';

type Names = ReadonlyMap<string, string>;

const nameOf = (names: Names, memberId: string) => ({
    memberId,
    name: names.get(memberId) ?? 'Unknown',
});

const compareIds = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function toTransferView(row: SettlementTransfer, names: Names): TransferView {
    return {
        id: row.id,
        from: nameOf(names, row.fromMemberId),
        to: nameOf(names, row.toMemberId),
        amountMinor: row.amountMinor,
        status: row.status,
        paidAt: row.paidAt?.toISOString() ?? null,
    };
}

function toPlanView(
    group: { id: string; baseCurrency: string },
    status: 'OPEN' | 'CLOSED',
    transfers: TransferView[],
): SettlementPlanView {
    return {
        groupId: group.id,
        currency: group.baseCurrency,
        status,
        transferCount: transfers.length,
        totalMovedMinor: transfers.reduce((sum, t) => sum + t.amountMinor, 0),
        transfers,
    };
}

export function toOpenPlanView(
    group: { id: string; baseCurrency: string },
    plan: readonly Transfer[],
    names: Names,
): SettlementPlanView {
    return toPlanView(
        group,
        'OPEN',
        plan.map((t) => ({
            id: null,
            from: nameOf(names, t.from),
            to: nameOf(names, t.to),
            amountMinor: t.amountMinor,
            status: null,
            paidAt: null,
        })),
    );
}

/** Persisted plan (group CLOSED), in the same order as the simplifier: (from, to). */
export function toClosedPlanView(
    group: { id: string; baseCurrency: string },
    rows: readonly SettlementTransfer[],
    names: Names,
): SettlementPlanView {
    const sorted = [...rows].sort(
        (a, b) =>
            compareIds(a.fromMemberId, b.fromMemberId) || compareIds(a.toMemberId, b.toMemberId),
    );

    return toPlanView(
        group,
        'CLOSED',
        sorted.map((row) => toTransferView(row, names)),
    );
}

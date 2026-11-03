import { z } from 'zod';

export const groupParamsSchema = z.object({ groupId: z.uuid() });
export const transferParamsSchema = z.object({ groupId: z.uuid(), transferId: z.uuid() });

export type TransferStatusView = 'PENDING' | 'PAID';

export interface TransferView {
    /** Null while the plan is calculated on the fly (group OPEN). */
    id: string | null;
    from: { memberId: string; name: string };
    to: { memberId: string; name: string };
    amountMinor: number;
    /** Null while the group is OPEN. */
    status: TransferStatusView | null;
    paidAt: string | null;
}

export interface SettlementPlanView {
    groupId: string;
    currency: string;
    status: 'OPEN' | 'CLOSED';
    transferCount: number;
    totalMovedMinor: number;
    transfers: TransferView[];
}

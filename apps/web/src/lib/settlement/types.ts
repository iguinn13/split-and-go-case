export type TransferStatus = 'PENDING' | 'PAID';

export interface TransferView {
  /** Null while the plan is calculated on the fly (group OPEN). */
  id: string | null;
  from: { memberId: string; name: string };
  to: { memberId: string; name: string };
  amountMinor: number;
  status: TransferStatus | null;
  paidAt: string | null;
}

export interface SettlementPlan {
  groupId: string;
  /** Group base currency. */
  currency: string;
  status: 'OPEN' | 'CLOSED';
  transferCount: number;
  totalMovedMinor: number;
  transfers: TransferView[];
}

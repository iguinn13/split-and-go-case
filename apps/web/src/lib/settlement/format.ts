import { formatMoney } from '@/lib/money/format-money';
import type { TransferStatus, TransferView } from './types';

/** Parts of the "X paga R$ 50,00 para Y" sentence, so names and amount can be emphasized. */
export function transferSentenceParts(
  transfer: Pick<TransferView, 'from' | 'to' | 'amountMinor'>,
  currency: string,
) {
  return {
    from: transfer.from.name,
    amount: formatMoney(transfer.amountMinor, currency),
    to: transfer.to.name,
  };
}

/** Plain-text version of the sentence (used for accessible names). */
export function transferSentence(
  transfer: Pick<TransferView, 'from' | 'to' | 'amountMinor'>,
  currency: string,
): string {
  const { from, amount, to } = transferSentenceParts(transfer, currency);
  return `${from} paga ${amount} para ${to}`;
}

/** "N transferência(s)" with correct singular/plural. */
export function transferCountLabel(count: number): string {
  return count === 1 ? '1 transferência' : `${count} transferências`;
}

export function totalMovedLabel(totalMovedMinor: number, currency: string): string {
  return `Total movimentado: ${formatMoney(totalMovedMinor, currency)}`;
}

/** "x de y pagas" summary of a closed group's transfers. */
export function paidSummary(transfers: Pick<TransferView, 'status'>[]): string {
  const paid = transfers.filter((t) => t.status === 'PAID').length;
  return `${paid} de ${transfers.length} pagas`;
}

export interface TransferStatusView {
  /** Textual label: status is never conveyed by color alone. */
  label: string;
  icon: string;
  className: string;
}

/** Status indicator of a persisted transfer (icon + text + color). */
export function transferStatusView(status: TransferStatus): TransferStatusView {
  if (status === 'PAID') {
    return { label: 'Paga', icon: '✓', className: 'text-emerald-800' };
  }
  return { label: 'Pendente', icon: '◷', className: 'text-muted-foreground' };
}

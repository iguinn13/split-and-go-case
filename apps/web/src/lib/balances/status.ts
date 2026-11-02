export type BalanceKind = 'receives' | 'owes' | 'settled';

export interface BalanceStatus {
  kind: BalanceKind;
  /** Textual label: status is never conveyed by color alone. */
  label: string;
  /** Sign/icon shown next to the amount, in addition to the label and color. */
  icon: string;
  /** Tailwind text color classes with AA contrast on white. */
  textClass: string;
  borderClass: string;
}

/** Maps a net balance (minor units) to its label, icon and colors. */
export function balanceStatus(netMinor: number): BalanceStatus {
  if (netMinor > 0) {
    return {
      kind: 'receives',
      label: 'recebe',
      icon: '+',
      textClass: 'text-emerald-800',
      borderClass: 'border-l-emerald-700',
    };
  }
  if (netMinor < 0) {
    return {
      kind: 'owes',
      label: 'deve',
      icon: '−',
      textClass: 'text-danger-700',
      borderClass: 'border-l-danger-700',
    };
  }
  return {
    kind: 'settled',
    label: 'quitado',
    icon: '✓',
    textClass: 'text-muted',
    borderClass: 'border-l-line',
  };
}

/** Absolute value of an amount; the label already carries the direction. */
export function magnitude(minor: number): number {
  return minor < 0 ? -minor : minor;
}

/** Link to a member's statement. */
export function statementHref(groupId: string, memberId: string): string {
  return `/groups/${groupId}/members/${memberId}`;
}

/** Link back to the balances tab. */
export function balancesHref(groupId: string): string {
  return `/groups/${groupId}?tab=balances`;
}

/**
 * Converted total of a foreign-currency expense, when the statement line carries it:
 * only the payer's `paidMinor` equals the converted total; otherwise it is unknown.
 */
export function lineConvertedMinor(line: { paidMinor: number }): number | null {
  return line.paidMinor > 0 ? line.paidMinor : null;
}

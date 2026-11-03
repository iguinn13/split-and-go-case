export type BalanceKind = 'receives' | 'owes' | 'settled';

export interface BalanceStatus {
  kind: BalanceKind;
  /** Textual label: status is never conveyed by color alone. */
  label: string;
  /** Sign/icon shown next to the amount, in addition to the label and color. */
  icon: string;
  /** Tailwind text color classes (design tokens, AA contrast on cards and on the page). */
  textClass: string;
  borderClass: string;
  /** Headline for the signed-in user's own balance ("Você recebe" / "Você deve"). */
  selfHeadline: string;
}

/** Maps a net balance (minor units) to its label, icon and colors. */
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

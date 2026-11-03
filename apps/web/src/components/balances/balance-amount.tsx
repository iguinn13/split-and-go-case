import { balanceStatus, magnitude } from '@/lib/balances/status';
import { formatMoney } from '@/lib/money/format-money';

/** Net balance as sign/icon + amount + textual label, colored but never color-only. */
export function BalanceAmount({ netMinor, currency }: { netMinor: number; currency: string }) {
  const status = balanceStatus(netMinor);
  return (
    <p className={`shrink-0 text-right text-lg font-bold ${status.textClass}`}>
      <span aria-hidden="true">{status.icon} </span>
      <span className="sr-only">{status.label} </span>
      {formatMoney(magnitude(netMinor), currency)}
      <span aria-hidden="true" className="block text-sm font-semibold">
        {status.label}
      </span>
    </p>
  );
}

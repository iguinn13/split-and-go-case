import { formatMoney } from '@/lib/money/format-money';
import { displayRate } from './money-input';

/** "2026-07-10" -> "10/07/2026" without going through Date (no timezone shifts). */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return year && month && day ? `${day}/${month}/${year}` : isoDate;
}

/** Today as YYYY-MM-DD in the user's local calendar. */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Link target of the expenses tab, optionally on another page. */
export function expensesHref(groupId: string, page = 1): string {
  return `/groups/${groupId}?tab=expenses${page > 1 ? `&page=${page}` : ''}`;
}

/**
 * "US$ 100,00 · taxa 5,4325 · R$ 543,25" line shown for foreign-currency amounts (RF-UI-12).
 * The converted part is omitted when `convertedMinor` is null (not known to the caller).
 */
export function conversionLine(
  original: { currency: string; amountMinor: number; exchangeRate: string },
  convertedMinor: number | null,
  baseCurrency: string,
): string {
  const head = `${formatMoney(original.amountMinor, original.currency)} · taxa ${displayRate(
    original.exchangeRate,
  )}`;
  return convertedMinor === null ? head : `${head} · ${formatMoney(convertedMinor, baseCurrency)}`;
}

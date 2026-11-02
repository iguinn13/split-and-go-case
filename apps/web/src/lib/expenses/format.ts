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

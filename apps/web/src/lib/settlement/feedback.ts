/**
 * Hand-off between the settlement buttons and the refreshed page (issue #55).
 *
 * "Fechar grupo" and "Marcar como paga" call `router.refresh()`, which replaces the button that
 * had the keyboard focus. The button remembers what happened in `sessionStorage`; after the
 * refresh, `SettlementFeedback` consumes it, moves focus to the plan summary and announces the
 * result to screen readers. Everything here is plain functions so it can be unit tested.
 */
export type SettlementEvent =
  | { type: 'group-closed'; groupId: string }
  | { type: 'transfer-paid'; groupId: string; sentence: string };

/** Events older than this are stale (e.g. a refresh that never happened) and are ignored. */
export const EVENT_TTL_MS = 10_000;

/** The subset of `Storage` used here (tests pass a fake). */
export interface EventStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const FEEDBACK_KEY = 'splitgo:settlement-feedback';

function safely<T>(action: () => T): T | null {
  try {
    return action();
  } catch {
    // Storage can be unavailable (private mode, quota): feedback is then simply skipped.
    return null;
  }
}

export function rememberEvent(
  storage: EventStorage,
  event: SettlementEvent,
  now: number = Date.now(),
): void {
  safely(() => storage.setItem(FEEDBACK_KEY, JSON.stringify({ ...event, ts: now })));
}

/** Returns and clears the pending event of this group; events of other groups are kept. */
export function takeEvent(
  storage: EventStorage,
  groupId: string,
  now: number = Date.now(),
): SettlementEvent | null {
  const raw = safely(() => storage.getItem(FEEDBACK_KEY));
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    safely(() => storage.removeItem(FEEDBACK_KEY));
    return null;
  }
  const event = parsed as (Partial<SettlementEvent> & { ts?: unknown }) | null;
  const valid =
    event !== null &&
    typeof event === 'object' &&
    typeof event.groupId === 'string' &&
    typeof event.ts === 'number' &&
    (event.type === 'group-closed' ||
      (event.type === 'transfer-paid' && typeof event.sentence === 'string'));
  if (!valid) {
    safely(() => storage.removeItem(FEEDBACK_KEY));
    return null;
  }
  if (now - (event.ts as number) > EVENT_TTL_MS) {
    safely(() => storage.removeItem(FEEDBACK_KEY));
    return null;
  }
  if (event.groupId !== groupId) return null;
  safely(() => storage.removeItem(FEEDBACK_KEY));
  return event.type === 'group-closed'
    ? { type: 'group-closed', groupId: event.groupId }
    : {
        type: 'transfer-paid',
        groupId: event.groupId,
        sentence: (event as { sentence: string }).sentence,
      };
}

/** Sentence read by screen readers; `summary` is the "x de y pagas" text when there is a plan. */
export function announcementFor(event: SettlementEvent, summary: string | null): string {
  const tail = summary ? ` ${capitalize(summary)}.` : '';
  return event.type === 'group-closed'
    ? `Grupo fechado. O plano de quitação está fixo.${tail}`
    : `Transferência marcada como paga: ${event.sentence}.${tail}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface FeedbackTarget {
  focus(options?: FocusOptions): void;
}

/**
 * Consumes the pending event of the group, focuses the summary and announces the result.
 * Returns true when something was handled.
 */
export function applyFeedback(params: {
  storage: EventStorage;
  groupId: string;
  summary: string | null;
  target: FeedbackTarget | null;
  announce: (message: string) => void;
}): boolean {
  const event = takeEvent(params.storage, params.groupId);
  if (!event) return false;
  params.target?.focus({ preventScroll: false });
  params.announce(announcementFor(event, params.summary));
  return true;
}

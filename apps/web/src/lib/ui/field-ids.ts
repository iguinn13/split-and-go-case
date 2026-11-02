/** Element ids and ARIA wiring shared by the form field components. */
export interface FieldAria {
  /** Id of the error paragraph; rendered only when there is an error. */
  errorId: string;
  /** Value for `aria-describedby`: hint ids first, then the error id when present. */
  describedBy: string | undefined;
}

/**
 * Ids are always chosen explicitly by the caller (never derived from the visible label, which
 * has spaces and accents). Whitespace would split one id into several tokens in
 * `aria-describedby`/`htmlFor`, so it is rejected loudly.
 */
export function assertValidFieldId(id: string): void {
  if (id === '' || /\s/.test(id)) {
    throw new Error(`Invalid field id "${id}": it must be non-empty and contain no whitespace.`);
  }
}

/** Builds the error id and merges it with the caller's hint ids in `aria-describedby`. */
export function fieldAria(id: string, hasError: boolean, hintIds?: string): FieldAria {
  assertValidFieldId(id);
  const errorId = `${id}-error`;
  const tokens = [...(hintIds?.split(/\s+/) ?? []), ...(hasError ? [errorId] : [])].filter(Boolean);
  return { errorId, describedBy: tokens.length > 0 ? tokens.join(' ') : undefined };
}

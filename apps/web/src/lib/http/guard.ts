import { NextResponse } from 'next/server';
import { z } from 'zod';

/** True when `value` is a UUID accepted by the API (`z.uuid()`). */
export function isUuid(value: string): boolean {
  return z.uuid().safeParse(value).success;
}

/** 422 returned when a path parameter is not a UUID, before any API path is built. */
export function invalidParam(): NextResponse {
  return NextResponse.json(
    { code: 'VALIDATION_ERROR', message: 'Verifique os dados informados.' },
    { status: 422 },
  );
}

/** Validates route params; returns an error response on the first malformed UUID. */
export function guardUuids(...values: string[]): NextResponse | null {
  return values.every(isUuid) ? null : invalidParam();
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (origin === null) return true; // non-browser clients cannot ride the session cookie
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try {
    return host !== null && new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * CSRF-style hardening for Route Handlers that change state: the `Origin` header, when
 * present, must match the host, and requests with a body must declare `application/json`.
 */
export function guardMutation(
  request: Request,
  options: { json: boolean } = { json: true },
): NextResponse | null {
  if (!sameOrigin(request)) {
    return NextResponse.json(
      { code: 'FORBIDDEN', message: 'Você não tem permissão para fazer isso.' },
      { status: 403 },
    );
  }
  if (options.json) {
    const type = request.headers.get('content-type') ?? '';
    if (!type.toLowerCase().startsWith('application/json')) {
      return NextResponse.json(
        { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Formato de requisição não suportado.' },
        { status: 415 },
      );
    }
  }
  return null;
}

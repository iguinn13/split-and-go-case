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

/**
 * Host the browser used to reach the app. `Host` is authoritative; `X-Forwarded-Host` is only
 * honoured when the deployment declares a trusted reverse proxy (`WEB_TRUST_FORWARDED_HOST=1`),
 * because otherwise any client could pick the value the Origin is compared against.
 */
function requestHost(request: Request): string | null {
  const forwarded =
    process.env['WEB_TRUST_FORWARDED_HOST'] === '1'
      ? request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
      : undefined;
  return forwarded || request.headers.get('host');
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (origin === null) return true; // non-browser clients cannot ride the session cookie
  const host = requestHost(request);
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

/**
 * Guard for safe (read-only) proxy handlers. They change nothing, so no Origin is required;
 * browsers that declare a cross-site context (`Sec-Fetch-Site`) are refused so another site
 * cannot spend the user's session on the API or the rate provider.
 */
export function guardRead(request: Request): NextResponse | null {
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json(
      { code: 'FORBIDDEN', message: 'Você não tem permissão para fazer isso.' },
      { status: 403 },
    );
  }
  return null;
}

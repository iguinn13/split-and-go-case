import { NextResponse } from 'next/server';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session';

/** Clears the session cookie and sends the user to the login screen. */
export function POST(request: Request) {
  const url = new URL('/login', request.url);
  const response = NextResponse.redirect(url, 303);
  response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 });
  return response;
}

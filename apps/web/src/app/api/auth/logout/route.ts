import { NextResponse } from 'next/server';
import { guardMutation } from '@/lib/http/guard';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session';

/** Clears the session cookie and sends the user to the login screen. */
export function POST(request: Request) {
    // The form posts without a body, so only the Origin check applies.
    const blocked = guardMutation(request, { json: false });

    if (blocked) return blocked;

    // Relative Location: independent of the host name this process thinks it is serving.
    const response = new NextResponse(null, { status: 303, headers: { Location: '/login' } });

    response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 });

    return response;
}

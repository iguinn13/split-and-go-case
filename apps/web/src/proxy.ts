import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/session';

const AUTH_PAGES = ['/login', '/register'];

/**
 * Next.js 16 name for the former `middleware`: protects routes without a session
 * and keeps signed-in users away from the auth screens.
 */
export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
    const isAuthPage = AUTH_PAGES.includes(pathname);

    if (isAuthPage && hasSession) {
        return NextResponse.redirect(new URL('/groups', request.url));
    }

    if (!isAuthPage && !hasSession) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
}

export const config = {
    // Protected: every path except the home page, auth handlers (/api) and static assets;
    // the auth pages are matched only to redirect signed-in users.
    matcher: ['/((?!api/|_next/|favicon\\.ico).+)'],
};

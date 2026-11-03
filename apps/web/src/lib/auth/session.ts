import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'sg_session';
/** Matches the 24h JWT expiration of the API. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

export const sessionCookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
};

/** Reads the JWT on the server only. Never pass it to client components. */
export async function getSessionToken(): Promise<string | undefined> {
    return (await cookies()).get(SESSION_COOKIE)?.value;
}

import { redirect } from 'next/navigation';
import { SESSION_EXPIRED_PATH } from '@/lib/auth/paths';
import { getSessionToken } from '@/lib/auth/session';
import { apiFetch, type ApiRequestOptions } from './client';
import { ApiError } from './errors';

export { SESSION_EXPIRED_PATH };

/**
 * Server-only API call that attaches the JWT from the httpOnly cookie.
 * Without a session, or on a 401, it sends the user to the page
 * that confirms the rejection and signs out (a POST) before landing on /login.
 */
export async function serverApi<T>(
    path: string,
    options: Omit<ApiRequestOptions, 'token'> = {},
): Promise<T> {
    const token = await getSessionToken();

    if (!token) redirect(SESSION_EXPIRED_PATH);

    try {
        return await apiFetch<T>(path, { ...options, token });
    } catch (error) {
        if (error instanceof ApiError && error.statusCode === 401) redirect(SESSION_EXPIRED_PATH);

        throw error;
    }
}

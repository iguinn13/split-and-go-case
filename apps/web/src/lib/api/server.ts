import { redirect } from 'next/navigation';
import { getSessionToken } from '@/lib/auth/session';
import { apiFetch, type ApiRequestOptions } from './client';
import { ApiError } from './errors';

export const SESSION_EXPIRED_PATH = '/api/auth/expired';

/**
 * Server-only API call that attaches the JWT from the httpOnly cookie.
 * Without a session, or on a 401, it sends the user through the route handler
 * that clears the cookie and redirects to /login.
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

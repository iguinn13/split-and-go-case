import { ApiError, type ApiErrorDetail } from './errors';

export interface ApiRequestOptions {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: unknown;
    /** JWT read from the httpOnly cookie on the server; never available to client JS. */
    token?: string;
    query?: Record<string, string | number | undefined>;
    signal?: AbortSignal;
}

export function getApiUrl(): string {
    const url = process.env['API_URL'];

    if (!url) throw new Error('API_URL is not set');

    return url.replace(/\/+$/, '');
}

interface ErrorBody {
    statusCode?: number;
    code?: string;
    message?: string;
    details?: ApiErrorDetail[];
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const { method = 'GET', body, token, query, signal } = options;
    const url = new URL(`${getApiUrl()}${path}`);

    for (const [key, value] of Object.entries(query ?? {})) {
        if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = { Accept: 'application/json' };

    if (body !== undefined) headers['Content-Type'] = 'application/json';

    if (token) headers['Authorization'] = `Bearer ${token}`;

    let response: Response;

    try {
        response = await fetch(url, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal,
            cache: 'no-store',
        });
    } catch {
        throw new ApiError(0, 'NETWORK_ERROR', 'Network error');
    }

    if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as ErrorBody;

        throw new ApiError(
            data.statusCode ?? response.status,
            data.code ?? 'INTERNAL_ERROR',
            data.message ?? response.statusText,
            data.details,
        );
    }

    if (response.status === 204) return undefined as T;

    return (await response.json()) as T;
}

import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';
import { guardMutation } from '@/lib/http/guard';
import { loginSchema } from '@/lib/auth/schemas';
import { errorResponse, readJson, type LoginResponse } from '@/lib/auth/route-utils';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, sessionCookieOptions } from '@/lib/auth/session';

export async function POST(request: Request) {
    const blocked = guardMutation(request);

    if (blocked) return blocked;

    const parsed = loginSchema.safeParse(await readJson(request));

    if (!parsed.success) {
        return NextResponse.json(
            { code: 'VALIDATION_ERROR', message: 'Verifique os dados informados.' },
            { status: 422 },
        );
    }

    try {
        const { accessToken, user } = await apiFetch<LoginResponse>('/auth/login', {
            method: 'POST',
            body: parsed.data,
        });
        const response = NextResponse.json({ user });

        response.cookies.set(SESSION_COOKIE, accessToken, {
            ...sessionCookieOptions,
            maxAge: SESSION_MAX_AGE_SECONDS,
        });

        return response;
    } catch (error) {
        return errorResponse(error);
    }
}

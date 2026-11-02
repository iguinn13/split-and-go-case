import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';
import { guardMutation } from '@/lib/http/guard';
import { registerSchema } from '@/lib/auth/schemas';
import { errorResponse, readJson, type AuthUser, type LoginResponse } from '@/lib/auth/route-utils';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, sessionCookieOptions } from '@/lib/auth/session';

/** Registers the user and signs them in right away (token goes to the httpOnly cookie). */
export async function POST(request: Request) {
  const blocked = guardMutation(request);
  if (blocked) return blocked;
  const parsed = registerSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'Verifique os dados informados.' },
      { status: 422 },
    );
  }
  try {
    await apiFetch<AuthUser>('/auth/register', { method: 'POST', body: parsed.data });
    const { accessToken, user } = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email: parsed.data.email, password: parsed.data.password },
    });
    const response = NextResponse.json({ user }, { status: 201 });
    response.cookies.set(SESSION_COOKIE, accessToken, {
      ...sessionCookieOptions,
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

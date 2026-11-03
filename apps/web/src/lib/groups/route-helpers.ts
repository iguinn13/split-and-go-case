import { NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/auth/session';

/** 401 JSON used by the group Route Handlers when there is no session cookie. */
export function unauthorized() {
    return NextResponse.json(
        { code: 'UNAUTHORIZED', message: 'Sua sessão expirou. Entre novamente.' },
        { status: 401 },
    );
}

export async function requireToken(): Promise<string | null> {
    return (await getSessionToken()) ?? null;
}

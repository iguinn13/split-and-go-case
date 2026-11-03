import { NextResponse } from 'next/server';
import { ApiError, errorMessage } from '@/lib/api';

export interface AuthUser {
    id: string;
    name: string;
    email: string;
}

export interface LoginResponse {
    accessToken: string;
    user: AuthUser;
}

/** Converts an API/network failure into a pt-BR JSON response for the forms. */
export function errorResponse(error: unknown) {
    if (error instanceof ApiError) {
        const status = error.statusCode >= 400 ? error.statusCode : 503;

        return NextResponse.json(
            { code: error.code, message: errorMessage(error.code) },
            { status },
        );
    }

    return NextResponse.json(
        { code: 'INTERNAL_ERROR', message: errorMessage('INTERNAL_ERROR') },
        { status: 500 },
    );
}

export async function readJson(request: Request): Promise<unknown> {
    return request.json().catch(() => null);
}

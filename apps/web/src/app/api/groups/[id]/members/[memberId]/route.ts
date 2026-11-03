import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';
import { errorResponse } from '@/lib/auth/route-utils';
import { requireToken, unauthorized } from '@/lib/groups/route-helpers';
import { guardMutation, guardUuids } from '@/lib/http/guard';

export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string; memberId: string }> },
) {
    const blocked = guardMutation(request, { json: false });

    if (blocked) return blocked;

    const token = await requireToken();

    if (!token) return unauthorized();

    const { id, memberId } = await context.params;
    const badParam = guardUuids(id, memberId);

    if (badParam) return badParam;

    try {
        await apiFetch<void>(`/groups/${id}/members/${memberId}`, { method: 'DELETE', token });

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return errorResponse(error);
    }
}

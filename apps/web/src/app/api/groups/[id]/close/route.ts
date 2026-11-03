import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';
import { errorResponse } from '@/lib/auth/route-utils';
import { requireToken, unauthorized } from '@/lib/groups/route-helpers';
import { guardMutation, guardUuids } from '@/lib/http/guard';
import type { SettlementPlan } from '@/lib/settlement/types';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    const blocked = guardMutation(request, { json: false });

    if (blocked) return blocked;

    const token = await requireToken();

    if (!token) return unauthorized();

    const { id } = await context.params;
    const badParam = guardUuids(id);

    if (badParam) return badParam;

    try {
        const plan = await apiFetch<SettlementPlan>(`/groups/${id}/close`, {
            method: 'POST',
            token,
        });

        return NextResponse.json(plan);
    } catch (error) {
        return errorResponse(error);
    }
}

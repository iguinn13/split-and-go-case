import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';
import { errorResponse, readJson } from '@/lib/auth/route-utils';
import { buildExpensePayloadSchema } from '@/lib/expenses/schemas';
import { requireToken, unauthorized } from '@/lib/groups/route-helpers';
import { guardMutation, guardUuids, invalidParam } from '@/lib/http/guard';

type Context = { params: Promise<{ id: string; expenseId: string }> };

export async function PUT(request: Request, context: Context) {
    const blocked = guardMutation(request);

    if (blocked) return blocked;

    const token = await requireToken();

    if (!token) return unauthorized();

    const { id, expenseId } = await context.params;
    const badParam = guardUuids(id, expenseId);

    if (badParam) return badParam;

    const parsed = buildExpensePayloadSchema().safeParse(await readJson(request));

    if (!parsed.success) return invalidParam();

    try {
        const expense = await apiFetch<unknown>(`/groups/${id}/expenses/${expenseId}`, {
            method: 'PUT',
            token,
            body: parsed.data,
        });

        return NextResponse.json(expense);
    } catch (error) {
        return errorResponse(error);
    }
}

export async function DELETE(request: Request, context: Context) {
    const blocked = guardMutation(request, { json: false });

    if (blocked) return blocked;

    const token = await requireToken();

    if (!token) return unauthorized();

    const { id, expenseId } = await context.params;
    const badParam = guardUuids(id, expenseId);

    if (badParam) return badParam;

    try {
        await apiFetch<void>(`/groups/${id}/expenses/${expenseId}`, { method: 'DELETE', token });

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return errorResponse(error);
    }
}

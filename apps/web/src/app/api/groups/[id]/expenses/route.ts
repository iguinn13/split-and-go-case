import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';
import { errorResponse, readJson } from '@/lib/auth/route-utils';
import { buildExpensePayloadSchema } from '@/lib/expenses/schemas';
import { requireToken, unauthorized } from '@/lib/groups/route-helpers';
import { guardMutation, guardUuids, invalidParam } from '@/lib/http/guard';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = guardMutation(request);
  if (blocked) return blocked;
  const token = await requireToken();
  if (!token) return unauthorized();
  const { id } = await context.params;
  const badParam = guardUuids(id);
  if (badParam) return badParam;

  const parsed = buildExpensePayloadSchema().safeParse(await readJson(request));
  if (!parsed.success) return invalidParam();
  try {
    const expense = await apiFetch<unknown>(`/groups/${id}/expenses`, {
      method: 'POST',
      token,
      body: parsed.data,
    });
    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

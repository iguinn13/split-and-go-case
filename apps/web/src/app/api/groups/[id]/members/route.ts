import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';
import { errorResponse, readJson } from '@/lib/auth/route-utils';
import { memberSchema } from '@/lib/groups/schemas';
import { requireToken, unauthorized } from '@/lib/groups/route-helpers';
import { guardMutation, guardUuids } from '@/lib/http/guard';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = guardMutation(request);
  if (blocked) return blocked;
  const token = await requireToken();
  if (!token) return unauthorized();
  const { id } = await context.params;
  const badParam = guardUuids(id);
  if (badParam) return badParam;
  const parsed = memberSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'Verifique os dados informados.' },
      { status: 422 },
    );
  }
  try {
    const member = await apiFetch<unknown>(`/groups/${id}/members`, {
      method: 'POST',
      token,
      body: {
        name: parsed.data.name,
        ...(parsed.data.email ? { email: parsed.data.email } : {}),
      },
    });
    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

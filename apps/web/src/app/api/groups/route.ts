import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';
import { errorResponse, readJson } from '@/lib/auth/route-utils';
import { createGroupFormSchema, toCreateGroupPayload } from '@/lib/groups/schemas';
import { requireToken, unauthorized } from '@/lib/groups/route-helpers';
import type { Group } from '@/lib/groups/types';

export async function POST(request: Request) {
  const token = await requireToken();
  if (!token) return unauthorized();
  const parsed = createGroupFormSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'Verifique os dados informados.' },
      { status: 422 },
    );
  }
  try {
    const group = await apiFetch<Group>('/groups', {
      method: 'POST',
      token,
      body: toCreateGroupPayload(parsed.data),
    });
    return NextResponse.json({ id: group.id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

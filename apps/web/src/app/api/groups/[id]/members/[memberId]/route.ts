import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';
import { errorResponse } from '@/lib/auth/route-utils';
import { requireToken, unauthorized } from '@/lib/groups/route-helpers';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; memberId: string }> },
) {
  const token = await requireToken();
  if (!token) return unauthorized();
  const { id, memberId } = await context.params;
  try {
    await apiFetch<void>(
      `/groups/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}`,
      { method: 'DELETE', token },
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}

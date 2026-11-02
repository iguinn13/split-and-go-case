import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';
import { errorResponse } from '@/lib/auth/route-utils';
import { requireToken, unauthorized } from '@/lib/groups/route-helpers';
import { guardMutation, guardUuids } from '@/lib/http/guard';
import type { TransferView } from '@/lib/settlement/types';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; transferId: string }> },
) {
  const blocked = guardMutation(request, { json: false });
  if (blocked) return blocked;
  const token = await requireToken();
  if (!token) return unauthorized();
  const { id, transferId } = await context.params;
  const badParam = guardUuids(id, transferId);
  if (badParam) return badParam;
  try {
    const transfer = await apiFetch<TransferView>(`/groups/${id}/transfers/${transferId}/pay`, {
      method: 'PATCH',
      token,
    });
    return NextResponse.json(transfer);
  } catch (error) {
    return errorResponse(error);
  }
}

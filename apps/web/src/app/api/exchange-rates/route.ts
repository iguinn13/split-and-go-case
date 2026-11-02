import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';
import { errorResponse } from '@/lib/auth/route-utils';
import { exchangeRateQuerySchema } from '@/lib/expenses/schemas';
import { requireToken, unauthorized } from '@/lib/groups/route-helpers';
import { guardRead, invalidParam } from '@/lib/http/guard';

/** Proxies the rate suggestion so the JWT stays server-side. */
export async function GET(request: Request) {
  const blocked = guardRead(request);
  if (blocked) return blocked;
  const token = await requireToken();
  if (!token) return unauthorized();
  const { searchParams } = new URL(request.url);
  const parsed = exchangeRateQuerySchema.safeParse({
    from: searchParams.get('from'),
    to: searchParams.get('to'),
    date: searchParams.get('date') ?? undefined,
  });
  if (!parsed.success) return invalidParam();
  try {
    const suggestion = await apiFetch<unknown>('/exchange-rates', {
      token,
      query: parsed.data,
    });
    return NextResponse.json(suggestion);
  } catch (error) {
    return errorResponse(error);
  }
}

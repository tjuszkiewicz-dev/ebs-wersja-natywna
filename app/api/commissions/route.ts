// GET /api/commissions?agentId=...
// Zwraca prowizje agenta.
// Agent widzi tylko swoje (agentId == user.id), superadmin widzi wszystkie.
//
// Query params:
//   agentId? — UUID agenta (jeśli pominięty, używa user.id)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthUserWithRole, unauthorized, badRequest, serverError, forbidden } from '@/lib/apiAuth';
import { getAgentCommissions } from '@/lib/vouchers';

const QuerySchema = z.object({
  agentId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  const user = await getAuthUserWithRole();
  if (!user) return unauthorized();

  const { searchParams } = request.nextUrl;
  const parsed = QuerySchema.safeParse({ agentId: searchParams.get('agentId') ?? undefined });

  if (!parsed.success) {
    return badRequest(parsed.error.issues[0].message);
  }

  const targetId = parsed.data.agentId ?? user.id;

  // Agent widzi tylko WŁASNE prowizje; cudze — wyłącznie superadmin (IDOR fix)
  if (targetId !== user.id && user.role !== 'superadmin') {
    return forbidden();
  }

  const result = await getAgentCommissions(targetId);
  if (result.error) return serverError(result.error.message);

  return Response.json({ data: result.data, error: null });
}

// GET /api/vouchers/balance
// Zwraca saldo voucherowe zalogowanego użytkownika (lub wskazanego userId dla admina).
//
// Query params:
//   userId? — opcjonalne, tylko dla superadmina

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/apiAuth';
import { getVoucherBalance } from '@/lib/vouchers';

const QuerySchema = z.object({
  userId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { searchParams } = request.nextUrl;
  const parsed = QuerySchema.safeParse({ userId: searchParams.get('userId') ?? undefined });

  if (!parsed.success) {
    return badRequest(parsed.error.issues[0].message);
  }

  // Użyj podanego userId (admin) lub własnego
  const targetId = parsed.data.userId ?? user.id;

  const result = await getVoucherBalance(targetId);
  if (result.error) return serverError(result.error.message);

  return Response.json({ data: result.data, error: null });
}

// GET /api/orders?companyId=...
// Zwraca historię zamówień firmy.
// Dostępne dla pracodawcy swojej firmy i superadmina.

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/apiAuth';
import { getCompanyOrders } from '@/lib/vouchers';

const QuerySchema = z.object({
  companyId: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { searchParams } = request.nextUrl;
  const parsed = QuerySchema.safeParse({ companyId: searchParams.get('companyId') });

  if (!parsed.success) {
    return badRequest('Wymagany parametr: companyId (UUID)');
  }

  const result = await getCompanyOrders(parsed.data.companyId);
  if (result.error) return serverError(result.error.message);

  return Response.json({ data: result.data, error: null });
}

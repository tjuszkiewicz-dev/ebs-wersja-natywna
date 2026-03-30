// POST /api/vouchers/purchase
// Tworzy zamówienie i emituje vouchery po potwierdzeniu płatności.
// Tylko dla roli pracodawca (HR) lub superadmin — sprawdzane przez RLS w bazie.
//
// Body: { companyId, amountPln, validMonths?, isFirstInvoice? }

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/apiAuth';
import { purchaseVouchers, calculateAndSaveCommissions } from '@/lib/vouchers';

const BodySchema = z.object({
  companyId:       z.string().uuid(),
  amountPln:       z.number().positive(),
  validMonths:     z.number().int().min(1).max(36).optional(),
  isFirstInvoice:  z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Nieprawidłowy JSON');
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0].message);
  }

  const { companyId, amountPln, validMonths, isFirstInvoice } = parsed.data;

  // 1. Utwórz zamówienie i emituj vouchery
  const orderResult = await purchaseVouchers({
    companyId,
    hrUserId:       user.id,
    amountPln,
    validMonths,
    isFirstInvoice,
  });

  if (orderResult.error) return serverError(orderResult.error.message);

  // 2. Nalicz prowizje dla agentów
  const order = orderResult.data;
  await calculateAndSaveCommissions(order.id, amountPln, companyId, isFirstInvoice);

  return Response.json({ data: order, error: null }, { status: 201 });
}

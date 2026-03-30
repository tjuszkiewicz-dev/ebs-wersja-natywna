// POST /api/vouchers/transfer
// Atomiczny transfer voucherów między użytkownikami.
// Wywołuje SQL transfer_vouchers() — nigdy bezpośredni UPDATE salda.
//
// Body: { toUserId, amount, type, orderId? }

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/apiAuth';
import { transferVouchers } from '@/lib/vouchers';

const BodySchema = z.object({
  toUserId: z.string().uuid(),
  amount:   z.number().int().positive(),
  type:     z.enum(['zakup', 'przekazanie', 'wykorzystanie', 'zwrot', 'emisja', 'odkup']),
  orderId:  z.string().uuid().optional(),
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

  const { toUserId, amount, type, orderId } = parsed.data;

  const result = await transferVouchers({
    fromUserId: user.id,
    toUserId,
    amount,
    type,
    orderId,
  });

  if (result.error) return serverError(result.error.message);

  return Response.json({ data: null, error: null }, { status: 200 });
}

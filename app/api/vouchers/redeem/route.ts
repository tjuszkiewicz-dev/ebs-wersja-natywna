// POST /api/vouchers/redeem
// Realizacja vouchera przez numer seryjny.
// Wywołuje SQL redeem_voucher() — atomowa operacja.
//
// Body: { serialNumber, serviceId?, serviceName? }

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/apiAuth';
import { redeemVoucher } from '@/lib/vouchers';

const BodySchema = z.object({
  serialNumber: z.string().min(1),
  serviceId:    z.string().uuid().optional(),
  serviceName:  z.string().min(1).max(200).optional(),
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

  const result = await redeemVoucher({
    serialNumber: parsed.data.serialNumber,
    userId:       user.id,
    serviceId:    parsed.data.serviceId,
    serviceName:  parsed.data.serviceName,
  });

  if (result.error) return serverError(result.error.message);

  // data to confirmationCode zwrócony przez SQL
  return Response.json({ data: result.data, error: null }, { status: 200 });
}

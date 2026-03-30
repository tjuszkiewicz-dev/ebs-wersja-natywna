// POST /api/vouchers/emit — ręczna emisja do puli platformy (tylko superadmin)
// Mints vouchery na konto superadmina jako operatora platformy.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

const EmitSchema = z.object({
  amount:      z.number().int().positive().max(1_000_000),
  description: z.string().min(3).max(500),
});

export async function POST(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const parsed = EmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { amount, description } = parsed.data;
  const supabase = supabaseServer();
  const emissionId = `EMISJA-MANUAL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  // Użyj fikcyjnego company_id dla puli platformy lub własnego konta admina
  const { error } = await supabase.rpc('mint_vouchers', {
    p_order_id:     emissionId,   // order_id jako referencja emisji
    p_company_id:   auth.id,      // superadmin jako właściciel puli
    p_owner_id:     auth.id,
    p_quantity:     amount,
    p_valid_months: 24,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Powiadomienie do wszystkich adminów
  await supabase.from('notifications').insert({
    user_id: 'ALL_ADMINS',
    message: `Nowa emisja manualna: ${amount} pkt. ID: ${emissionId}. Powód: ${description}`,
    type:    'INFO',
  });

  return NextResponse.json({ emitted: amount, emissionId }, { status: 201 });
}

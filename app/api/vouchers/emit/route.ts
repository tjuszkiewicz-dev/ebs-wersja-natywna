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

  // UWAGA: funkcja świadomie WYŁĄCZONA (501). Poprzednia implementacja rzucała 500 przy każdym
  // wywołaniu: `mint_vouchers` wymaga p_order_id UUID i p_company_id → companies(id), a przekazywano
  // string `EMISJA-MANUAL-…` oraz `auth.id` (id usera, nie firmy) → błąd castu / naruszenie FK.
  // „Emisja do puli platformy" nie ma odzwierciedlenia w schemacie (voucher wymaga realnej firmy
  // i zamówienia). Do włączenia trzeba decyzji produktowej: wybór firmy docelowej + realne zamówienie.
  void parsed.data;
  return NextResponse.json(
    { error: 'Ręczna emisja voucherów jest tymczasowo niedostępna — wymaga wyboru firmy docelowej (w przygotowaniu).' },
    { status: 501 },
  );
}

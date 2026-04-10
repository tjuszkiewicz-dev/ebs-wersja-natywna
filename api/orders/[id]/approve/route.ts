// PATCH /api/orders/[id]/approve — zatwierdź zamówienie i wyemituj vouchery
// Tylko superadmin. Emituje vouchery przez mint_vouchers(), opcjonalnie auto-dystrybuuje (Trust Model).

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = supabaseServer();
  const orderId = params.id;

  const { data: order, error: fetchErr } = await supabase
    .from('voucher_orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (fetchErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.status !== 'pending') return NextResponse.json({ error: 'Order already processed' }, { status: 409 });

  // 1. Update status → approved
  const { error: updateErr } = await supabase
    .from('voucher_orders')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // NOTE: Vouchers are NOT minted and NOT distributed at approve time.
  // Minting and distribution happen in PATCH /api/orders/[id]/pay after payment is confirmed.

  return NextResponse.json({ approved: true, distributed: 0, batchCreated: false });
}

// PATCH /api/orders/[id]/pay — potwierdź płatność i nalicz prowizje
// Tylko superadmin. Zmienia status na 'paid', nalicza prowizje.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { calculateAndSaveCommissions } from '@/lib/vouchers';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = supabaseServer();

  const { data: order, error: fetchErr } = await supabase
    .from('voucher_orders')
    .select('*')
    .eq('id', params.id)
    .single();

  if (fetchErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.status !== 'approved') return NextResponse.json({ error: 'Order must be approved first' }, { status: 409 });

  // Mark as paid
  const { error: updateErr } = await supabase
    .from('voucher_orders')
    .update({ status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', params.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Calculate and save commissions (prowizje zawsze w PLN)
  await calculateAndSaveCommissions(
    params.id,
    Number(order.fee_pln),
    order.company_id,
    order.is_first_invoice
  );

  return NextResponse.json({ paid: true });
}

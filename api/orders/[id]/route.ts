// DELETE /api/orders/[id] — usuń zamówienie w statusie pending (tylko pracodawca/superadmin)

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['pracodawca', 'superadmin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { id: orderId } = await params;

  const { data: order, error: fetchErr } = await supabase
    .from('voucher_orders')
    .select('id, status, company_id')
    .eq('id', orderId)
    .single();

  if (fetchErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.status !== 'pending') {
    return NextResponse.json({ error: 'Można usunąć tylko zamówienia w statusie "oczekuje"' }, { status: 409 });
  }

  // Pracodawca może usuwać tylko zamówienia swojej firmy
  if (auth.role === 'pracodawca') {
    const { data: hrProfile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', auth.id)
      .single();
    if (hrProfile?.company_id !== order.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const { error: delErr } = await supabase
    .from('voucher_orders')
    .delete()
    .eq('id', orderId);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ deleted: true });
}

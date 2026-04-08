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

  // 2. Emit vouchers — minted to the HR user (company account owner)
  const { error: mintErr } = await supabase.rpc('mint_vouchers', {
    p_order_id:     orderId,
    p_company_id:   order.company_id,
    p_owner_id:     order.hr_user_id,
    p_quantity:     order.amount_vouchers,
    p_valid_months: 12,
  });

  if (mintErr) return NextResponse.json({ error: mintErr.message }, { status: 500 });

  // 3. Auto-distribute if payroll plan exists (Trust Model — before payment)
  const planSource: any[] = (order.payroll_snapshots as any[] | null) ?? (order.distribution_plan as any[] | null) ?? [];
  let distributedCount = 0;
  const batchItems: { userId: string; userName: string; amount: number }[] = [];

  for (const entry of planSource) {
    const userId = entry.matched_user_id ?? entry.matchedUserId;
    const amount = Math.floor(entry.final_netto_voucher ?? entry.voucherPartNet ?? 0);
    if (!userId || amount <= 0) continue;

    const { data: distCount, error: transferErr } = await (supabase.rpc as any)('distribute_to_employee', {
      p_company_id:   order.company_id,
      p_from_user_id: order.hr_user_id,
      p_to_user_id:   userId,
      p_amount:       amount,
      p_order_id:     orderId,
    });

    if (transferErr) continue;
    const actualAmount = (Number(distCount) || amount);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', userId)
      .single();

    batchItems.push({ userId, userName: profile?.full_name ?? userId, amount: actualAmount });
    distributedCount += actualAmount;

    // In-app notification for employee
    await supabase.from('notifications').insert({
      user_id: userId,
      message: `Otrzymałeś ${actualAmount} nowych voucherów (dystrybucja automatyczna).`,
      type:    'SUCCESS',
    });
  }

  // 4. Save distribution batch protocol
  if (batchItems.length > 0) {
    const batchId = `PROTOCOL-AUTO-${new Date().toISOString().slice(0, 10)}-${orderId.slice(-8).toUpperCase()}`;

    const { error: batchErr } = await supabase
      .from('distribution_batches')
      .insert({
        id:           batchId,
        company_id:   order.company_id,
        hr_user_id:   order.hr_user_id,
        hr_name:      'System (Auto-Trust)',
        total_amount: distributedCount,
        order_id:     orderId,
        status:       'completed',
      });

    if (!batchErr) {
      await supabase
        .from('distribution_batch_items')
        .insert(batchItems.map(item => ({
          batch_id:  batchId,
          user_id:   item.userId,
          user_name: item.userName,
          amount:    item.amount,
        })));
    }
  }

  return NextResponse.json({
    approved:     true,
    distributed:  distributedCount,
    batchCreated: batchItems.length > 0,
  });
}

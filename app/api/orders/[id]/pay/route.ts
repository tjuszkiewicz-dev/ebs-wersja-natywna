// PATCH /api/orders/[id]/pay — potwierdź płatność, emituj vouchery i dystrybuuj do pracowników
// Tylko superadmin. Dopiero tutaj następuje emisja voucherów i dystrybucja do pracowników.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { calculateAndSaveCommissions } from '@/lib/vouchers';

function parsePlannedAmount(entry: any): number {
  const raw = entry?.final_netto_voucher ?? entry?.voucherPartNet ?? entry?.amount ?? 0;
  const amount = Number(raw);
  return Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
}

async function buildEmailToAuthId(supabase: any): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data } = await supabase.auth.admin.listUsers({ perPage: 1000, page });
    const users = data?.users ?? [];
    for (const u of users) {
      if (u.email) map.set(u.email.toLowerCase(), u.id);
    }
    if (users.length < 1000) break;
    page++;
  }
  return map;
}

async function resolveEmployeeId(
  supabase: any,
  companyId: string,
  entry: any,
  emailToAuthId: Map<string, string>,
): Promise<string | null> {
  // 1. Direct UUID stored at order-creation time — validate it still exists
  const direct = entry?.matched_user_id ?? entry?.matchedUserId;
  if (direct) {
    const { data: profileCheck } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', direct)
      .eq('company_id', companyId)
      .eq('role', 'pracownik')
      .maybeSingle();
    if (profileCheck?.id) return profileCheck.id;
    // UUID is stale/invalid — fall through to PESEL/email lookup
  }

  // 2. PESEL lookup in user_profiles
  const pesel = String(entry?.employee_pesel ?? entry?.pesel ?? '').replace(/\D+/g, '');
  if (pesel) {
    const { data: profileByPesel } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('company_id', companyId)
      .eq('role', 'pracownik')
      .eq('pesel', pesel)
      .maybeSingle();
    if (profileByPesel?.id) return profileByPesel.id;
  }

  // 3. Email lookup — emailToAuthId already covers all auth pages (built with pagination)
  const email = String(entry?.email ?? entry?.employee_email ?? '').trim().toLowerCase();
  if (email && emailToAuthId.has(email)) {
    return emailToAuthId.get(email) ?? null;
  }

  return null;
}

export async function PATCH(
  _req: NextRequest,
  { params: __paramsP }: { params: Promise<{ id: string }> }
) {
  const params = await __paramsP;
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
  if (!['approved', 'paid'].includes(order.status)) {
    return NextResponse.json({ error: 'Order must be approved first' }, { status: 409 });
  }

  // 1. Mark as paid
  if (order.status !== 'paid') {
    const { error: updateErr } = await supabase
      .from('voucher_orders')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 2. Emit vouchers — minted to the HR user (company account owner)
  // Use voucher_valid_until stored at hr-confirm time to prevent wrong-month expiry
  const storedValidUntil: string | null = (order as any).voucher_valid_until ?? null;

  const { count: mintedCount } = await supabase
    .from('vouchers')
    .select('id', { head: true, count: 'exact' })
    .eq('order_id', orderId);

  if ((mintedCount ?? 0) === 0) {
    const { error: mintErr } = await supabase.rpc('mint_vouchers', {
      p_order_id:     orderId,
      p_company_id:   order.company_id,
      p_owner_id:     order.hr_user_id,
      p_quantity:     order.amount_vouchers,
      p_valid_months: 12,
      p_valid_until:  storedValidUntil,
    });

    if (mintErr) return NextResponse.json({ error: mintErr.message }, { status: 500 });
  }

  // 3. Auto-distribute based on payroll plan in order
  const planSource: any[] =
    (order.payroll_snapshots as any[] | null) ??
    (order.distribution_plan as any[] | null) ??
    [];

  const emailToAuthId = await buildEmailToAuthId(supabase);

  let distributedCount = 0;
  const batchItems: { userId: string; userName: string; amount: number }[] = [];

  for (const entry of planSource) {
    const userId = await resolveEmployeeId(supabase, order.company_id, entry, emailToAuthId);
    const targetAmount = parsePlannedAmount(entry);
    if (!userId || targetAmount <= 0) continue;

    const { count: alreadyOwned } = await supabase
      .from('vouchers')
      .select('id', { head: true, count: 'exact' })
      .eq('order_id', orderId)
      .eq('current_owner_id', userId);

    const amount = Math.max(0, targetAmount - (alreadyOwned ?? 0));
    if (amount <= 0) continue;

    const { data: distCount, error: transferErr } = await (supabase.rpc as any)('distribute_to_employee', {
      p_company_id:   order.company_id,
      p_from_user_id: order.hr_user_id,
      p_to_user_id:   userId,
      p_amount:       amount,
      p_order_id:     orderId,
      p_valid_until:  storedValidUntil,
    });

    if (transferErr) {
      console.error(`[pay] distribute_to_employee failed for userId=${userId} orderId=${orderId}:`, transferErr.message);
      continue;
    }
    const actualAmount = Number(distCount) > 0 ? Number(distCount) : amount;

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
      message: `Otrzymałeś ${actualAmount} nowych voucherów od pracodawcy.`,
      type:    'SUCCESS',
    });
  }

  // 4. Save distribution batch protocol
  if (batchItems.length > 0) {
    const batchId = `PROTOCOL-PAY-${new Date().toISOString().slice(0, 10)}-${orderId.slice(-8).toUpperCase()}`;

    const { error: batchErr } = await supabase
      .from('distribution_batches')
      .insert({
        id:           batchId,
        company_id:   order.company_id,
        hr_user_id:   order.hr_user_id,
        hr_name:      'System (Po opłaceniu)',
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

  // 5. Calculate and save commissions (prowizje zawsze w PLN)
  await calculateAndSaveCommissions(
    orderId,
    Number(order.fee_pln),
    order.company_id,
    order.is_first_invoice
  );

  return NextResponse.json({ paid: true, distributed: distributedCount, batchCreated: batchItems.length > 0 });
}

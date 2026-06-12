// POST /api/orders/[id]/redistribute
// Ponawia dystrybucję voucherów dla pracowników, którzy ich jeszcze nie otrzymali.
// Dostępne dla pracodawcy (własna firma) i superadmina.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

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

  const email = String(entry?.email ?? entry?.employee_email ?? '').trim().toLowerCase();
  if (email && emailToAuthId.has(email)) {
    return emailToAuthId.get(email) ?? null;
  }

  return null;
}

export async function POST(
  _req: NextRequest,
  { params: __paramsP }: { params: Promise<{ id: string }> },
) {
  const params = await __paramsP;
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['superadmin', 'pracodawca'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = supabaseServer() as any;
  const orderId = params.id;

  const { data: order, error: fetchErr } = await supabase
    .from('voucher_orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (fetchErr || !order) return NextResponse.json({ error: 'Zamówienie nie istnieje' }, { status: 404 });
  if (order.status !== 'paid') {
    return NextResponse.json({ error: 'Dystrybucja możliwa tylko dla opłaconych zamówień' }, { status: 409 });
  }

  // Pracodawca może redistrybuować tylko dla swojej firmy
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

  const storedValidUntil: string | null = (order as any).voucher_valid_until ?? null;
  const planSource: any[] =
    (order.payroll_snapshots as any[] | null) ??
    (order.distribution_plan as any[] | null) ??
    [];

  if (planSource.length === 0) {
    return NextResponse.json({ error: 'Brak planu dystrybucji dla tego zamówienia' }, { status: 400 });
  }

  const emailToAuthId = await buildEmailToAuthId(supabase);

  let distributedCount = 0;
  const skipped: string[] = [];
  const batchItems: { userId: string; userName: string; amount: number }[] = [];

  for (const entry of planSource) {
    const userId = await resolveEmployeeId(supabase, order.company_id, entry, emailToAuthId);
    const targetAmount = parsePlannedAmount(entry);
    const employeeName: string = entry?.employee_name ?? entry?.employeeName ?? entry?.pesel ?? userId ?? 'nieznany';

    if (!userId) {
      skipped.push(`${employeeName}: nie znaleziono użytkownika (PESEL/email niezgodny)`);
      continue;
    }
    if (targetAmount <= 0) continue;

    // Sprawdź ile pracownik już ma z tego zamówienia
    const { count: alreadyOwned } = await supabase
      .from('vouchers')
      .select('id', { head: true, count: 'exact' })
      .eq('order_id', orderId)
      .eq('current_owner_id', userId);

    const missing = Math.max(0, targetAmount - (alreadyOwned ?? 0));
    if (missing <= 0) continue; // już ma wszystkie vouchery

    const { data: distCount, error: transferErr } = await supabase.rpc('distribute_to_employee', {
      p_company_id:   order.company_id,
      p_from_user_id: order.hr_user_id,
      p_to_user_id:   userId,
      p_amount:       missing,
      p_order_id:     orderId,
      p_valid_until:  storedValidUntil,
    });

    if (transferErr) {
      console.error(`[redistribute] distribute_to_employee failed for userId=${userId}:`, transferErr.message);
      skipped.push(`${employeeName}: ${transferErr.message}`);
      continue;
    }

    const actual = Number(distCount) > 0 ? Number(distCount) : missing;
    distributedCount += actual;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', userId)
      .single();

    batchItems.push({ userId, userName: profile?.full_name ?? employeeName, amount: actual });

    await supabase.from('notifications').insert({
      user_id: userId,
      message: `Otrzymałeś ${actual} voucherów (ponowna dystrybucja zamówienia).`,
      type:    'SUCCESS',
    });
  }

  if (batchItems.length > 0) {
    const batchId = `PROTOCOL-REDIST-${new Date().toISOString().slice(0, 10)}-${orderId.slice(-8).toUpperCase()}`;
    const { error: batchErr } = await supabase
      .from('distribution_batches')
      .insert({
        id:           batchId,
        company_id:   order.company_id,
        hr_user_id:   order.hr_user_id,
        hr_name:      'System (Ponowna dystrybucja)',
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
    success: true,
    distributed: distributedCount,
    redistributed: batchItems.map(i => ({ name: i.userName, amount: i.amount })),
    skipped,
  });
}

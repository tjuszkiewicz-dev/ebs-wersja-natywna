// PATCH /api/companies/[id]/financials/[doc_id]
// Oznacza dokument finansowy jako opłacony.
// doc_id może być:
//   - UUID z tabeli financial_documents (upsert)
//   - "nota-{orderId}" lub "fvat-{orderId}" (syntetyczny, upsert do financial_documents)
// Wymaga roli superadmin.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

const UpdateSchema = z.object({
  status:               z.enum(['pending', 'paid']),
  external_payment_ref: z.string().optional().nullable(),
});

type Params = { params: Promise<{ id: string; doc_id: string }> };

export async function PATCH(req: NextRequest, { params: __paramsP }: Params) {
  const params = await __paramsP;
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = supabaseServer();
  const now = new Date().toISOString();

  // Rozszyfruj syntetyczny doc_id
  const syntheticNotaMatch  = params.doc_id.match(/^nota-(.+)$/);
  const syntheticFvatMatch  = params.doc_id.match(/^fvat-(.+)$/);

  if (syntheticNotaMatch || syntheticFvatMatch) {
    // Upsert do tabeli financial_documents
    const orderId = (syntheticNotaMatch ?? syntheticFvatMatch)![1];
    const type    = syntheticNotaMatch ? 'nota' : 'faktura_vat';

    if (type === 'nota' && parsed.data.status === 'paid') {
      try {
        await syncOrderStatus(supabase, orderId, type, parsed.data.status, now);
      } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? 'Błąd emisji lub dystrybucji voucherów' }, { status: 500 });
      }
    }

    // Pobierz dane zamówienia żeby uzupełnić pola dokumentu
    const { data: order } = await supabase
      .from('voucher_orders')
      .select('amount_pln, fee_pln, doc_voucher_id, doc_fee_id, created_at')
      .eq('id', orderId)
      .eq('company_id', params.id)
      .single();

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const VAT_RATE = 0.23;
    // fee_pln jest gross — back-kalkuluj net
    const feeGross  = Number(order.fee_pln) || 0;
    const amountNet = type === 'nota'
      ? Number(order.amount_pln)
      : parseFloat((feeGross / (1 + VAT_RATE)).toFixed(2));
    const vatAmount = type === 'nota' ? 0 : parseFloat((feeGross - amountNet).toFixed(2));

    // upsert przez partial unique index nie działa w Supabase JS —
    // używamy SELECT + INSERT lub UPDATE
    const { data: existing } = await supabase
      .from('financial_documents')
      .select('id')
      .eq('linked_order_id', orderId)
      .eq('type', type)
      .maybeSingle();

    let docData: any;
    if (existing) {
      const { data: updated, error: updateErr } = await supabase
        .from('financial_documents')
        .update({
          status:               parsed.data.status,
          payment_confirmed_at: parsed.data.status === 'paid' ? now : null,
          external_payment_ref: parsed.data.external_payment_ref ?? null,
          updated_at:           now,
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
      docData = updated;
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from('financial_documents')
        .insert({
          company_id:           params.id,
          linked_order_id:      orderId,
          type,
          document_number:      type === 'nota' ? order.doc_voucher_id : order.doc_fee_id,
          amount_net:           amountNet,
          vat_amount:           vatAmount,
          amount_gross:         parseFloat((amountNet + vatAmount).toFixed(2)),
          status:               parsed.data.status,
          issued_at:            order.created_at,
          payment_confirmed_at: parsed.data.status === 'paid' ? now : null,
          external_payment_ref: parsed.data.external_payment_ref ?? null,
          updated_at:           now,
        })
        .select()
        .single();
      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
      docData = inserted;
    }

    if (type === 'nota' && parsed.data.status !== 'paid') {
      await syncOrderStatus(supabase, orderId, type, parsed.data.status, now);
    }

    return NextResponse.json(docData);
  }

  // Istniejący rekord w financial_documents — zwykły UPDATE
  const { data: existingDoc, error: existingErr } = await supabase
    .from('financial_documents')
    .select('id, linked_order_id, type')
    .eq('id', params.doc_id)
    .eq('company_id', params.id)
    .single();

  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 });
  if (!existingDoc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  if (existingDoc.type === 'nota' && parsed.data.status === 'paid' && existingDoc.linked_order_id) {
    try {
      await syncOrderStatus(supabase, existingDoc.linked_order_id, 'nota', 'paid', now);
    } catch (e: any) {
      return NextResponse.json({ error: e?.message ?? 'Błąd emisji lub dystrybucji voucherów' }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from('financial_documents')
    .update({
      status:               parsed.data.status,
      payment_confirmed_at: parsed.data.status === 'paid' ? now : null,
      external_payment_ref: parsed.data.external_payment_ref ?? null,
      updated_at:           now,
    })
    .eq('id', params.doc_id)
    .eq('company_id', params.id)
    .select('linked_order_id, type')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  if (data.linked_order_id && data.type === 'nota' && parsed.data.status !== 'paid') {
    await syncOrderStatus(supabase, data.linked_order_id, 'nota', parsed.data.status, now);
  }

  return NextResponse.json(data);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

import { calculateAndSaveCommissions } from '@/lib/vouchers';

function parsePlannedAmount(entry: any): number {
  const raw = entry?.final_netto_voucher ?? entry?.voucherPartNet ?? entry?.amount ?? 0;
  const amount = Number(raw);
  return Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
}

async function resolveEmployeeId(
  supabase: ReturnType<typeof import('@/lib/supabase').supabaseServer>,
  companyId: string,
  entry: any,
  emailToAuthId: Map<string, string>,
): Promise<string | null> {
  // 1. Direct UUID stored at order-creation time — validate it still exists
  const direct = entry?.matched_user_id ?? entry?.matchedUserId;
  if (direct) {
    const { data: profileCheck } = await (supabase as any)
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
    const { data: profileByPesel } = await (supabase as any)
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

async function syncOrderStatus(
  supabase: ReturnType<typeof import('@/lib/supabase').supabaseServer>,
  orderId: string,
  docType: 'nota' | 'faktura_vat',
  newDocStatus: 'paid' | 'pending',
  now: string,
) {
  // Tylko nota decyduje o statusie zamówienia — faktura_vat to prowizja, osobna sprawa
  if (docType !== 'nota') return;

  if (newDocStatus !== 'paid') {
    // Cofnięcie — przywróć zamówienie do 'approved' jeśli było 'paid'
    await supabase
      .from('voucher_orders')
      .update({ status: 'approved', updated_at: now })
      .eq('id', orderId)
      .eq('status', 'paid');
    return;
  }

  // Nota opłacona → oznacz zamówienie jako opłacone
  const { data: order } = await supabase
    .from('voucher_orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (!order) return;

  const orderWasPaid = order.status === 'paid';

  // Oznacz zamówienie jako opłacone (jeśli jeszcze nie jest)
  if (!orderWasPaid) {
    await supabase
      .from('voucher_orders')
      .update({ status: 'paid', updated_at: now })
      .eq('id', orderId);
  }

  const { count: mintedCount } = await (supabase as any)
    .from('vouchers')
    .select('id', { head: true, count: 'exact' })
    .eq('order_id', orderId);

  if ((mintedCount ?? 0) === 0) {
    const { error: mintErr } = await (supabase as any).rpc('mint_vouchers', {
      p_order_id:     orderId,
      p_company_id:   order.company_id,
      p_owner_id:     order.hr_user_id,
      p_quantity:     order.amount_vouchers,
      p_valid_months: 12,
    });

    if (mintErr) throw new Error(`Błąd emisji voucherów: ${mintErr.message}`);
  }

  const planSource: any[] =
    (order.payroll_snapshots as any[] | null) ??
    (order.distribution_plan as any[] | null) ??
    [];

  // Paginated email→authId map (same fix as in pay/route.ts)
  const emailToAuthId = new Map<string, string>();
  {
    let page = 1;
    while (true) {
      const { data: pageData } = await (supabase as any).auth.admin.listUsers({ perPage: 1000, page });
      const users = pageData?.users ?? [];
      for (const u of users) {
        if (u.email) emailToAuthId.set(u.email.toLowerCase(), u.id);
      }
      if (users.length < 1000) break;
      page++;
    }
  }

  const unresolvedRows: string[] = [];
  for (const entry of planSource) {
    const targetAmount = parsePlannedAmount(entry);
    if (targetAmount <= 0) continue;

    const userId = await resolveEmployeeId(supabase, order.company_id, entry, emailToAuthId);
    if (!userId) {
      const pesel = String(entry?.employee_pesel ?? entry?.pesel ?? '').trim();
      const email = String(entry?.email ?? entry?.employee_email ?? '').trim();
      unresolvedRows.push(`PESEL: ${pesel || 'brak'}, email: ${email || 'brak'}, kwota: ${targetAmount}`);
    }
  }

  if (unresolvedRows.length > 0) {
    throw new Error(`Nie można przypisać pracowników dla ${unresolvedRows.length} pozycji planu dystrybucji.`);
  }

  let vouchersDistributed = 0;
  const batchItems: { userId: string; userName: string; amount: number }[] = [];

  for (const entry of planSource) {
    const userId = await resolveEmployeeId(supabase, order.company_id, entry, emailToAuthId);
    const targetAmount = parsePlannedAmount(entry);
    if (!userId || targetAmount <= 0) continue;

    const { count: alreadyOwned } = await (supabase as any)
      .from('vouchers')
      .select('id', { head: true, count: 'exact' })
      .eq('order_id', orderId)
      .eq('current_owner_id', userId);

    const amount = Math.max(0, targetAmount - (alreadyOwned ?? 0));
    if (amount <= 0) continue;

    const { data: distributedCount, error: transferErr } = await ((supabase as any).rpc as any)('distribute_to_employee', {
      p_company_id:   order.company_id,
      p_from_user_id: order.hr_user_id,
      p_to_user_id:   userId,
      p_amount:       amount,
      p_order_id:     orderId,
      p_valid_until:  (order as any).voucher_valid_until ?? null,
    });

    if (transferErr) {
      console.error(`[syncOrderStatus] distribute_to_employee failed for userId=${userId} orderId=${orderId}:`, transferErr.message);
      continue;
    }

    vouchersDistributed += Number(distributedCount) > 0 ? Number(distributedCount) : amount;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', userId)
      .single();

    batchItems.push({ userId, userName: profile?.full_name ?? userId, amount });

    await supabase.from('notifications').insert({
      user_id: userId,
      message: `Otrzymałeś ${amount} nowych voucherów od pracodawcy.`,
      type:    'SUCCESS',
    });
  }

  if (batchItems.length > 0) {
    const batchId = `PROTOCOL-ADMIN-${now.slice(0, 10)}-${orderId.slice(-8).toUpperCase()}`;
    const { error: batchErr } = await supabase
      .from('distribution_batches')
      .insert({
        id:           batchId,
        company_id:   order.company_id,
        hr_user_id:   order.hr_user_id,
        hr_name:      'System (Admin — po opłaceniu)',
        total_amount: vouchersDistributed,
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

  await calculateAndSaveCommissions(
    orderId,
    Number(order.fee_pln ?? 0),
    order.company_id,
    order.is_first_invoice ?? false,
  );
}

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

type Params = { params: { id: string; doc_id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
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

    // Auto-aktualizuj status zamówienia + emituj vouchery jeśli opłacone
    await syncOrderStatus(supabase, orderId, type, parsed.data.status, now);

    return NextResponse.json(docData);
  }

  // Istniejący rekord w financial_documents — zwykły UPDATE
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

  // Auto-aktualizuj status zamówienia
  if (data.linked_order_id) {
    await syncOrderStatus(supabase, data.linked_order_id, data.type as 'nota' | 'faktura_vat', parsed.data.status, now);
  }

  return NextResponse.json(data);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

import { calculateAndSaveCommissions } from '@/lib/vouchers';

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

  // Oznacz zamówienie jako opłacone (jeśli jeszcze nie jest)
  if (order.status !== 'paid') {
    await supabase
      .from('voucher_orders')
      .update({ status: 'paid', updated_at: now })
      .eq('id', orderId);
  }

  // Emituj vouchery tylko raz (guard na status)
  if (order.status === 'paid') return;  // już było

  const { error: mintErr } = await supabase.rpc('mint_vouchers', {
    p_order_id:     orderId,
    p_company_id:   order.company_id,
    p_owner_id:     order.hr_user_id,
    p_quantity:     order.amount_vouchers,
    p_valid_months: 12,
  });

  if (mintErr) return;

  const planSource: any[] =
    (order.payroll_snapshots as any[] | null) ??
    (order.distribution_plan as any[] | null) ??
    [];

  let vouchersDistributed = 0;
  const batchItems: { userId: string; userName: string; amount: number }[] = [];

  for (const entry of planSource) {
    const userId = entry.matched_user_id ?? entry.matchedUserId;
    const amount = Math.floor(entry.final_netto_voucher ?? entry.voucherPartNet ?? entry.amount ?? 0);
    if (!userId || amount <= 0) continue;

    await (supabase.rpc as any)('distribute_to_employee', {
      p_company_id:   order.company_id,
      p_from_user_id: order.hr_user_id,
      p_to_user_id:   userId,
      p_amount:       amount,
      p_order_id:     orderId,
    });

    vouchersDistributed += amount;

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

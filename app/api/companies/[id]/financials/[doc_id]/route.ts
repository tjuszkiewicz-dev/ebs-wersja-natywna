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

    const { data, error } = await supabase
      .from('financial_documents')
      .upsert({
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
      }, { onConflict: 'linked_order_id,type' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Auto-aktualizuj status zamówienia
    await syncOrderStatus(supabase, orderId, parsed.data.status, now);

    return NextResponse.json(data);
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
    .select('linked_order_id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  // Auto-aktualizuj status zamówienia
  if (data.linked_order_id) {
    await syncOrderStatus(supabase, data.linked_order_id, parsed.data.status, now);
  }

  return NextResponse.json(data);
}

// ── Helper ────────────────────────────────────────────────────────────────────
// Gdy dokument jest opłacony → zamówienie → 'paid'
// Gdy dokument cofa się do pending → sprawdź czy wszystkie inne też pending → 'approved'
async function syncOrderStatus(
  supabase: ReturnType<typeof import('@/lib/supabase').supabaseServer>,
  orderId: string,
  newDocStatus: 'paid' | 'pending',
  now: string,
) {
  if (newDocStatus === 'paid') {
    await supabase
      .from('voucher_orders')
      .update({ status: 'paid', updated_at: now })
      .eq('id', orderId)
      .in('status', ['approved', 'pending']);
    return;
  }

  // Cofnięcie — sprawdź czy żaden inny dokument nie jest już opłacony
  const { data: paidDocs } = await supabase
    .from('financial_documents')
    .select('id')
    .eq('linked_order_id', orderId)
    .eq('status', 'paid');

  if (!paidDocs || paidDocs.length === 0) {
    await supabase
      .from('voucher_orders')
      .update({ status: 'approved', updated_at: now })
      .eq('id', orderId)
      .eq('status', 'paid');
  }
}

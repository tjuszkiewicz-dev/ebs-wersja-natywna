// GET /api/companies/[id]/financials
// Zwraca dokumenty finansowe firmy: noty buchaltaryjne + faktury VAT.
// Syntetyzuje z voucher_orders + dociąga ewentualne nadpisania z financial_documents.
// Wymaga roli superadmin.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

export interface SynthesizedDoc {
  id:                   string;        // "nota-{orderId}" | "fvat-{orderId}" | real UUID
  orderId:              string;
  type:                 'nota' | 'faktura_vat';
  document_number:      string | null;
  amount_net:           number;
  vat_amount:           number;
  amount_gross:         number;
  order_status:         string;        // status zamówienia (pending/approved/paid/rejected)
  status:               'pending' | 'paid';
  issued_at:            string;
  payment_confirmed_at: string | null;
  external_payment_ref: string | null;
  pdf_url:              string | null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = supabaseServer();

  const [ordersResult, overridesResult] = await Promise.all([
    supabase
      .from('voucher_orders')
      .select('id, amount_pln, fee_pln, total_pln, status, doc_voucher_id, doc_fee_id, created_at')
      .eq('company_id', params.id)
      .not('status', 'eq', 'cancelled')
      .order('created_at', { ascending: false }),

    supabase
      .from('financial_documents')
      .select('*')
      .eq('company_id', params.id),
  ]);

  if (ordersResult.error) {
    return NextResponse.json({ error: ordersResult.error.message }, { status: 500 });
  }

  // Map financial_documents overrides by linked_order_id + type
  const overrideMap = new Map<string, any>();
  for (const doc of overridesResult.data ?? []) {
    if (doc.linked_order_id) {
      overrideMap.set(`${doc.linked_order_id}:${doc.type}`, doc);
    }
  }

  const docs: SynthesizedDoc[] = [];
  const VAT_RATE = 0.23;

  for (const order of ordersResult.data ?? []) {
    const amountPln = Number(order.amount_pln) || 0;
    const isPaid    = order.status === 'paid';

    // --- Nota buchalteryjna (zakup voucherów, bez VAT) ---
    const notaOverride = overrideMap.get(`${order.id}:nota`);
    docs.push({
      id:                   notaOverride?.id ?? `nota-${order.id}`,
      orderId:              order.id,
      type:                 'nota',
      document_number:      order.doc_voucher_id,
      amount_net:           amountPln,
      vat_amount:           0,
      amount_gross:         amountPln,
      order_status:         order.status,
      status:               notaOverride?.status ?? (isPaid ? 'paid' : 'pending'),
      issued_at:            order.created_at,
      payment_confirmed_at: notaOverride?.payment_confirmed_at ?? null,
      external_payment_ref: notaOverride?.external_payment_ref ?? null,
      pdf_url:              notaOverride?.pdf_url ?? null,
    });

    // fee_pln jest przechowywane jako gross (z VAT) — back-kalkuluj net
    const feeGross = parseFloat((Number(order.fee_pln) || 0).toFixed(2));
    const feeNet   = parseFloat((feeGross / (1 + VAT_RATE)).toFixed(2));
    const feeVat   = parseFloat((feeGross - feeNet).toFixed(2));
    const fvatOverride = overrideMap.get(`${order.id}:faktura_vat`);
    docs.push({
      id:                   fvatOverride?.id ?? `fvat-${order.id}`,
      orderId:              order.id,
      type:                 'faktura_vat',
      document_number:      order.doc_fee_id,
      amount_net:           feeNet,
      vat_amount:           feeVat,
      amount_gross:         feeGross,
      order_status:         order.status,
      status:               fvatOverride?.status ?? (isPaid ? 'paid' : 'pending'),
      issued_at:            order.created_at,
      payment_confirmed_at: fvatOverride?.payment_confirmed_at ?? null,
      external_payment_ref: fvatOverride?.external_payment_ref ?? null,
      pdf_url:              fvatOverride?.pdf_url ?? null,
    });
  }

  return NextResponse.json(docs);
}

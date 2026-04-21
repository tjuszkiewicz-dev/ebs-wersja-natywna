// GET /api/invoices?companyId=<uuid> — lista dokumentów księgowych (nota + faktura_vat)
// Syntetyzuje z voucher_orders i nakłada dane z financial_documents.
// Dzięki temu dokumenty są zawsze widoczne, nawet gdy financial_documents jest puste
// (np. gdy tworzenie rekordów nie powiodło się przy hr-confirm).

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { z } from 'zod';

const QuerySchema = z.object({
  companyId: z.string().uuid('Wymagany prawidłowy UUID companyId'),
});

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['superadmin', 'pracodawca'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const parsed = QuerySchema.safeParse({ companyId: searchParams.get('companyId') });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { companyId } = parsed.data;

  // Pracodawca może widzieć tylko dokumenty swojej firmy
  if (auth.role === 'pracodawca') {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', auth.id)
      .single();
    if (profile?.company_id !== companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Pobierz wszystkie zatwierdzone/opłacone zamówienia i rekordy financial_documents
  const [ordersResult, overridesResult] = await Promise.all([
    supabase
      .from('voucher_orders')
      .select('id, amount_pln, fee_pln, status, doc_voucher_id, doc_fee_id, created_at')
      .eq('company_id', companyId)
      .not('status', 'eq', 'cancelled')
      .not('status', 'eq', 'pending')   // tylko zamówienia po hr-confirm (approved / paid)
      .order('created_at', { ascending: false }),

    supabase
      .from('financial_documents')
      .select('*')
      .eq('company_id', companyId),
  ]);

  if (ordersResult.error) {
    return NextResponse.json({ error: ordersResult.error.message }, { status: 500 });
  }

  // Mapa overrides: "{orderId}:{type}" → rekord z financial_documents
  const overrideMap = new Map<string, any>();
  for (const doc of overridesResult.data ?? []) {
    if (doc.linked_order_id) {
      overrideMap.set(`${doc.linked_order_id}:${doc.type}`, doc);
    }
  }

  const VAT_RATE = 0.23;
  const docs: Array<{
    id: string;
    type: 'nota' | 'faktura_vat';
    document_number: string | null;
    amount_net: number;
    vat_amount: number;
    amount_gross: number;
    status: 'pending' | 'paid';
    issued_at: string;
    pdf_url: string | null;
    linked_order_id: string;
    payment_confirmed_at: string | null;
  }> = [];

  for (const order of ordersResult.data ?? []) {
    const amountPln = Number(order.amount_pln) || 0;
    const feeGross  = parseFloat((Number(order.fee_pln) || 0).toFixed(2));
    const feeNet    = parseFloat((feeGross / (1 + VAT_RATE)).toFixed(2));
    const feeVat    = parseFloat((feeGross - feeNet).toFixed(2));
    const isPaid    = order.status === 'paid';

    const notaOvr = overrideMap.get(`${order.id}:nota`);
    docs.push({
      id:                   notaOvr?.id ?? `nota-${order.id}`,
      type:                 'nota',
      document_number:      notaOvr?.document_number ?? order.doc_voucher_id ?? null,
      amount_net:           notaOvr?.amount_net    ?? amountPln,
      vat_amount:           notaOvr?.vat_amount    ?? 0,
      amount_gross:         notaOvr?.amount_gross  ?? amountPln,
      status:               notaOvr?.status ?? (isPaid ? 'paid' : 'pending'),
      issued_at:            notaOvr?.issued_at ?? order.created_at,
      pdf_url:              notaOvr?.pdf_url ?? null,
      linked_order_id:      order.id,
      payment_confirmed_at: notaOvr?.payment_confirmed_at ?? null,
    });

    const fvatOvr = overrideMap.get(`${order.id}:faktura_vat`);
    docs.push({
      id:                   fvatOvr?.id ?? `fvat-${order.id}`,
      type:                 'faktura_vat',
      document_number:      fvatOvr?.document_number ?? order.doc_fee_id ?? null,
      amount_net:           fvatOvr?.amount_net    ?? feeNet,
      vat_amount:           fvatOvr?.vat_amount    ?? feeVat,
      amount_gross:         fvatOvr?.amount_gross  ?? feeGross,
      status:               fvatOvr?.status ?? (isPaid ? 'paid' : 'pending'),
      issued_at:            fvatOvr?.issued_at ?? order.created_at,
      pdf_url:              fvatOvr?.pdf_url ?? null,
      linked_order_id:      order.id,
      payment_confirmed_at: fvatOvr?.payment_confirmed_at ?? null,
    });
  }

  return NextResponse.json(docs);
}

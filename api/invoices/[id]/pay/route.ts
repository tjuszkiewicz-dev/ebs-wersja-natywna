// PATCH /api/invoices/[id]/pay — superadmin oznacza dokument jako opłacony
// Aktualizuje status w financial_documents i synchronizuje z voucher_orders jeśli oba dokumenty opłacone.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden — tylko superadmin' }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { id: docId } = await params;
  const now = new Date().toISOString();

  // Pobierz dokument
  const { data: doc, error: fetchErr } = await supabase
    .from('financial_documents')
    .select('id, status, linked_order_id, company_id, type')
    .eq('id', docId)
    .single();

  if (fetchErr || !doc) return NextResponse.json({ error: 'Dokument nie istnieje' }, { status: 404 });
  if (doc.status === 'paid') return NextResponse.json({ error: 'Dokument już oznaczony jako opłacony' }, { status: 409 });

  // Oznacz jako opłacony
  const { error: updateErr } = await supabase
    .from('financial_documents')
    .update({ status: 'paid', payment_confirmed_at: now, updated_at: now })
    .eq('id', docId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Sprawdź czy OBA dokumenty dla tego zamówienia są opłacone
  // Jeśli tak — zaktualizuj voucher_orders.status → 'paid'
  if (doc.linked_order_id) {
    const { data: allDocs } = await supabase
      .from('financial_documents')
      .select('status')
      .eq('linked_order_id', doc.linked_order_id);

    const allPaid = allDocs && allDocs.length > 0 && allDocs.every(d => d.status === 'paid');

    if (allPaid) {
      await supabase
        .from('voucher_orders')
        .update({ status: 'paid', updated_at: now })
        .eq('id', doc.linked_order_id);
    }
  }

  return NextResponse.json({ paid: true, docId, linkedOrderId: doc.linked_order_id });
}

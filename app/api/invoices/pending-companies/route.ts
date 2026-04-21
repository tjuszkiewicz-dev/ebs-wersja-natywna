// GET /api/invoices/pending-companies
// Zwraca mapę { [companyId]: { nota: boolean, fvat: boolean } }
// nota  = true gdy firma ma nieopłaconą notę księgową
// fvat  = true gdy firma ma nieopłaconą fakturę VAT
// Tylko superadmin.

import { NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

export interface PendingStatus {
  nota: boolean;
  fvat: boolean;
}

export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = supabaseServer();

  // Pobierz zamówienia zatwierdzone przez HR (status approved lub paid)
  const { data: orders, error } = await supabase
    .from('voucher_orders')
    .select('id, company_id')
    .in('status', ['approved', 'paid']);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!orders || orders.length === 0) return NextResponse.json({});

  const orderIds = orders.map((o: any) => o.id as string);

  // Pobierz dokumenty finansowe dla tych zamówień
  const { data: finDocs } = await supabase
    .from('financial_documents')
    .select('linked_order_id, type, status')
    .in('linked_order_id', orderIds);

  // Mapa: orderId -> { nota?: 'pending'|'paid', fvat?: 'pending'|'paid' }
  type DocMap = { nota?: string; fvat?: string };
  const docByOrder = new Map<string, DocMap>();
  for (const doc of finDocs ?? []) {
    if (!doc.linked_order_id) continue;
    if (!docByOrder.has(doc.linked_order_id)) docByOrder.set(doc.linked_order_id, {});
    const entry = docByOrder.get(doc.linked_order_id)!;
    if (doc.type === 'nota') entry.nota = doc.status;
    if (doc.type === 'faktura_vat') entry.fvat = doc.status;
  }

  // Mapa: companyId -> { nota: boolean, fvat: boolean }
  // true = ma co najmniej jeden nieopłacony dokument tego typu
  const companyMap = new Map<string, { nota: boolean; fvat: boolean }>();

  for (const order of orders) {
    const docs = docByOrder.get(order.id) ?? {};
    const notaPending = docs.nota !== 'paid'; // brak dokumentu = pending
    const fvatPending = docs.fvat !== 'paid';

    if (!notaPending && !fvatPending) continue; // w pełni opłacone

    const existing = companyMap.get(order.company_id) ?? { nota: false, fvat: false };
    companyMap.set(order.company_id, {
      nota: existing.nota || notaPending,
      fvat: existing.fvat || fvatPending,
    });
  }

  return NextResponse.json(Object.fromEntries(companyMap));
}

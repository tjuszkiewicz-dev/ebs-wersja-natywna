// GET  /api/orders/[id] — pobierz podsumowanie zamówienia (liczba voucherów) przed usunięciem
// DELETE /api/orders/[id] — usuń zamówienie + wygenerowane przez nie vouchery (wszystkie statusy, pracodawca/superadmin)

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

async function resolveCompanyId(supabase: ReturnType<typeof supabaseServer>, role: string, userId: string): Promise<string | null> {
  if (role !== 'pracodawca') return null; // superadmin nie ma ograniczenia
  const { data } = await supabase.from('user_profiles').select('company_id').eq('id', userId).single();
  return data?.company_id ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['pracodawca', 'superadmin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { id: orderId } = await params;

  const { data: order, error: fetchErr } = await supabase
    .from('voucher_orders')
    .select('id, status, company_id, amount_vouchers, amount_pln, total_pln, created_at')
    .eq('id', orderId)
    .single();

  if (fetchErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  if (auth.role === 'pracodawca') {
    const hrCompanyId = await resolveCompanyId(supabase, auth.role, auth.id);
    if (hrCompanyId !== order.company_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Policz vouchery powiązane z tym zamówieniem
  const { count: voucherCount } = await supabase
    .from('vouchers')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', orderId);

  // Policz vouchery już skonsumowane/anulowane
  const { count: consumedCount } = await supabase
    .from('vouchers')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', orderId)
    .in('status', ['consumed', 'expired', 'buyback_complete']);

  // Policz dokumenty finansowe (nota + faktura_vat)
  const { count: documentsCount } = await supabase
    .from('financial_documents')
    .select('*', { count: 'exact', head: true })
    .eq('linked_order_id', orderId);

  return NextResponse.json({
    id: order.id,
    status: order.status,
    amount_vouchers: order.amount_vouchers,
    amount_pln: order.amount_pln,
    total_pln: order.total_pln,
    created_at: order.created_at,
    voucherCount: voucherCount ?? 0,
    consumedCount: consumedCount ?? 0,
    documentsCount: documentsCount ?? 0,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['pracodawca', 'superadmin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { id: orderId } = await params;

  const { data: order, error: fetchErr } = await supabase
    .from('voucher_orders')
    .select('id, status, company_id')
    .eq('id', orderId)
    .single();

  if (fetchErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  // Pracodawca może usuwać tylko zamówienia swojej firmy
  if (auth.role === 'pracodawca') {
    const hrCompanyId = await resolveCompanyId(supabase, auth.role, auth.id);
    if (hrCompanyId !== order.company_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 1. Pobierz dokumenty finansowe powiązane z zamówieniem (przed usunięciem, żeby mieć pdf_url)
  const { data: financialDocs } = await supabase
    .from('financial_documents')
    .select('id, pdf_url')
    .eq('linked_order_id', orderId);

  // 2. Usuń pliki PDF ze Storage (best-effort — nie przerywamy jeśli się nie uda)
  if (financialDocs && financialDocs.length > 0) {
    const storagePaths: string[] = [];
    for (const doc of financialDocs) {
      if (doc.pdf_url) {
        // Signed URL format: .../object/sign/financial-documents/<path>?token=...
        // lub .../object/public/financial-documents/<path>
        try {
          const url = new URL(doc.pdf_url);
          const match = url.pathname.match(/\/(?:sign|public)\/financial-documents\/(.+)/);
          if (match) storagePaths.push(decodeURIComponent(match[1].split('?')[0]));
        } catch {
          // ignoruj błędne URL-e
        }
      }
    }
    if (storagePaths.length > 0) {
      await supabase.storage.from('financial-documents').remove(storagePaths);
    }
  }

  // 3. Usuń wiersze financial_documents
  const { error: docsDelErr } = await supabase
    .from('financial_documents')
    .delete()
    .eq('linked_order_id', orderId);

  if (docsDelErr) return NextResponse.json({ error: `Błąd usuwania dokumentów: ${docsDelErr.message}` }, { status: 500 });

  // 4. Usuń powiązane vouchery (kaskadowo)
  const { error: voucherDelErr } = await supabase
    .from('vouchers')
    .delete()
    .eq('order_id', orderId);

  if (voucherDelErr) return NextResponse.json({ error: `Błąd usuwania voucherów: ${voucherDelErr.message}` }, { status: 500 });

  // 5. Usuń samo zamówienie
  const { error: delErr } = await supabase
    .from('voucher_orders')
    .delete()
    .eq('id', orderId);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ deleted: true, orderId });
}

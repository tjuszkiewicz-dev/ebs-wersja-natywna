import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { getFakturowniaClient } from '@/lib/fakturownia/factory';
import { issueDocumentsForOrder } from '@/lib/fakturownia/invoiceService';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const fa = getFakturowniaClient();
  if (!fa) return NextResponse.json({ error: 'Integration disabled' }, { status: 400 });

  const supabase = supabaseServer();
  const { id } = await params;

  const { data: doc } = await supabase
    .from('financial_documents').select('linked_order_id').eq('id', id).single();
  if (!doc?.linked_order_id) return NextResponse.json({ error: 'No linked order' }, { status: 404 });

  const { data: order } = await supabase
    .from('voucher_orders').select('id, company_id, amount_pln').eq('id', doc.linked_order_id).single();
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const { data: company } = await supabase
    .from('companies')
    .select('id, nip, name, fakturownia_client_id, address_street, address_city, address_zip, custom_payment_terms_days')
    .eq('id', (order as any).company_id).single();
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

  await issueDocumentsForOrder(
    supabase, fa, order as any, company as any,
    20,
    (company as any).custom_payment_terms_days ?? undefined,
  );
  return NextResponse.json({ ok: true });
}

// PATCH /api/orders/[id]/hr-confirm
// HR samodzielnie zatwierdza zamówienie z obowiązkiem zapłaty.
// Zastępuje krok superadmin-approve. Emituje vouchery i dystrybuuje do pracowników.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { createOrderDocuments, createUmowaDocument } from '@/lib/documentService';
import { calculateOrderTotals } from '@/utils/financialMath';

export async function PATCH(
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
    .select('*')
    .eq('id', orderId)
    .single();

  if (fetchErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.status !== 'pending') return NextResponse.json({ error: 'Order already processed' }, { status: 409 });

  // Pracodawca może potwierdzać tylko zamówienia swojej firmy
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

  // 1. Update status → approved
  const { error: updateErr } = await supabase
    .from('voucher_orders')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // 2. Emit vouchers — minted to the HR user (company account owner)
  const { error: mintErr } = await supabase.rpc('mint_vouchers', {
    p_order_id:     orderId,
    p_company_id:   order.company_id,
    p_owner_id:     order.hr_user_id,
    p_quantity:     order.amount_vouchers,
    p_valid_months: 12,
  });

  if (mintErr) return NextResponse.json({ error: mintErr.message }, { status: 500 });

  // 3. Auto-distribute based on payroll plan in order
  const planSource: any[] =
    (order.payroll_snapshots as any[] | null) ??
    (order.distribution_plan as any[] | null) ??
    [];

  let distributedCount = 0;
  const batchItems: { userId: string; userName: string; amount: number }[] = [];

  for (const entry of planSource) {
    const userId = entry.matched_user_id ?? entry.matchedUserId;
    const amount = Math.floor(entry.final_netto_voucher ?? entry.voucherPartNet ?? entry.amount ?? 0);
    if (!userId || amount <= 0) continue;

    const { data: distCount, error: transferErr } = await (supabase.rpc as any)('distribute_to_employee', {
      p_company_id:   order.company_id,
      p_from_user_id: order.hr_user_id,
      p_to_user_id:   userId,
      p_amount:       amount,
      p_order_id:     orderId,
    });

    if (transferErr) continue;
    const actualAmount = (Number(distCount) || amount);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', userId)
      .single();

    batchItems.push({ userId, userName: profile?.full_name ?? userId, amount: actualAmount });
    distributedCount += actualAmount;

    await supabase.from('notifications').insert({
      user_id: userId,
      message: `Otrzymałeś ${actualAmount} nowych voucherów od pracodawcy.`,
      type:    'SUCCESS',
    });
  }

  // 4. Save distribution batch protocol
  if (batchItems.length > 0) {
    const batchId = `PROTOCOL-HR-${new Date().toISOString().slice(0, 10)}-${orderId.slice(-8).toUpperCase()}`;

    const { error: batchErr } = await supabase
      .from('distribution_batches')
      .insert({
        id:           batchId,
        company_id:   order.company_id,
        hr_user_id:   order.hr_user_id,
        hr_name:      'HR (Potwierdzenie własne)',
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

  // 5. Generuj dokumenty księgowe (nota + faktura VAT za obsługę)
  let notaId: string | null = null;
  let fakturaId: string | null = null;
  let notaPdfUrl: string | null = null;
  let fakturaPdfUrl: string | null = null;

  try {
    // Pobierz dane firmy do dokumentu
    const { data: companyRaw5 } = await supabase
      .from('companies')
      .select('name, nip, address_street, address_city, address_zip')
      .eq('id', order.company_id)
      .single();
    const company = companyRaw5 as any;

    const companyFee = (company?.fee_percent ?? 20) / 100;
    const totals = calculateOrderTotals(order.amount_pln, companyFee);
    const now = new Date().toISOString();
    const yyyyMM = now.slice(0, 7).replace('-', '/');
    // Numery dokumentów — używamy istniejących z zamówienia jeśli dostępne
    const docNotaNumber   = order.doc_voucher_id ?? `NK/${yyyyMM}/${orderId.slice(-6).toUpperCase()}`;
    const docFakturaNumber = order.doc_fee_id    ?? `FV/${yyyyMM}/${orderId.slice(-6).toUpperCase()}`;

    const address = company
      ? [company.address_street, company.address_zip, company.address_city].filter(Boolean).join(', ')
      : '';

    const docs = await createOrderDocuments({
      orderId,
      companyId:          order.company_id,
      companyName:        company?.name ?? 'Firma',
      companyNip:         company?.nip ?? '—',
      companyAddress:     address,
      voucherAmount:      Number(order.amount_pln),
      feeNet:             totals.feeNet,
      feeVat:             totals.feeVat,
      feeGross:           totals.feeGross,
      issuedAt:           now,
      docNotaNumber,
      docFakturaNumber,
      distributionSummary: `Emisja ${order.amount_vouchers} voucherów dla ${batchItems.length} pracowników`,
    });

    notaId       = docs.notaId;
    fakturaId    = docs.fakturaId;
    notaPdfUrl   = docs.notaPdfUrl;
    fakturaPdfUrl = docs.fakturaPdfUrl;
  } catch {
    // Błąd generowania dokumentów nie blokuje zatwierdzenia zamówienia
  }

  // 6. Generuj Umowę Zlecenia Nabycia Voucherów i zapisz URL w zamówieniu
  let umowaPdfUrl: string | null = null;
  try {
    const { data: companyRaw } = await supabase
      .from('companies')
      .select('*')
      .eq('id', order.company_id)
      .single();
    const company = companyRaw as any;

    // Pobierz email konta HR (Kupującego) z auth.users
    let hrEmail: string | null = null;
    if (order.hr_user_id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(order.hr_user_id);
      hrEmail = authUser?.user?.email ?? null;
    }

    const companyFeePercent = (company?.fee_percent ?? 20) / 100;
    const totals = calculateOrderTotals(order.amount_pln, companyFeePercent);
    const now = new Date().toISOString();
    const companyAddress = company
      ? [company.address_street, company.address_zip, company.address_city].filter(Boolean).join(', ')
      : null;

    umowaPdfUrl = await createUmowaDocument({
      orderId:         orderId,
      companyId:       order.company_id,
      companyName:     company?.name ?? '',
      companyNip:      company?.nip ?? '',
      companyKrs:      company?.krs ?? null,
      companyRegon:    company?.regon ?? null,
      companyCity:     company?.address_city ?? null,
      companyAddress:  companyAddress,
      companyEmail:    hrEmail,
      representative:  null,
      docVoucherId:    order.doc_voucher_id ?? `NK/${new Date().getFullYear()}/${orderId.slice(-6).toUpperCase()}/B`,
      voucherCount:    order.amount_vouchers,
      voucherValueNet: Number(order.amount_pln),
      feePercent:      companyFeePercent,
      feeNet:          totals.feeNet,
      realizationDays: 3,
      contractDate:    now,
    });

    if (umowaPdfUrl) {
      await supabase
        .from('voucher_orders')
        .update({ umowa_pdf_url: umowaPdfUrl, updated_at: now })
        .eq('id', orderId);
    }
  } catch {
    // Błąd generowania umowy nie blokuje zatwierdzenia zamówienia
  }

  return NextResponse.json({
    approved:      true,
    distributed:   distributedCount,
    employeeCount: batchItems.length,
    documents: {
      notaId,
      fakturaId,
      notaPdfUrl,
      fakturaPdfUrl,
      umowaPdfUrl,
    },
  });
}


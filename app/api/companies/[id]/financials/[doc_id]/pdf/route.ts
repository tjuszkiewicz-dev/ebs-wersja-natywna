// POST /api/companies/[id]/financials/[doc_id]/pdf
// Generuje (lub regeneruje) PDF dla dokumentu finansowego i zapisuje URL w bazie.
// doc_id: UUID z tabeli financial_documents lub "nota-{orderId}" / "fvat-{orderId}"

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { ISSUER, generatePdfBuffer, uploadPdf } from '@/lib/documents/pdfUtils';
import { buildPolishInvoiceHtml, DocumentContext } from '@/lib/documentService';

type Params = { params: { id: string; doc_id: string } };

export async function POST(_req: NextRequest, { params }: Params) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['superadmin', 'pracodawca'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = supabaseServer();
  const now = new Date().toISOString();
  const VAT_RATE = 0.23;

  // ── Resolve document + order ───────────────────────────────────────────────

  let docId: string | null = null;
  let type: 'nota' | 'faktura_vat';
  let orderId: string;

  const syntheticNotaMatch = params.doc_id.match(/^nota-(.+)$/);
  const syntheticFvatMatch = params.doc_id.match(/^fvat-(.+)$/);

  if (syntheticNotaMatch || syntheticFvatMatch) {
    orderId = (syntheticNotaMatch ?? syntheticFvatMatch)![1];
    type    = syntheticNotaMatch ? 'nota' : 'faktura_vat';
    // try to find real row
    const { data: existing } = await supabase
      .from('financial_documents')
      .select('id')
      .eq('linked_order_id', orderId)
      .eq('type', type)
      .maybeSingle();
    docId = existing?.id ?? null;
  } else {
    // real UUID — load it
    const { data: doc } = await supabase
      .from('financial_documents')
      .select('id, type, linked_order_id, company_id')
      .eq('id', params.doc_id)
      .eq('company_id', params.id)
      .maybeSingle();
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    docId   = doc.id;
    type    = doc.type as 'nota' | 'faktura_vat';
    orderId = doc.linked_order_id!;
  }

  if (!orderId) return NextResponse.json({ error: 'Brak powiązanego zamówienia' }, { status: 400 });

  // ── Fetch order + company ──────────────────────────────────────────────────

  const [orderRes, companyRes] = await Promise.all([
    supabase
      .from('voucher_orders')
      .select('id, amount_pln, fee_pln, doc_voucher_id, doc_fee_id, created_at, amount_vouchers, distribution_plan, payroll_snapshots')
      .eq('id', orderId)
      .eq('company_id', params.id)
      .single(),
    supabase
      .from('companies')
      .select('id, name, nip, address_street, address_city, address_zip')
      .eq('id', params.id)
      .single(),
  ]);

  if (orderRes.error || !orderRes.data) {
    return NextResponse.json({ error: 'Zamówienie nie znalezione' }, { status: 404 });
  }
  if (companyRes.error || !companyRes.data) {
    return NextResponse.json({ error: 'Firma nie znaleziona' }, { status: 404 });
  }

  const order   = orderRes.data;
  const company = companyRes.data;

  const amountPln = Number(order.amount_pln) || 0;
  const feeGross  = Number(order.fee_pln)    || 0;
  const feeNet    = parseFloat((feeGross / (1 + VAT_RATE)).toFixed(2));
  const feeVat    = parseFloat((feeGross - feeNet).toFixed(2));

  const planSource: any[] =
    (order.payroll_snapshots as any[] | null) ??
    (order.distribution_plan as any[] | null) ??
    [];
  const empCount = planSource.filter((e: any) => {
    const uid = e.matched_user_id ?? e.matchedUserId;
    return !!uid;
  }).length;
  const distributionSummary = empCount > 0
    ? `Emisja ${order.amount_vouchers ?? amountPln} voucherów dla ${empCount} pracowników`
    : `Emisja ${order.amount_vouchers ?? amountPln} voucherów`;

  const companyAddress = [
    company.address_street,
    company.address_zip,
    company.address_city,
  ].filter(Boolean).join(', ');

  // ── Build HTML ─────────────────────────────────────────────────────────────

  const ym = new Date(order.created_at).toISOString().slice(0, 7).replace('-', '/');
  const docNotaNumber    = order.doc_voucher_id ?? `NK/${ym}/${orderId.slice(-5).toUpperCase()}`;
  const docFakturaNumber = order.doc_fee_id     ?? `FV/${ym}/${orderId.slice(-5).toUpperCase()}`;

  const ctx: DocumentContext = {
    orderId,
    companyId:          params.id,
    companyName:        company.name,
    companyNip:         company.nip ?? '',
    companyAddress,
    voucherAmount:      amountPln,
    feeNet,
    feeVat,
    feeGross,
    issuedAt:           order.created_at,
    docNotaNumber,
    docFakturaNumber,
    distributionSummary,
  };

  const html = buildPolishInvoiceHtml(ctx, type);



  // ── Generate PDF ───────────────────────────────────────────────────────────

  const pdfBuf = await generatePdfBuffer(html);
  if (!pdfBuf) {
    return NextResponse.json({ error: 'Serwer PDF niedostępny. Upewnij się, że serwer PDF działa na porcie 3015.' }, { status: 503 });
  }

  const safeOrderId = orderId.slice(-8).toUpperCase();
  const dateSlug    = new Date(order.created_at).toISOString().slice(0, 10);
  const fileName    = type === 'nota'
    ? `nota/${dateSlug}_${safeOrderId}.pdf`
    : `faktura/${dateSlug}_${safeOrderId}.pdf`;

  const pdfUrl = await uploadPdf(supabase, fileName, pdfBuf);
  if (!pdfUrl) {
    return NextResponse.json({ error: 'Błąd zapisu PDF w Storage' }, { status: 500 });
  }

  // ── Save URL to DB ─────────────────────────────────────────────────────────

  if (docId) {
    await supabase
      .from('financial_documents')
      .update({ pdf_url: pdfUrl, updated_at: now })
      .eq('id', docId);
  } else {
    // Insert row if it doesn't exist yet (synthetic ID case with no real row)
    const amountNet = type === 'nota' ? amountPln : feeNet;
    const vatAmount = type === 'nota' ? 0 : feeVat;
    await supabase
      .from('financial_documents')
      .insert({
        company_id:      params.id,
        linked_order_id: orderId,
        type,
        document_number: type === 'nota' ? (order.doc_voucher_id ?? null) : (order.doc_fee_id ?? null),
        amount_net:      amountNet,
        vat_amount:      vatAmount,
        amount_gross:    parseFloat((amountNet + vatAmount).toFixed(2)),
        status:          'pending',
        issued_at:       order.created_at,
        pdf_url:         pdfUrl,
        updated_at:      now,
      });
  }

  return NextResponse.json({ pdf_url: pdfUrl });
}

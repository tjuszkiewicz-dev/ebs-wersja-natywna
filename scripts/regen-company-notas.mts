/**
 * Regeneruje WSZYSTKIE noty księgowe danej firmy na NASZ lokalny wzór (Sprzedawca/Nabywca/konto),
 * z wartościami z zamówień. Odpina pola Fakturowni od rekordów not (nota ma być lokalna).
 * Dokumenty not w samej Fakturowni NIE są kasowane — do ręcznego usunięcia w panelu FA.
 *
 * Uruchom:  npx tsx --env-file=.env.local scripts/regen-company-notas.mts <NIP>
 * Domyślnie NIP Anezy.
 */
import { createClient } from '@supabase/supabase-js';
import { buildPolishInvoiceHtml, type DocumentContext } from '../lib/documentService';
import { calculateOrderTotals } from '../utils/financialMath';
import { generatePdfBuffer, uploadPdf } from '../lib/documents/pdfUtils';

const NIP = process.argv[2] ?? '7451615606'; // Aneza
process.env.PDF_SERVER_URL = 'https://artistic-learning-production-9f62.up.railway.app';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !serviceKey) { console.error('Brak env Supabase (.env.local)'); process.exit(1); }
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: company } = await supabase.from('companies')
  .select('id, name, nip, fee_percent, address_street, address_city, address_zip')
  .eq('nip', NIP).single();
if (!company) { console.error('Firma o NIP', NIP, 'nie znaleziona'); process.exit(1); }
console.log(`Firma: ${company.name} (NIP ${company.nip}), fee ${company.fee_percent}%`);

const { data: orders } = await supabase.from('voucher_orders')
  .select('id, amount_pln, amount_vouchers, doc_voucher_id, created_at, status')
  .eq('company_id', company.id)
  .order('created_at');
if (!orders?.length) { console.log('Brak zamówień.'); process.exit(0); }

let ok = 0, skip = 0, fail = 0;
for (const order of orders) {
  const { data: nota } = await supabase.from('financial_documents')
    .select('id, document_number, fakturownia_invoice_id')
    .eq('linked_order_id', order.id).eq('type', 'nota').maybeSingle();
  if (!nota) { console.log(`— zam ${order.id.slice(-8)}: brak rekordu noty, pomijam`); skip++; continue; }

  const totals = calculateOrderTotals(Number(order.amount_pln), Number(company.fee_percent ?? 20) / 100);
  const ctx: DocumentContext = {
    orderId: order.id,
    companyId: company.id,
    companyName: company.name,
    companyNip: company.nip ?? '',
    companyAddress: [company.address_street, company.address_zip, company.address_city].filter(Boolean).join(', '),
    voucherAmount: Number(order.amount_pln),
    feeNet: totals.feeNet, feeVat: totals.feeVat, feeGross: totals.feeGross,
    issuedAt: order.created_at,
    docNotaNumber: nota.document_number ?? order.doc_voucher_id ?? `NK/${order.id.slice(-6).toUpperCase()}`,
    docFakturaNumber: '—',
    distributionSummary: `Zamówienie ${order.amount_vouchers} voucherów`,
  };

  try {
    const buf = await generatePdfBuffer(buildPolishInvoiceHtml(ctx, 'nota'));
    if (!buf) { console.error(`✗ zam ${order.id.slice(-8)}: PDF-serwer niedostępny`); fail++; continue; }
    const fileName = `nota/${new Date(order.created_at).toISOString().slice(0, 10)}_${order.id.slice(-8).toUpperCase()}.pdf`;
    const pdfUrl = await uploadPdf(supabase as never, fileName, buf);
    if (!pdfUrl) { console.error(`✗ zam ${order.id.slice(-8)}: upload nieudany`); fail++; continue; }

    await supabase.from('financial_documents').update({
      pdf_url: pdfUrl,
      fakturownia_invoice_id: null, fakturownia_token: null, payment_url: null,
      fakturownia_sync_status: null, external_payment_ref: null,
      updated_at: new Date().toISOString(),
    }).eq('id', nota.id);

    const faNote = nota.fakturownia_invoice_id ? ` [była FA id ${nota.fakturownia_invoice_id} — usuń ręcznie w FA]` : '';
    console.log(`✓ ${nota.document_number} (${order.amount_pln} zł, ${buf.length}B) → lokalny PDF${faNote}`);
    ok++;
  } catch (e: any) {
    console.error(`✗ zam ${order.id.slice(-8)}:`, e?.message); fail++;
  }
}
console.log(`\nGotowe: ${ok} zregenerowane, ${skip} pominięte, ${fail} błędy.`);

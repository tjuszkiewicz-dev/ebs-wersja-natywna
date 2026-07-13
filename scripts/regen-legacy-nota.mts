/**
 * One-off: nota zamówienia fc1159ec (4010 zł, Aneza) wskazuje na wadliwy PDF z Fakturowni
 * (wzór accounting_note: dwóch „Wystawców", brak konta bankowego). Wracamy do lokalnej noty:
 *  1) generuje nasz PDF (Sprzedawca/Nabywca/konto) przez PDF-serwer na Railway,
 *  2) wgrywa do Storage i podmienia pdf_url,
 *  3) odpina pola Fakturowni od rekordu noty (fakturownia_*, payment_url, external_payment_ref).
 * Dokumentu N1 w samej Fakturowni NIE kasuje — decyzja użytkownika.
 *
 * Uruchom:  npx tsx --env-file=.env.local scripts/regen-legacy-nota.mts
 */
import { createClient } from '@supabase/supabase-js';
import { buildPolishInvoiceHtml, type DocumentContext } from '../lib/documentService';
import { calculateOrderTotals } from '../utils/financialMath';
import { generatePdfBuffer, uploadPdf } from '../lib/documents/pdfUtils';

const ORDER_ID = 'fc1159ec-f268-4742-90c4-82b325841b81';
// Wymuś produkcyjny PDF-serwer (lokalny :3015 może nie działać) — czytane w call-time.
process.env.PDF_SERVER_URL = 'https://artistic-learning-production-9f62.up.railway.app';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !serviceKey) { console.error('Brak env Supabase (.env.local)'); process.exit(1); }
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: order, error: oErr } = await supabase.from('voucher_orders')
  .select('id, company_id, amount_pln, amount_vouchers, doc_voucher_id, created_at')
  .eq('id', ORDER_ID).single();
if (oErr || !order) { console.error('Zamówienie nie znalezione:', oErr?.message); process.exit(1); }

const { data: company } = await supabase.from('companies')
  .select('name, nip, fee_percent, address_street, address_city, address_zip')
  .eq('id', order.company_id).single();
if (!company) { console.error('Brak firmy'); process.exit(1); }

const { data: notaDoc } = await supabase.from('financial_documents')
  .select('id, document_number, fakturownia_invoice_id, pdf_url')
  .eq('linked_order_id', ORDER_ID).eq('type', 'nota').single();
if (!notaDoc) { console.error('Brak rekordu noty'); process.exit(1); }
console.log('[legacy-nota] Nota:', notaDoc.document_number, '| FA id:', notaDoc.fakturownia_invoice_id);

const totals = calculateOrderTotals(Number(order.amount_pln), Number(company.fee_percent ?? 20) / 100);
const ctx: DocumentContext = {
  orderId: ORDER_ID,
  companyId: order.company_id,
  companyName: company.name,
  companyNip: company.nip ?? '',
  companyAddress: [company.address_street, company.address_zip, company.address_city].filter(Boolean).join(', '),
  voucherAmount: Number(order.amount_pln),
  feeNet: totals.feeNet, feeVat: totals.feeVat, feeGross: totals.feeGross,
  issuedAt: order.created_at,
  docNotaNumber: notaDoc.document_number ?? order.doc_voucher_id ?? `NK/${ORDER_ID.slice(-6).toUpperCase()}`,
  docFakturaNumber: '—',
  distributionSummary: `Zamówienie ${order.amount_vouchers} voucherów`,
};

const html = buildPolishInvoiceHtml(ctx, 'nota');
const buf = await generatePdfBuffer(html);
if (!buf) { console.error('PDF-serwer niedostępny'); process.exit(1); }
console.log('[legacy-nota] PDF:', buf.length, 'bajtów');

const fileName = `nota/${new Date(order.created_at).toISOString().slice(0, 10)}_${ORDER_ID.slice(-8).toUpperCase()}.pdf`;
const pdfUrl = await uploadPdf(supabase as never, fileName, buf);
if (!pdfUrl) { console.error('Błąd uploadu do Storage'); process.exit(1); }

const { error: updErr } = await supabase.from('financial_documents').update({
  pdf_url: pdfUrl,
  fakturownia_invoice_id: null,
  fakturownia_token: null,
  payment_url: null,
  fakturownia_sync_status: null,
  external_payment_ref: null,
  updated_at: new Date().toISOString(),
}).eq('id', notaDoc.id);
if (updErr) { console.error('Błąd update:', updErr.message); process.exit(1); }

console.log('[legacy-nota] OK —', notaDoc.document_number, 'ma lokalny PDF, pola FA wyczyszczone.');
console.log('[legacy-nota] pdf_url:', pdfUrl.slice(0, 90) + '…');
console.log('[legacy-nota] UWAGA: dokument „N1" (FA id 524693411) nadal istnieje w Fakturowni — usuń ręcznie w panelu FA.');

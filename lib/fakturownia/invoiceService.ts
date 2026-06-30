import type { SupabaseClient } from '@supabase/supabase-js';
import type { FakturowniaClient } from './client';
import type { FaInvoiceInput } from './types';
import { calculateOrderTotals } from '@/utils/financialMath';

export interface CompanyForInvoice {
  id: string;
  nip: string;
  name: string;
  fakturownia_client_id: number | null;
  address_street?: string | null;
  address_city?: string | null;
  address_zip?: string | null;
}

export async function ensureClient(
  supabase: SupabaseClient,
  fa: FakturowniaClient,
  company: CompanyForInvoice,
): Promise<number> {
  if (company.fakturownia_client_id) return company.fakturownia_client_id;

  const found = await fa.findClientByNip(company.nip);
  const client = found ?? (await fa.createClient({
    name: company.name,
    tax_no: company.nip,
    street: company.address_street ?? undefined,
    city: company.address_city ?? undefined,
    post_code: company.address_zip ?? undefined,
  }));

  await supabase.from('companies').update({ fakturownia_client_id: client.id }).eq('id', company.id);
  return client.id;
}

export function buildNotaInput(
  clientId: number, voucherAmountPln: number, issueDate: string, paymentDays?: number,
): FaInvoiceInput {
  return {
    kind: 'accounting_note',
    client_id: clientId,
    issue_date: issueDate,
    payment_to_kind: paymentDays,
    positions: [{
      name: 'Zakup voucherów MPV (Dyrektywa UE 2016/1065)',
      quantity: 1,
      total_price_gross: voucherAmountPln,
      tax: 'np',
    }],
  };
}

export function buildFakturaInput(
  clientId: number, feeGrossPln: number, issueDate: string, paymentDays?: number,
): FaInvoiceInput {
  return {
    kind: 'vat',
    client_id: clientId,
    issue_date: issueDate,
    payment_to_kind: paymentDays,
    positions: [{
      name: 'Opłata serwisowa za obsługę programu benefitowego',
      quantity: 1,
      // Konto FA jest w trybie cen brutto → pozycja wymaga total_price_gross.
      // Sam price_net daje 422 "positions.total_price_gross nie może być puste".
      total_price_gross: feeGrossPln,
      tax: 23,
    }],
  };
}

interface OrderForInvoice { id: string; company_id: string; amount_pln: number; }

export interface IssueResult {
  issued: number;   // utworzone w FA i zapisane w DB
  failed: number;   // błąd tworzenia w FA LUB krytyczny błąd zapisu po utworzeniu
  skipped: number;  // już miały fakturownia_invoice_id (idempotencja)
}

/** Ponawia zapis do financial_documents — faktura już istnieje w FA, więc utratą id
 *  ryzykujemy duplikatem przy następnej próbie. Zwraca false po wyczerpaniu prób. */
async function persistInvoiceLink(
  supabase: SupabaseClient,
  docId: string,
  payload: Record<string, unknown>,
  attempts = 3,
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const { error } = await supabase.from('financial_documents').update(payload).eq('id', docId);
    if (!error) return true;
    console.warn(`[fakturownia] zapis powiązania doc ${docId} nieudany (próba ${i + 1}/${attempts}):`, error.message ?? error);
  }
  return false;
}

export async function issueDocumentsForOrder(
  supabase: SupabaseClient,
  fa: FakturowniaClient,
  order: OrderForInvoice,
  company: CompanyForInvoice,
  feePercent: number,           // e.g. 20
  paymentDays: number | undefined,
  only?: 'nota' | 'faktura_vat', // gdy ustawione — wystaw w FA tylko ten typ dokumentu
): Promise<IssueResult> {
  const clientId = await ensureClient(supabase, fa, company);
  const issueDate = new Date().toISOString().slice(0, 10);
  const totals = calculateOrderTotals(order.amount_pln, feePercent / 100);

  const { data: docs } = await supabase
    .from('financial_documents')
    .select('id, type, fakturownia_invoice_id')
    .eq('linked_order_id', order.id)
    .order('type', { ascending: true });

  const result: IssueResult = { issued: 0, failed: 0, skipped: 0 };

  if (!docs || docs.length === 0) {
    console.warn(`[fakturownia] brak lokalnych financial_documents dla zamówienia ${order.id} — nic nie wystawiono (sprawdź czy createOrderDocuments się powiodło)`);
    return result;
  }

  for (const doc of docs) {
    if (only && doc.type !== only) continue;                       // odroczenie: nota teraz, faktura po opłacie
    if (doc.fakturownia_invoice_id) { result.skipped++; continue; } // idempotent
    const input = doc.type === 'nota'
      ? buildNotaInput(clientId, Number(order.amount_pln), issueDate, paymentDays)
      : buildFakturaInput(clientId, totals.feeGross, issueDate, paymentDays);

    // 1) Utwórz dokument w FA. Awaria tutaj = nic nie powstało → bezpiecznie ponowić później.
    let inv;
    try {
      inv = await fa.createInvoice(input);
    } catch (err) {
      console.error(`[fakturownia] createInvoice nie powiodło się dla doc ${doc.id} (zamówienie ${order.id}):`, err);
      await supabase.from('financial_documents')
        .update({ fakturownia_sync_status: 'failed' }).eq('id', doc.id);
      result.failed++;
      continue;
    }

    // 2) Dokument ISTNIEJE już w FA — id trzeba zapisać, inaczej kolejny retry utworzy DUPLIKAT.
    const persisted = await persistInvoiceLink(supabase, doc.id, {
      fakturownia_invoice_id: inv.id,
      fakturownia_token:      inv.token,
      external_payment_ref:   inv.number,
      payment_url:            fa.invoiceUrl(inv.token),
      pdf_url:                fa.invoicePdfUrl(inv.token),
      fakturownia_sync_status: 'synced',
    });

    if (persisted) {
      result.issued++;
    } else {
      // Faktura jest w FA, ale nie zapisaliśmy id. NIE oznaczamy 'failed' (retry zrobiłby duplikat) —
      // wymaga ręcznej reconcyliacji operatora.
      console.error(`[fakturownia] KRYTYCZNE: faktura ${inv.id} (${inv.number}) utworzona w FA dla doc ${doc.id}, ale nie zapisano fakturownia_invoice_id. Ręczna reconcyliacja wymagana, by uniknąć duplikatu.`);
      result.failed++;
    }
  }
  return result;
}

/**
 * Wystawia w Fakturowni fakturę VAT dla zamówienia — wywoływane PO oznaczeniu noty jako OPŁACONEJ
 * (z webhooka/cronu płatności). Pobiera zamówienie + firmę i deleguje do issueDocumentsForOrder
 * z filtrem only='faktura_vat'. Zwraca null, gdy zamówienie/firma nie istnieją.
 */
export async function issueFakturaForOrder(
  supabase: SupabaseClient,
  fa: FakturowniaClient,
  orderId: string,
): Promise<IssueResult | null> {
  const { data: order } = await supabase
    .from('voucher_orders')
    .select('id, company_id, amount_pln')
    .eq('id', orderId)
    .single();
  if (!order) return null;

  const { data: company } = await supabase
    .from('companies')
    .select('id, nip, name, fee_percent, fakturownia_client_id, address_street, address_city, address_zip, custom_payment_terms_days')
    .eq('id', (order as { company_id: string }).company_id)
    .single();
  if (!company) return null;

  return issueDocumentsForOrder(
    supabase,
    fa,
    order as OrderForInvoice,
    company as CompanyForInvoice,
    (company as { fee_percent?: number }).fee_percent ?? 20,
    (company as { custom_payment_terms_days?: number }).custom_payment_terms_days ?? undefined,
    'faktura_vat',
  );
}

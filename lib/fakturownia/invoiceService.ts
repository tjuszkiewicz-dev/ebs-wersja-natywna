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
  clientId: number, feeNetPln: number, issueDate: string, paymentDays?: number,
): FaInvoiceInput {
  return {
    kind: 'vat',
    client_id: clientId,
    issue_date: issueDate,
    payment_to_kind: paymentDays,
    positions: [{
      name: 'Opłata serwisowa za obsługę programu benefitowego',
      quantity: 1,
      price_net: feeNetPln,
      tax: 23,
    }],
  };
}

interface OrderForInvoice { id: string; company_id: string; amount_pln: number; }

export async function issueDocumentsForOrder(
  supabase: SupabaseClient,
  fa: FakturowniaClient,
  order: OrderForInvoice,
  company: CompanyForInvoice,
  feePercent: number,           // e.g. 20
  paymentDays: number | undefined,
): Promise<void> {
  const clientId = await ensureClient(supabase, fa, company);
  const issueDate = new Date().toISOString().slice(0, 10);
  const totals = calculateOrderTotals(order.amount_pln, feePercent / 100);

  const { data: docs } = await supabase
    .from('financial_documents')
    .select('id, type, fakturownia_invoice_id')
    .eq('linked_order_id', order.id)
    .order('type', { ascending: true });

  for (const doc of docs ?? []) {
    if (doc.fakturownia_invoice_id) continue; // idempotent
    const input = doc.type === 'nota'
      ? buildNotaInput(clientId, Number(order.amount_pln), issueDate, paymentDays)
      : buildFakturaInput(clientId, totals.feeNet, issueDate, paymentDays);
    try {
      const inv = await fa.createInvoice(input);
      await supabase.from('financial_documents').update({
        fakturownia_invoice_id: inv.id,
        fakturownia_token:      inv.token,
        external_payment_ref:   inv.number,
        payment_url:            fa.invoiceUrl(inv.token),
        pdf_url:                fa.invoicePdfUrl(inv.token),
        fakturownia_sync_status: 'synced',
      }).eq('id', doc.id);
    } catch {
      await supabase.from('financial_documents')
        .update({ fakturownia_sync_status: 'failed' }).eq('id', doc.id);
    }
  }
}

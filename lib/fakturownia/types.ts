export type FaInvoiceKind = 'vat' | 'accounting_note';

export interface FaClient {
  id: number;
  name: string;
  tax_no: string | null;
}

export interface FaPosition {
  name: string;
  quantity: number;
  /** For VAT invoices: net unit price + numeric tax (e.g. 23). */
  price_net?: number;
  /** For notes / gross-driven docs: gross total for the position. */
  total_price_gross?: number;
  /** 23 for VAT, 'np' (nie podlega) for accounting notes. */
  tax: number | 'np';
}

export interface FaInvoiceInput {
  kind: FaInvoiceKind;
  client_id: number;
  issue_date: string;        // 'YYYY-MM-DD'
  payment_to_kind?: number;  // days
  positions: FaPosition[];
}

export interface FaInvoice {
  id: number;
  number: string;
  token: string;
  status: 'issued' | 'sent' | 'paid' | 'partial' | 'rejected';
}

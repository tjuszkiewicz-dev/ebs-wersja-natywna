import { describe, it, expect, vi } from 'vitest';
import {
  ensureClient,
  buildNotaInput,
  buildFakturaInput,
  issueDocumentsForOrder,
  issueFakturaForOrder,
} from './invoiceService';

function fakeSupabase(companyRow: any, updateSpy = vi.fn()) {
  return {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        single: () => Promise.resolve({ data: companyRow }),
        update(payload: any) { updateSpy(payload); return { eq: () => Promise.resolve({ error: null }) }; },
      };
    },
  };
}

describe('ensureClient', () => {
  it('returns cached fakturownia_client_id without calling FA', async () => {
    const fa = { findClientByNip: vi.fn(), createClient: vi.fn() };
    const company = { id: 'c1', nip: '5842867357', name: 'X', fakturownia_client_id: 42 };
    const id = await ensureClient(fakeSupabase(company) as any, fa as any, company as any);
    expect(id).toBe(42);
    expect(fa.findClientByNip).not.toHaveBeenCalled();
  });

  it('finds by NIP, caches the id, and returns it', async () => {
    const fa = { findClientByNip: vi.fn().mockResolvedValue({ id: 7 }), createClient: vi.fn() };
    const updateSpy = vi.fn();
    const company = { id: 'c1', nip: '5842867357', name: 'X', fakturownia_client_id: null,
      address_street: 'Junony 23', address_city: 'Gdańsk', address_zip: '80-299' };
    const id = await ensureClient(fakeSupabase(company, updateSpy) as any, fa as any, company as any);
    expect(id).toBe(7);
    expect(updateSpy).toHaveBeenCalledWith({ fakturownia_client_id: 7 });
  });

  it('creates a client when none exists', async () => {
    const fa = { findClientByNip: vi.fn().mockResolvedValue(null),
      createClient: vi.fn().mockResolvedValue({ id: 9 }) };
    const company = { id: 'c1', nip: '5842867357', name: 'X', fakturownia_client_id: null };
    const id = await ensureClient(fakeSupabase(company) as any, fa as any, company as any);
    expect(id).toBe(9);
    expect(fa.createClient).toHaveBeenCalled();
  });
});

describe('document mapping', () => {
  it('nota: gross = voucher amount, tax np, kind accounting_note', () => {
    const input = buildNotaInput(7, 5000, '2026-06-12', 14);
    expect(input.kind).toBe('accounting_note');
    expect(input.client_id).toBe(7);
    expect(input.payment_to_kind).toBe(14);
    expect(input.positions[0]).toMatchObject({ total_price_gross: 5000, tax: 'np' });
  });

  it('faktura: gross fee with 23% VAT, kind vat (konto FA w trybie cen brutto)', () => {
    const input = buildFakturaInput(7, 1230, '2026-06-12', 14);
    expect(input.kind).toBe('vat');
    expect(input.positions[0]).toMatchObject({ total_price_gross: 1230, tax: 23 });
    expect(input.positions[0].price_net).toBeUndefined();
  });
});

describe('issueDocumentsForOrder', () => {
  const order = { id: 'o1', company_id: 'c1', amount_pln: 5000 } as any;
  const company = { id: 'c1', nip: '5842867357', name: 'X', fakturownia_client_id: 7 } as any;

  it('skips a doc that already has a fakturownia_invoice_id', async () => {
    const fa = { createInvoice: vi.fn(), invoiceUrl: () => 'u', invoicePdfUrl: () => 'p' };
    const existing = [{ type: 'nota', fakturownia_invoice_id: 1 }, { type: 'faktura_vat', fakturownia_invoice_id: 2 }];
    const supa = supaForIssue(existing);
    await issueDocumentsForOrder(supa as any, fa as any, order, company, 20, 14);
    expect(fa.createInvoice).not.toHaveBeenCalled();
  });

  it('creates missing docs and writes back ids + links', async () => {
    const fa = {
      createInvoice: vi.fn()
        .mockResolvedValueOnce({ id: 11, number: 'NK/1', token: 'tn', status: 'issued' })
        .mockResolvedValueOnce({ id: 22, number: 'FV/1', token: 'tf', status: 'issued' }),
      invoiceUrl: (t: string) => `https://d/invoice/${t}`,
      invoicePdfUrl: (t: string) => `https://d/invoice/${t}.pdf`,
    };
    const updates: any[] = [];
    const supa = supaForIssue([{ type: 'nota', fakturownia_invoice_id: null, id: 'd1' },
                               { type: 'faktura_vat', fakturownia_invoice_id: null, id: 'd2' }], updates);
    const res = await issueDocumentsForOrder(supa as any, fa as any, order, company, 20, 14);
    expect(fa.createInvoice).toHaveBeenCalledTimes(2);
    expect(updates[0]).toMatchObject({ fakturownia_invoice_id: 11, fakturownia_sync_status: 'synced',
      external_payment_ref: 'NK/1', payment_url: 'https://d/invoice/tn' });
    expect(res).toEqual({ issued: 2, failed: 0, skipped: 0 });
  });

  it('marks a doc failed (no invoice id) when createInvoice throws — safe to retry', async () => {
    const fa = { createInvoice: vi.fn().mockRejectedValue(new Error('FA 500')),
      invoiceUrl: () => 'u', invoicePdfUrl: () => 'p' };
    const updates: any[] = [];
    const supa = supaForIssue([{ type: 'nota', fakturownia_invoice_id: null, id: 'd1' }], updates);
    const res = await issueDocumentsForOrder(supa as any, fa as any, order, company, 20, 14);
    expect(updates).toEqual([{ fakturownia_sync_status: 'failed' }]);
    expect(res).toEqual({ issued: 0, failed: 1, skipped: 0 });
  });

  it('does NOT mark failed when invoice was created but DB persist fails — avoids duplicate on retry', async () => {
    const fa = { createInvoice: vi.fn().mockResolvedValue({ id: 11, number: 'NK/1', token: 'tn', status: 'issued' }),
      invoiceUrl: (t: string) => `https://d/invoice/${t}`, invoicePdfUrl: (t: string) => `https://d/invoice/${t}.pdf` };
    const updates: any[] = [];
    // update() zawsze zwraca błąd → persist nieudany
    const supa = {
      from(table: string) {
        if (table === 'financial_documents') {
          return {
            select() { return this; }, eq() { return this; },
            order() { return Promise.resolve({ data: [{ type: 'nota', fakturownia_invoice_id: null, id: 'd1' }] }); },
            update(payload: any) { updates.push(payload); return { eq: () => Promise.resolve({ error: { message: 'db down' } }) }; },
          };
        }
        return { select() { return this; }, eq() { return this; }, single: () => Promise.resolve({ data: {} }) };
      },
    };
    const res = await issueDocumentsForOrder(supa as any, fa as any, order, company, 20, 14);
    // próbował zapisać synced payload (3 razy), ale NIGDY nie zapisał 'failed'
    expect(updates.every(u => u.fakturownia_sync_status === 'synced')).toBe(true);
    expect(res).toEqual({ issued: 0, failed: 1, skipped: 0 });
  });

  it('issueFakturaForOrder: null gdy zamówienie nie istnieje', async () => {
    const supa = { from: () => ({ select() { return this; }, eq() { return this; }, single: () => Promise.resolve({ data: null }) }) };
    const res = await issueFakturaForOrder(supa as any, {} as any, 'missing');
    expect(res).toBeNull();
  });

  it('issueFakturaForOrder: wystawia TYLKO fakturę, brutto z fee_percent firmy', async () => {
    const fa = {
      createInvoice: vi.fn().mockResolvedValue({ id: 77, number: 'FV/7', token: 'tf', status: 'issued' }),
      invoiceUrl: (t: string) => `https://d/invoice/${t}`, invoicePdfUrl: (t: string) => `https://d/invoice/${t}.pdf`,
    };
    const updates: any[] = [];
    const supa = {
      from(table: string) {
        if (table === 'voucher_orders') return { select() { return this; }, eq() { return this; },
          single: () => Promise.resolve({ data: { id: 'o1', company_id: 'c1', amount_pln: 5000 } }) };
        if (table === 'companies') return { select() { return this; }, eq() { return this; },
          single: () => Promise.resolve({ data: { id: 'c1', nip: '5842867357', name: 'X', fee_percent: 15,
            fakturownia_client_id: 7, custom_payment_terms_days: null } }) };
        if (table === 'financial_documents') return {
          select() { return this; }, eq() { return this; },
          order: () => Promise.resolve({ data: [
            { type: 'nota', fakturownia_invoice_id: null, id: 'd1' },          // lokalna — musi zostać pominięta
            { type: 'faktura_vat', fakturownia_invoice_id: null, id: 'd2' },
          ] }),
          update(p: any) { updates.push(p); return { eq: () => Promise.resolve({ error: null }) }; },
        };
        return { select() { return this; }, eq() { return this; }, single: () => Promise.resolve({ data: {} }) };
      },
    };
    const res = await issueFakturaForOrder(supa as any, fa as any, 'o1');
    expect(fa.createInvoice).toHaveBeenCalledTimes(1);
    const input = fa.createInvoice.mock.calls[0][0];
    expect(input.kind).toBe('vat');
    // 5000 × 15% = 750 netto → 922,50 brutto (23% VAT)
    expect(input.positions[0].total_price_gross).toBeCloseTo(922.5, 2);
    expect(res).toEqual({ issued: 1, failed: 0, skipped: 0 });
  });

  it('only="nota" wystawia tylko notę, pomija fakturę (odroczenie)', async () => {
    const fa = {
      createInvoice: vi.fn().mockResolvedValue({ id: 11, number: 'NK/1', token: 'tn', status: 'issued' }),
      invoiceUrl: (t: string) => `https://d/invoice/${t}`, invoicePdfUrl: (t: string) => `https://d/invoice/${t}.pdf`,
    };
    const updates: any[] = [];
    const supa = supaForIssue([{ type: 'nota', fakturownia_invoice_id: null, id: 'd1' },
                               { type: 'faktura_vat', fakturownia_invoice_id: null, id: 'd2' }], updates);
    const res = await issueDocumentsForOrder(supa as any, fa as any, order, company, 20, 14, 'nota');
    expect(fa.createInvoice).toHaveBeenCalledTimes(1);
    expect(updates[0]).toMatchObject({ fakturownia_invoice_id: 11 });
    expect(res).toEqual({ issued: 1, failed: 0, skipped: 0 });
  });
});

// Helper: supabase double returning the given financial_documents rows.
function supaForIssue(rows: any[], updates: any[] = []) {
  return {
    from(table: string) {
      if (table === 'financial_documents') {
        return {
          select() { return this; },
          eq() { return this; },
          // resolve the list query
          order() { return Promise.resolve({ data: rows }); },
          update(payload: any) { updates.push(payload); return { eq: () => Promise.resolve({ error: null }) }; },
        };
      }
      return { select() { return this; }, eq() { return this; }, single: () => Promise.resolve({ data: {} }) };
    },
  };
}

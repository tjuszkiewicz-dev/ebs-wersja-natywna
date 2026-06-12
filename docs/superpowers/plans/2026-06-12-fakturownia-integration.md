# Fakturownia Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Issue every EBS accounting note + VAT invoice in Fakturownia (source of truth) at order `hr-confirm`, surface the Fakturownia PDF + pay link in EBS, and sync paid-status back via webhook + 30-min cron.

**Architecture:** A pure HTTP wrapper (`lib/fakturownia/client.ts`) wraps the Fakturownia REST API. A mapping layer (`lib/fakturownia/invoiceService.ts`) turns an EBS order + company into two Fakturownia documents and persists ids/links into `financial_documents`. `hr-confirm` calls the service (failure-tolerant). A webhook + cron reconcile payment status. KSeF is automatic on the Fakturownia account — no KSeF code in EBS.

**Tech Stack:** Next.js 15 route handlers, Supabase (service-role client), Vitest (added in Task 0), Fakturownia REST API.

**Spec:** `docs/superpowers/specs/2026-06-12-fakturownia-integration-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `vitest.config.ts` (create) | Test runner config (node env) |
| `supabase/migrations/037_fakturownia.sql` (create) | New columns on `companies` + `financial_documents` |
| `types/database.ts` (modify) | Add new columns to generated types |
| `lib/fakturownia/client.ts` (create) | Pure HTTP wrapper — no EBS knowledge |
| `lib/fakturownia/client.test.ts` (create) | Unit tests (mocked fetch) |
| `lib/fakturownia/types.ts` (create) | Shared TS types for FA payloads/responses |
| `lib/fakturownia/invoiceService.ts` (create) | Map EBS order/company → FA docs; persist |
| `lib/fakturownia/invoiceService.test.ts` (create) | Unit tests (mocked client + supabase) |
| `app/api/orders/[id]/hr-confirm/route.ts` (modify) | Call invoiceService instead of local nota/faktura |
| `app/api/webhooks/fakturownia/route.ts` (create) | Instant paid-status sync |
| `app/api/cron/sync-fakturownia-payments/route.ts` (create) | 30-min reconciliation poll |
| `app/api/financial-documents/[id]/retry-fakturownia/route.ts` (create) | Re-issue a failed doc |
| `vercel.json` (modify) | Add cron entry |
| `components/adminNew/AdminPlatnosci.tsx` (modify) | Pay link, FA PDF, status badge, retry button |
| `.env.local` + Vercel env (manual) | `FAKTUROWNIA_*` secrets |

---

## Task 0: Add Vitest test runner

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (scripts + devDependency)

- [ ] **Step 1: Install vitest**

Run: `npm install -D vitest@^2.1.0`
Expected: added to devDependencies.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'services/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

- [ ] **Step 3: Add test script to `package.json`**

In the `"scripts"` block add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify runner works**

Run: `npm test`
Expected: "No test files found" (no tests yet) — exit 0. Runner is wired.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest test runner"
```

---

## Task 1: DB migration + types

**Files:**
- Create: `supabase/migrations/037_fakturownia.sql`
- Modify: `types/database.ts`

- [ ] **Step 1: Write migration `supabase/migrations/037_fakturownia.sql`**

```sql
-- Migracja 037: Integracja Fakturownia — kolumny pomocnicze.
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS fakturownia_client_id INTEGER;

ALTER TABLE financial_documents
  ADD COLUMN IF NOT EXISTS fakturownia_invoice_id  INTEGER,
  ADD COLUMN IF NOT EXISTS fakturownia_token       TEXT,
  ADD COLUMN IF NOT EXISTS payment_url             TEXT,
  ADD COLUMN IF NOT EXISTS fakturownia_sync_status TEXT
      CHECK (fakturownia_sync_status IN ('pending','synced','failed'));

CREATE INDEX IF NOT EXISTS idx_findocs_fakturownia
  ON financial_documents(fakturownia_invoice_id);
```

- [ ] **Step 2: Apply migration to the database**

Apply via the Supabase MCP `apply_migration` (name: `037_fakturownia`) or `supabase db push`.
Expected: success, no errors.

- [ ] **Step 3: Update `types/database.ts` — `companies`**

In the `companies` `Row` add `fakturownia_client_id: number | null;` and in `Insert`/`Update` add `fakturownia_client_id?: number | null;`.

- [ ] **Step 4: Update `types/database.ts` — `financial_documents`**

In `financial_documents` `Row` add:
```ts
fakturownia_invoice_id:  number | null;
fakturownia_token:       string | null;
payment_url:             string | null;
fakturownia_sync_status: 'pending' | 'synced' | 'failed' | null;
```
And the optional `?:` variants in `Insert` and `Update`.

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/037_fakturownia.sql types/database.ts
git commit -m "feat(db): add Fakturownia columns to companies + financial_documents"
```

---

## Task 2: Fakturownia HTTP client (pure wrapper)

**Files:**
- Create: `lib/fakturownia/types.ts`
- Create: `lib/fakturownia/client.ts`
- Test: `lib/fakturownia/client.test.ts`

- [ ] **Step 1: Create `lib/fakturownia/types.ts`**

```ts
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
```

- [ ] **Step 2: Write the failing test `lib/fakturownia/client.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FakturowniaClient } from './client';

const OK = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

describe('FakturowniaClient', () => {
  const fetchMock = vi.fn();
  const client = new FakturowniaClient('demo', 'TOKEN', fetchMock as unknown as typeof fetch);

  beforeEach(() => fetchMock.mockReset());

  it('finds a client by NIP, returning null when none match', async () => {
    fetchMock.mockReturnValueOnce(OK([]));
    const result = await client.findClientByNip('5842867357');
    expect(result).toBeNull();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('https://demo.fakturownia.pl/clients.json');
    expect(url).toContain('tax_no=5842867357');
    expect(url).toContain('api_token=TOKEN');
  });

  it('returns the first client when NIP matches', async () => {
    fetchMock.mockReturnValueOnce(OK([{ id: 7, name: 'X', tax_no: '5842867357' }]));
    const result = await client.findClientByNip('5842867357');
    expect(result).toEqual({ id: 7, name: 'X', tax_no: '5842867357' });
  });

  it('creates an invoice via POST /invoices.json', async () => {
    fetchMock.mockReturnValueOnce(OK({ id: 99, number: 'FV/2026/1', token: 'abc', status: 'issued' }));
    const inv = await client.createInvoice({
      kind: 'vat', client_id: 7, issue_date: '2026-06-12',
      positions: [{ name: 'Fee', quantity: 1, price_net: 100, tax: 23 }],
    });
    expect(inv.id).toBe(99);
    expect(inv.token).toBe('abc');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://demo.fakturownia.pl/invoices.json');
    expect((init as RequestInit).method).toBe('POST');
    const sent = JSON.parse((init as RequestInit).body as string);
    expect(sent.api_token).toBe('TOKEN');
    expect(sent.invoice.kind).toBe('vat');
  });

  it('throws on non-OK HTTP response', async () => {
    fetchMock.mockReturnValueOnce(
      Promise.resolve({ ok: false, status: 422, text: () => Promise.resolve('bad') } as Response),
    );
    await expect(client.getInvoice(1)).rejects.toThrow(/422/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- client`
Expected: FAIL — `FakturowniaClient` not found.

- [ ] **Step 4: Implement `lib/fakturownia/client.ts`**

```ts
import type { FaClient, FaInvoice, FaInvoiceInput } from './types';

export class FakturowniaClient {
  private base: string;
  constructor(
    domain: string,
    private token: string,
    private fetchImpl: typeof fetch = fetch,
  ) {
    this.base = `https://${domain}.fakturownia.pl`;
  }

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.fetchImpl(`${this.base}${path}`, init);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Fakturownia ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async findClientByNip(nip: string): Promise<FaClient | null> {
    const list = await this.req<FaClient[]>(
      `/clients.json?tax_no=${encodeURIComponent(nip)}&api_token=${this.token}`,
    );
    return list[0] ?? null;
  }

  async createClient(data: { name: string; tax_no: string; street?: string; city?: string; post_code?: string }): Promise<FaClient> {
    return this.req<FaClient>('/clients.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_token: this.token, client: { country: 'PL', ...data } }),
    });
  }

  async createInvoice(invoice: FaInvoiceInput): Promise<FaInvoice> {
    return this.req<FaInvoice>('/invoices.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_token: this.token, invoice }),
    });
  }

  async getInvoice(id: number): Promise<FaInvoice> {
    return this.req<FaInvoice>(`/invoices/${id}.json?api_token=${this.token}`);
  }

  /** Public links (token-based). Pay button shows if a gateway is configured on the account. */
  invoiceUrl(token: string): string { return `${this.base}/invoice/${token}`; }
  invoicePdfUrl(token: string): string { return `${this.base}/invoice/${token}.pdf`; }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- client`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/fakturownia/types.ts lib/fakturownia/client.ts lib/fakturownia/client.test.ts
git commit -m "feat(fakturownia): pure HTTP client with unit tests"
```

---

## Task 3: invoiceService — client mapping (`ensureClient`)

**Files:**
- Create: `lib/fakturownia/invoiceService.ts`
- Test: `lib/fakturownia/invoiceService.test.ts`

- [ ] **Step 1: Write the failing test `lib/fakturownia/invoiceService.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { ensureClient } from './invoiceService';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- invoiceService`
Expected: FAIL — `ensureClient` not exported.

- [ ] **Step 3: Implement `ensureClient` in `lib/fakturownia/invoiceService.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FakturowniaClient } from './client';

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- invoiceService`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/fakturownia/invoiceService.ts lib/fakturownia/invoiceService.test.ts
git commit -m "feat(fakturownia): ensureClient maps EBS company to FA client by NIP"
```

---

## Task 4: invoiceService — issue note + invoice for an order

**Files:**
- Modify: `lib/fakturownia/invoiceService.ts`
- Test: `lib/fakturownia/invoiceService.test.ts`

- [ ] **Step 1: Add failing tests for `buildPositions` mapping**

Append to `lib/fakturownia/invoiceService.test.ts`:
```ts
import { buildNotaInput, buildFakturaInput } from './invoiceService';

describe('document mapping', () => {
  it('nota: gross = voucher amount, tax np, kind accounting_note', () => {
    const input = buildNotaInput(7, 5000, '2026-06-12', 14);
    expect(input.kind).toBe('accounting_note');
    expect(input.client_id).toBe(7);
    expect(input.payment_to_kind).toBe(14);
    expect(input.positions[0]).toMatchObject({ total_price_gross: 5000, tax: 'np' });
  });

  it('faktura: net fee with 23% VAT, kind vat', () => {
    const input = buildFakturaInput(7, 1000, '2026-06-12', 14);
    expect(input.kind).toBe('vat');
    expect(input.positions[0]).toMatchObject({ price_net: 1000, tax: 23 });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- invoiceService`
Expected: FAIL — `buildNotaInput`/`buildFakturaInput` not exported.

- [ ] **Step 3: Implement the builders in `lib/fakturownia/invoiceService.ts`**

```ts
import type { FaInvoiceInput } from './types';

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
```

- [ ] **Step 4: Add failing test for `issueDocumentsForOrder` (idempotency + persistence)**

Append:
```ts
import { issueDocumentsForOrder } from './invoiceService';

describe('issueDocumentsForOrder', () => {
  const order = { id: 'o1', company_id: 'c1', amount_pln: 5000 } as any;
  const company = { id: 'c1', nip: '5842867357', name: 'X', fakturownia_client_id: 7 } as any;

  it('skips a doc that already has a fakturownia_invoice_id', async () => {
    const fa = { createInvoice: vi.fn(), invoiceUrl: () => 'u', invoicePdfUrl: () => 'p' };
    const existing = [{ type: 'nota', fakturownia_invoice_id: 1 }, { type: 'faktura_vat', fakturownia_invoice_id: 2 }];
    const supa = supaForIssue(existing);
    await issueDocumentsForOrder(supa as any, fa as any, order, company, 1000, 14);
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
    await issueDocumentsForOrder(supa as any, fa as any, order, company, 1000, 14);
    expect(fa.createInvoice).toHaveBeenCalledTimes(2);
    expect(updates[0]).toMatchObject({ fakturownia_invoice_id: 11, fakturownia_sync_status: 'synced',
      external_payment_ref: 'NK/1', payment_url: 'https://d/invoice/tn' });
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
          then: undefined,
          // resolve the list query
          order() { return Promise.resolve({ data: rows }); },
          update(payload: any) { updates.push(payload); return { eq: () => Promise.resolve({ error: null }) }; },
        };
      }
      return { select() { return this; }, eq() { return this; }, single: () => Promise.resolve({ data: {} }) };
    },
  };
}
```

- [ ] **Step 5: Run to verify failure**

Run: `npm test -- invoiceService`
Expected: FAIL — `issueDocumentsForOrder` not exported.

- [ ] **Step 6: Implement `issueDocumentsForOrder`**

Append to `lib/fakturownia/invoiceService.ts`:
```ts
import { calculateOrderTotals } from '@/utils/financialMath';

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
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- invoiceService`
Expected: PASS (all invoiceService tests).

- [ ] **Step 8: Commit**

```bash
git add lib/fakturownia/invoiceService.ts lib/fakturownia/invoiceService.test.ts
git commit -m "feat(fakturownia): issue nota + faktura per order, idempotent, with persistence"
```

---

## Task 5: Factory + wire into `hr-confirm`

**Files:**
- Create: `lib/fakturownia/factory.ts`
- Modify: `app/api/orders/[id]/hr-confirm/route.ts`

- [ ] **Step 1: Create `lib/fakturownia/factory.ts`**

```ts
import { FakturowniaClient } from './client';

/** Returns a configured client, or null when env is not set (integration disabled). */
export function getFakturowniaClient(): FakturowniaClient | null {
  const token = process.env.FAKTUROWNIA_API_TOKEN;
  const domain = process.env.FAKTUROWNIA_DOMAIN;
  if (!token || !domain) return null;
  return new FakturowniaClient(domain, token);
}
```

- [ ] **Step 2: In `hr-confirm/route.ts`, ensure financial_documents rows exist (created by existing `createOrderDocuments`)**

No change to existing `createOrderDocuments` call yet — it already inserts `financial_documents` rows (type `nota`, `faktura_vat`) linked by `linked_order_id`. The Fakturownia step runs AFTER and fills the FA fields on those rows.

- [ ] **Step 3: Add the Fakturownia issuance block in `hr-confirm/route.ts`**

After the existing nota/faktura `try { ... createOrderDocuments ... } catch {}` block (ends at line ~138), insert:
```ts
  // 2b. Wystaw dokumenty w Fakturowni (źródło prawdy). Awaria FA nie blokuje potwierdzenia.
  try {
    const fa = getFakturowniaClient();
    if (fa) {
      const { data: companyFa } = await supabase
        .from('companies')
        .select('id, nip, name, fakturownia_client_id, address_street, address_city, address_zip, fee_percent, custom_payment_terms_days')
        .eq('id', order.company_id)
        .single();
      if (companyFa) {
        await issueDocumentsForOrder(
          supabase, fa, order, companyFa as any,
          (companyFa as any).fee_percent ?? 20,
          (companyFa as any).custom_payment_terms_days ?? undefined,
        );
      }
    }
  } catch {
    // Awaria integracji FA nie blokuje zatwierdzenia — dokumenty zostają z sync_status='failed'/null.
  }
```

- [ ] **Step 4: Add the import at the top of `hr-confirm/route.ts`**

```ts
import { getFakturowniaClient } from '@/lib/fakturownia/factory';
import { issueDocumentsForOrder } from '@/lib/fakturownia/invoiceService';
```

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 TS errors; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add lib/fakturownia/factory.ts "app/api/orders/[id]/hr-confirm/route.ts"
git commit -m "feat(fakturownia): issue documents in Fakturownia at hr-confirm"
```

---

## Task 6: Payment webhook

**Files:**
- Create: `app/api/webhooks/fakturownia/route.ts`

- [ ] **Step 1: Implement the webhook `app/api/webhooks/fakturownia/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

// Fakturownia powiadamia o zmianie statusu faktury. Weryfikacja sekretu w query (?secret=).
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!secret || secret !== process.env.FAKTUROWNIA_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as { id?: number; status?: string } | null;
  const invoiceId = body?.id;
  const status = body?.status;
  if (!invoiceId) return NextResponse.json({ ok: true }); // nic do zrobienia

  if (status === 'paid') {
    const supabase = supabaseServer();
    await supabase.from('financial_documents').update({
      status: 'paid',
      payment_confirmed_at: new Date().toISOString(),
    }).eq('fakturownia_invoice_id', invoiceId);
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/webhooks/fakturownia/route.ts
git commit -m "feat(fakturownia): payment webhook marks documents paid"
```

> **Note:** Confirm the exact webhook payload shape (`id`/`status` field names) in the Fakturownia account "Webhooki" settings during the manual POC (Task 10) and adjust the parsing if needed.

---

## Task 7: Reconciliation cron

**Files:**
- Create: `app/api/cron/sync-fakturownia-payments/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Implement the cron `app/api/cron/sync-fakturownia-payments/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getFakturowniaClient } from '@/lib/fakturownia/factory';

// Reconcyliacja: odpytaj FA o status niezapłaconych dokumentów. Vercel Cron wywołuje GET.
export async function GET() {
  const fa = getFakturowniaClient();
  if (!fa) return NextResponse.json({ skipped: 'integration disabled' });

  const supabase = supabaseServer();
  const { data: docs } = await supabase
    .from('financial_documents')
    .select('id, fakturownia_invoice_id')
    .eq('status', 'pending')
    .not('fakturownia_invoice_id', 'is', null);

  let updated = 0;
  for (const doc of docs ?? []) {
    try {
      const inv = await fa.getInvoice(doc.fakturownia_invoice_id as number);
      if (inv.status === 'paid') {
        await supabase.from('financial_documents').update({
          status: 'paid',
          payment_confirmed_at: new Date().toISOString(),
        }).eq('id', doc.id);
        updated++;
      }
    } catch {
      // pojedyncza faktura nie wywraca całej reconcyliacji
    }
  }
  return NextResponse.json({ checked: docs?.length ?? 0, updated });
}
```

- [ ] **Step 2: Add cron entry to `vercel.json`**

In the `"crons"` array (next to the existing `expire-vouchers` entry) add:
```json
{ "path": "/api/cron/sync-fakturownia-payments", "schedule": "*/30 * * * *" }
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: route appears in build output; 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/sync-fakturownia-payments/route.ts vercel.json
git commit -m "feat(fakturownia): 30-min cron reconciles payment status"
```

---

## Task 8: Retry endpoint for failed documents

**Files:**
- Create: `app/api/financial-documents/[id]/retry-fakturownia/route.ts`

- [ ] **Step 1: Implement the retry route**

```ts
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
  const { data: company } = await supabase
    .from('companies')
    .select('id, nip, name, fakturownia_client_id, address_street, address_city, address_zip, fee_percent, custom_payment_terms_days')
    .eq('id', (order as any).company_id).single();

  await issueDocumentsForOrder(
    supabase, fa, order as any, company as any,
    (company as any).fee_percent ?? 20,
    (company as any).custom_payment_terms_days ?? undefined,
  );
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/financial-documents/[id]/retry-fakturownia/route.ts"
git commit -m "feat(fakturownia): admin retry endpoint for failed document issuance"
```

---

## Task 9: UI — pay link, FA PDF, status, retry

**Files:**
- Modify: `components/adminNew/AdminPlatnosci.tsx`

- [ ] **Step 1: Locate where a financial document row is rendered**

Run: `grep -n "pdf_url\|status\|document_number\|map(" components/adminNew/AdminPlatnosci.tsx`
Identify the row/card render for each document.

- [ ] **Step 2: Add the action cell to each document row**

In the per-document render, add (use existing Tailwind/button conventions in the file):
```tsx
{doc.payment_url && (
  <a href={doc.payment_url} target="_blank" rel="noopener noreferrer"
     className="px-3 py-1 rounded bg-green-600 text-white text-sm">Zapłać</a>
)}
{doc.pdf_url && (
  <a href={doc.pdf_url} target="_blank" rel="noopener noreferrer"
     className="px-3 py-1 rounded bg-slate-200 text-sm">PDF</a>
)}
{doc.fakturownia_sync_status === 'failed' && (
  <button
    onClick={async () => {
      await fetch(`/api/financial-documents/${doc.id}/retry-fakturownia`, { method: 'POST' });
      location.reload();
    }}
    className="px-3 py-1 rounded bg-amber-500 text-white text-sm">Ponów wysyłkę</button>
)}
```

- [ ] **Step 3: Ensure the documents query/type exposes the new fields**

If `AdminPlatnosci` fetches from `/api/invoices` or `/api/companies/[id]/financials`, confirm those routes `select('*')` (they do) so `payment_url`, `pdf_url`, `fakturownia_sync_status` flow through. If a local TS interface lists fields explicitly, add `payment_url?: string | null; fakturownia_sync_status?: string | null;`.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 5: Commit**

```bash
git add components/adminNew/AdminPlatnosci.tsx
git commit -m "feat(fakturownia): surface pay link, FA PDF, status, retry in admin payments"
```

---

## Task 10: Config, docs, manual POC

**Files:**
- Modify: `.env.local` (manual, not committed), Vercel env (manual)
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add env vars locally and in Vercel**

`.env.local`:
```
FAKTUROWNIA_API_TOKEN=<token z konta>
FAKTUROWNIA_DOMAIN=stratton-prime
FAKTUROWNIA_WEBHOOK_SECRET=<losowy sekret>
```
Add the same three in Vercel → Project → Settings → Environment Variables (Production).

- [ ] **Step 2: Configure Fakturownia account (manual prerequisites)**

Confirm on `stratton-prime.fakturownia.pl`: (a) payment gateway connected (for the "Zapłać" button), (b) auto-KSeF enabled, (c) webhook → `https://ebs-wersja-natywna.vercel.app/api/webhooks/fakturownia?secret=<FAKTUROWNIA_WEBHOOK_SECRET>`.

- [ ] **Step 3: Manual POC — one test invoice**

With a test/dev company, run an `hr-confirm` and verify in Fakturownia: client created/matched by NIP, two documents (accounting_note + vat), PDF link works, pay link shows the gateway button. Verify `financial_documents` rows got `fakturownia_invoice_id`, `payment_url`, `pdf_url`, `fakturownia_sync_status='synced'`.

- [ ] **Step 4: Update `CLAUDE.md`**

Add a "Fakturownia Integration" subsection documenting: env vars, source-of-truth model, the `lib/fakturownia/*` modules, webhook + cron, and that local PDF generation for nota/faktura is now superseded (kept as fallback pending removal).

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document Fakturownia integration in CLAUDE.md"
```

---

## Self-Review Notes

- **Spec coverage:** §5.1 client → Task 2; §5.2 service (ensureClient/issue) → Tasks 3-4; §5.3 hr-confirm → Task 5; §5.4 webhook → Task 6; §5.5 cron → Task 7; §6 migration/types → Task 1; §7 UI + retry → Tasks 8-9; §8 env → Task 10; §9 idempotency/failure → Tasks 4-5; §10 tests → Tasks 2-4; KSeF (auto) → no code (Task 10 prerequisite). ✅
- **Test runner gap:** spec assumed unit tests but repo had none → Task 0 adds Vitest. ✅
- **Type consistency:** `issueDocumentsForOrder(supabase, fa, order, company, feePercent, paymentDays)` signature identical in Tasks 4, 5, 8. `FaInvoiceInput`/`FaInvoice` shared via `types.ts`. `ensureClient` signature identical across Tasks 3-4.
- **Open item carried to execution:** exact webhook payload field names verified during Task 10 POC (noted in Task 6).

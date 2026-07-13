# SP1 — Dedykowany rachunek firmy na nocie — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nota księgowa danej firmy drukuje jej dedykowany numer rachunku (subkonto Millennium), a nie zahardkodowane konto Stratton; admin ustawia ten numer w panelu firmy.

**Architecture:** Nowa kolumna `companies.bank_account` (+ opis). Pure-function nota (`buildPolishInvoiceHtml`) dostaje opcjonalny `sellerBankAccount` w kontekście i drukuje go (fallback `ISSUER.bank`) w sekcji płatności i w kodzie QR. Numer konta jest wątkowany do kontekstu w miejscach tworzących notę (hr-confirm, endpoint PDF, skrypt regen). API `companies` (POST create + PATCH update_settings) przyjmuje i waliduje pole; UI (create modal + karta klienta) pozwala je ustawić. Współdzielony walidator IBAN mod-97 w `lib/iban.ts`.

**Tech Stack:** Next.js 15 (App Router), Supabase (Postgres), TypeScript, Vitest, Zod.

## Global Constraints

- Migracje numerowane rosnąco, unikalnie; następna wolna to `040_*.sql` (istnieje 039).
- `companies.bank_account` walidowane algorytmem **mod-97 (ISO 13616)**; pole **opcjonalne** — brak = fallback do `ISSUER.bank` (`lib/documents/pdfUtils.ts`, celowo NIE z env).
- Zakres `fee_percent` firmy pozostaje 15–31 (bez zmian w tym SP).
- Testy jednostkowe uruchamiane przez `npx vitest run` (jedyny runner w repo); brak infrastruktury do testów route/React — dla migracji/API/UI kroki to weryfikacja manualna.
- Commity częste; `npx tsc --noEmit` musi dawać 0 błędów po każdym zadaniu (build ma `ignoreBuildErrors:true`, więc pilnujemy ręcznie).

---

### Task 1: Współdzielony walidator IBAN (`lib/iban.ts`)

**Files:**
- Create: `lib/iban.ts`
- Test: `lib/iban.test.ts`

**Interfaces:**
- Produces: `isValidIBAN(raw: string): boolean` (mod-97, ignoruje spacje/wielkość liter, 15–34 znaki), `formatIBAN(raw: string): string` (grupy po 4).

- [ ] **Step 1: Write the failing test**

```ts
// lib/iban.test.ts
import { describe, it, expect } from 'vitest';
import { isValidIBAN, formatIBAN } from './iban';

describe('isValidIBAN', () => {
  it('accepts a valid IBAN (canonical GB example)', () => {
    expect(isValidIBAN('GB82 WEST 1234 5698 7654 32')).toBe(true);
  });
  it('accepts a valid PL IBAN', () => {
    expect(isValidIBAN('PL61 1090 1014 0000 0712 1981 2874')).toBe(true);
  });
  it('rejects a wrong checksum', () => {
    expect(isValidIBAN('GB82 WEST 1234 5698 7654 33')).toBe(false);
  });
  it('rejects too short / empty / non-iban', () => {
    expect(isValidIBAN('PL12')).toBe(false);
    expect(isValidIBAN('')).toBe(false);
    expect(isValidIBAN('66 1160 2202')).toBe(false); // brak kodu kraju
  });
});

describe('formatIBAN', () => {
  it('groups into blocks of 4', () => {
    expect(formatIBAN('PL61109010140000071219812874')).toBe('PL61 1090 1014 0000 0712 1981 2874');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/iban.test.ts`
Expected: FAIL — `Failed to resolve import "./iban"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/iban.ts
/**
 * Waliduje IBAN algorytmem mod-97 (ISO 13616). Ignoruje spacje i wielkość liter.
 * Akceptuje 15–34 znaki alfanumeryczne rozpoczynające się od 2-literowego kodu kraju + 2 cyfr.
 */
export function isValidIBAN(raw: string): boolean {
  const s = (raw || '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  // mod-97 fragmentami, by uniknąć przepełnienia Number
  let rem = 0;
  for (let i = 0; i < numeric.length; i++) {
    rem = (rem * 10 + (numeric.charCodeAt(i) - 48)) % 97;
  }
  return rem === 1;
}

/** Formatuje IBAN w grupy po 4 znaki (do druku na dokumencie). */
export function formatIBAN(raw: string): string {
  return (raw || '').replace(/\s+/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/iban.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/iban.ts lib/iban.test.ts
git commit -m "feat(iban): wspoldzielony walidator IBAN mod-97 (lib/iban)"
```

---

### Task 2: Migracja `040` — kolumny rachunku na `companies`

**Files:**
- Create: `supabase/migrations/040_company_bank_account.sql`

**Interfaces:**
- Produces: kolumny `companies.bank_account TEXT`, `companies.bank_account_desc TEXT`.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/040_company_bank_account.sql
-- SP1: dedykowany rachunek firmy drukowany na nocie księgowej (subkonto Millennium per pracodawca).
-- Puste = nota drukuje fallback ISSUER.bank (konto główne Stratton).
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS bank_account      TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_desc TEXT;
```

- [ ] **Step 2: Apply the migration to the remote project**

Zastosuj przez Supabase MCP `apply_migration` (name: `company_bank_account`, project: `ramedybmybcpqvelsmxd`) z treścią z kroku 1.
Expected: `{"success": true}`.

- [ ] **Step 3: Verify columns exist**

Wykonaj SQL:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name='companies' AND column_name IN ('bank_account','bank_account_desc') ORDER BY 1;
```
Expected: dwa wiersze — `bank_account`, `bank_account_desc`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/040_company_bank_account.sql
git commit -m "feat(db): migracja 040 - companies.bank_account (+desc)"
```

---

### Task 3: Nota drukuje `sellerBankAccount` (`buildPolishInvoiceHtml`)

**Files:**
- Modify: `lib/documentService.ts` (interface `DocumentContext` ~20-34; QR `:116`; sekcja płatności `:224`)
- Test: `lib/documentService.test.ts`

**Interfaces:**
- Consumes: `isValidIBAN`/`formatIBAN` nie są tu potrzebne (tylko druk); `ISSUER` z `lib/documents/pdfUtils.ts`.
- Produces: `DocumentContext.sellerBankAccount?: string` — gdy podany, drukowany na nocie zamiast `ISSUER.bank`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/documentService.test.ts
import { describe, it, expect } from 'vitest';
import { buildPolishInvoiceHtml, type DocumentContext } from './documentService';
import { ISSUER } from './documents/pdfUtils';

const baseCtx: DocumentContext = {
  orderId: 'o1', companyId: 'c1', companyName: 'Aneza', companyNip: '7451615606',
  companyAddress: 'ul. Bratnia 11a, 05-091 Ząbki',
  voucherAmount: 3900, feeNet: 585, feeVat: 134.55, feeGross: 719.55,
  issuedAt: '2026-05-10T10:00:00.000Z',
  docNotaNumber: 'NK/2026/TEST/B', docFakturaNumber: 'FV/2026/TEST/S',
  distributionSummary: 'Zamówienie 3900 voucherów',
};

describe('buildPolishInvoiceHtml — konto na nocie', () => {
  it('drukuje konto firmy gdy sellerBankAccount podane', () => {
    const html = buildPolishInvoiceHtml({ ...baseCtx, sellerBankAccount: 'PL61 1090 1014 0000 0712 1981 2874' }, 'nota');
    expect(html).toContain('PL61 1090 1014 0000 0712 1981 2874');
    expect(html).not.toContain(ISSUER.bank);
  });
  it('fallback do ISSUER.bank gdy brak sellerBankAccount', () => {
    const html = buildPolishInvoiceHtml(baseCtx, 'nota');
    expect(html).toContain(ISSUER.bank);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/documentService.test.ts`
Expected: FAIL — pierwszy test: HTML zawiera `ISSUER.bank`, nie konto firmy (pole jeszcze nieużywane), więc `not.toContain(ISSUER.bank)` pada.

- [ ] **Step 3: Add field to `DocumentContext`**

W `lib/documentService.ts` w interfejsie `DocumentContext` (po `distributionSummary`) dodaj:

```ts
  distributionSummary: string; // np. "Emisja 800 voucherów dla 8 pracowników"
  /** Dedykowany rachunek firmy drukowany na nocie; brak = fallback ISSUER.bank */
  sellerBankAccount?: string;
```

- [ ] **Step 4: Compute the printed account and use it**

W funkcji `buildPolishInvoiceHtml`, tuż po linii `const city = ...` dodaj:

```ts
  const bankAccount = ctx.sellerBankAccount?.trim() || ISSUER.bank;
```

Zamień w QR (obecnie `...|${ISSUER.bank}`):

```ts
  const qrData = encodeURIComponent(`${docNumber}|${fmtPl(amountGross)} PLN|${bankAccount}`);
```

Zamień w sekcji płatności (obecny `<p class="f" ...>${ISSUER.bank}</p>`):

```ts
    <p class="f" style="font-family:monospace;font-size:10px;letter-spacing:0.03em">${bankAccount}</p>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/documentService.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/documentService.ts lib/documentService.test.ts
git commit -m "feat(nota): drukuj dedykowany rachunek firmy (sellerBankAccount, fallback ISSUER.bank)"
```

---

### Task 4: Wątkowanie konta firmy do kontekstu noty (3 miejsca)

**Files:**
- Modify: `app/api/orders/[id]/hr-confirm/route.ts` (select firmy + `createOrderDocuments` ctx)
- Modify: `app/api/companies/[id]/financials/[doc_id]/pdf/route.ts` (select firmy + `ctx`)
- Modify: `scripts/regen-company-notas.mts` (select firmy + `ctx`)

**Interfaces:**
- Consumes: `DocumentContext.sellerBankAccount` (Task 3).
- Produces: nota generowana każdą z tych ścieżek zawiera `sellerBankAccount = company.bank_account`.

- [ ] **Step 1: hr-confirm — dodaj `bank_account` do selecta i ctx**

W `app/api/orders/[id]/hr-confirm/route.ts` znajdź select budujący `companyRaw5` (dla `createOrderDocuments`) i dodaj `bank_account` do listy kolumn. Następnie w obiekcie przekazywanym do `createOrderDocuments({...})` dodaj:

```ts
      distributionSummary: `Zamówienie ${order.amount_vouchers} voucherów — oczekuje na opłacenie`,
      sellerBankAccount:   (company as any)?.bank_account ?? undefined,
```

- [ ] **Step 2: PDF endpoint — dodaj `bank_account` do selecta i ctx**

W `app/api/companies/[id]/financials/[doc_id]/pdf/route.ts` w selectcie `companies` (obecnie `id, name, nip, address_street, address_city, address_zip`) dodaj `bank_account`. W obiekcie `ctx: DocumentContext = {...}` dodaj:

```ts
    distributionSummary,
    sellerBankAccount: (company as any).bank_account ?? undefined,
```

- [ ] **Step 3: regen script — dodaj `bank_account`**

W `scripts/regen-company-notas.mts` w selectcie `companies` dodaj `bank_account`, a w `ctx` dodaj `sellerBankAccount: (company as any).bank_account ?? undefined,`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: brak błędów w tych 3 plikach.

- [ ] **Step 5: Commit**

```bash
git add "app/api/orders/[id]/hr-confirm/route.ts" "app/api/companies/[id]/financials/[doc_id]/pdf/route.ts" scripts/regen-company-notas.mts
git commit -m "feat(nota): przekaz company.bank_account do kontekstu noty (hr-confirm, pdf, regen)"
```

---

### Task 5: API `companies` — przyjmij i waliduj `bank_account`

**Files:**
- Modify: `app/api/companies/route.ts` (`AddCompanySchema` + insert)
- Modify: `app/api/companies/[id]/route.ts` (`update_settings` schema + payload)

**Interfaces:**
- Consumes: `isValidIBAN` (Task 1).
- Produces: create i update firmy zapisują `bank_account` (walidowane) i `bank_account_desc`.

- [ ] **Step 1: POST create — schema + insert**

W `app/api/companies/route.ts`: dodaj import `import { isValidIBAN } from '@/lib/iban';`. Do `AddCompanySchema` dodaj:

```ts
  bank_account:      z.string().trim().optional().refine(v => !v || isValidIBAN(v), 'Nieprawidłowy numer rachunku (IBAN)'),
  bank_account_desc: z.string().optional(),
```

W obiekcie `.insert({...})` dodaj:

```ts
      bank_account:      d.bank_account ?? null,
      bank_account_desc: d.bank_account_desc ?? null,
      origin:            'NATIVE',
```

- [ ] **Step 2: PATCH update_settings — schema + payload**

W `app/api/companies/[id]/route.ts`: dodaj import `import { isValidIBAN } from '@/lib/iban';`. W gałęzi `update_settings` `PatchSchema` dodaj pola:

```ts
    bank_account:      z.string().trim().optional().nullable().refine(v => v == null || v === '' || isValidIBAN(v), 'Nieprawidłowy numer rachunku (IBAN)'),
    bank_account_desc: z.string().optional().nullable(),
```

W bloku budującym `updatePayload` (`if (parsed.data.action === 'update_settings')`) dodaj:

```ts
    if (d.bank_account      !== undefined) updatePayload.bank_account = d.bank_account === '' ? null : d.bank_account;
    if (d.bank_account_desc !== undefined) updatePayload.bank_account_desc = d.bank_account_desc;
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: brak błędów.

- [ ] **Step 4: Manual verify (dev)**

Uruchom `npx next dev --port 3010`. Jako superadmin wykonaj `PATCH /api/companies/<id>` z body `{"action":"update_settings","bank_account":"PL61 1090 1014 0000 0712 1981 2874"}` → 200 + `bank_account` zapisane. Powtórz z błędnym IBAN (`PL00...`) → 400 z komunikatem walidacji.

- [ ] **Step 5: Commit**

```bash
git add app/api/companies/route.ts "app/api/companies/[id]/route.ts"
git commit -m "feat(api): companies przyjmuje bank_account (+desc) z walidacja IBAN (create + update_settings)"
```

---

### Task 6: UI — pole rachunku w tworzeniu i edycji firmy

**Files:**
- Modify: `components/adminNew/CompanyFormModal.tsx` (create)
- Modify: `components/adminNew/CustomerCard.tsx` (edycja inline, wzór jak `handleFeeSubmit`)

**Interfaces:**
- Consumes: API z Task 5 (`bank_account` w POST i `PATCH update_settings`).

- [ ] **Step 1: CompanyFormModal — dodaj pole do schematu, stanu i formularza**

W `components/adminNew/CompanyFormModal.tsx`: do `Schema` dodaj `bank_account: z.string().optional(),` i `bank_account_desc: z.string().optional(),`. Do stanu początkowego `form` dodaj `bank_account: '', bank_account_desc: ''`. Pod sekcją adresu (po polu „Kod pocztowy") dodaj przez helper `field`:

```tsx
          {field('bank_account', 'Nr rachunku na nocie (subkonto)', 'PL.. .... .... ....')}
```

(Walidacja mod-97 wykona się po stronie API — komunikat pojawi się w `serverError`.)

- [ ] **Step 2: CustomerCard — stan + handler zapisu rachunku**

W `components/adminNew/CustomerCard.tsx` obok stanu `feeValue` dodaj:

```ts
  const [bankEdit,   setBankEdit]   = useState(false);
  const [bankValue,  setBankValue]  = useState<string>(company.bank_account ?? '');
  const [bankSaving, setBankSaving] = useState(false);
  const [bankError,  setBankError]  = useState<string | null>(null);
```

Dodaj handler wzorowany na `handleFeeSubmit`:

```ts
  const handleBankSubmit = useCallback(async () => {
    setBankSaving(true);
    setBankError(null);
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_settings', bank_account: bankValue.trim() }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error?.fieldErrors?.bank_account?.[0] ?? d.error ?? `HTTP ${res.status}`); }
      setBankEdit(false);
    } catch (e: any) {
      setBankError(e.message ?? 'Błąd zapisu');
    } finally {
      setBankSaving(false);
    }
  }, [company.id, bankValue]);
```

- [ ] **Step 3: CustomerCard — dodaj sekcję UI rachunku**

Obok sekcji edycji `fee_percent` dodaj analogiczny blok: etykieta „Nr rachunku na nocie", `company.bank_account ?? '—'`, przycisk „Edytuj" → input `bankValue` + „Zapisz" (`handleBankSubmit`, disabled `bankSaving`) + „Anuluj" (`setBankEdit(false); setBankValue(company.bank_account ?? '')`) + `bankError`. (Skopiuj strukturę JSX z bloku fee, podmieniając nazwy stanów/handlera.)

- [ ] **Step 4: Rozszerz typ `company` w CustomerCard**

Jeśli lokalny typ `Company`/props ma listę pól, dodaj `bank_account: string | null`. (Obok `fee_percent: number | null` na ~`:27`.)

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit` → 0 błędów. Następnie `npm run build` → sukces.

- [ ] **Step 6: Manual verify (dev)**

W panelu admina: otwórz kartę klienta → ustaw „Nr rachunku na nocie" → zapisz. Wejdź w Płatności → wygeneruj/pobierz notę tej firmy → na PDF w sekcji „Numer konta" widnieje ustawiony rachunek. Dla firmy bez rachunku → widnieje `ISSUER.bank`.

- [ ] **Step 7: Commit**

```bash
git add components/adminNew/CompanyFormModal.tsx components/adminNew/CustomerCard.tsx
git commit -m "feat(ui): pole 'Nr rachunku na nocie' w tworzeniu i edycji firmy"
```

---

### Task 7: Aktualizacja dokumentacji + finalna weryfikacja

**Files:**
- Modify: `CLAUDE.md` (sekcja Fakturownia/dokumenty — zanotować konto per firma na nocie)

- [ ] **Step 1: Dopisz notkę w CLAUDE.md**

W sekcji o generacji PDF/nocie dodaj zdanie: „Nota drukuje `companies.bank_account` (dedykowane subkonto per firma, migracja 040); brak wartości = fallback `ISSUER.bank`."

- [ ] **Step 2: Pełny test + typecheck**

Run: `npx vitest run` → wszystkie zielone. `npx tsc --noEmit` → 0. `npm run build` → sukces.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: nota drukuje dedykowany rachunek firmy (SP1)"
```

---

## Self-Review

- **Spec coverage:** SP1 z roadmapy = migracja `bank_account`(+desc) [Task 2], nota+QR używają konta firmy [Task 3], wątkowanie do ctx [Task 4], pole w CompanyFormModal + API [Task 5/6], fallback `ISSUER.bank` [Task 3]. Współdzielony walidator IBAN [Task 1] — wyprzedza SP2 (świadomie, wspólny util). Pokryte.
- **Placeholder scan:** brak TBD/„handle errors" — każdy krok ma konkretny kod/komendę.
- **Type consistency:** `sellerBankAccount?: string` zdefiniowane w Task 3, używane w Task 4; `isValidIBAN` z Task 1 używane w Task 5; `bank_account` kolumna z Task 2 czytana w Task 3/4/6.
- **Uwaga wykonawcza:** przy Task 3 test importuje `documentService`, który importuje `supabaseServer` — import nie wywołuje połączenia (funkcje wołane leniwie), więc test pure-function przechodzi bez env DB (wzór jak `lib/fakturownia/*.test.ts`).

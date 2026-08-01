# E5 — Rozszerzenia z BBS: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Przenieść do EBS wszystkie nowe opcje, które przybyły w BBS-Unified między 2026-07-16 a 2026-07-29 (bloki C, D, E, F, G, H), z adaptacjami wymuszonymi przez różnice domenowe EBS.

**Architecture:** Jedna migracja SQL (trzy kolumny na `hr_employees`) plus port kodu w sześciu etapach. Trzy nowe moduły współdzielone (`lib/hr/workStatus.ts`, `lib/hr/alerts.ts`, `lib/useHistoryView.ts`) są czystymi funkcjami/hookami pokrytymi testami. Reszta to rozszerzenia istniejących route'ów API i komponentów `components/agencja/*`. Usuwanie kont jest **przeprojektowane** względem BBS, bo EBS ma niezmienną księgę voucherów pod `ON DELETE RESTRICT`.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Supabase (service_role), vitest, Tailwind, lucide-react, `lib/pdf/renderer.ts` (puppeteer-core + @sparticuz).

**Spec:** `docs/superpowers/specs/2026-07-29-e5-rozszerzenia-bbs-design.md`

**Źródło portu:** `C:\Users\Użytkownik\Desktop\BBS-Unified` — **READ-ONLY**. Nigdy nie zapisuj do tego repo.

## Global Constraints

Obowiązują w KAŻDYM tasku — to reguły wypracowane w falach E1–E4:

- **Nigdy `git add -A`.** Zawsze konkretne ścieżki (na pulpicie usera leżą pliki z sekretami).
- **Commity po polsku**, format `typ(zakres): opis`. Stopka `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Reguły portu BBS→EBS** (stosuj przy każdym kopiowanym pliku):
  - `admin` z `@/lib/crm/visibility` → `@/lib/supabaseAdmin` (CRM wykluczony z EBS).
  - Usuń `logEvent` / importy `@/lib/audit` — EBS robi audyt triggerami `fn_audit_log`. **Wyjątek: Task 14** (purge) wymaga jawnego wpisu do `audit_log`.
  - Tabele `hr_*` / `acc_*` nie są w `types/database.ts` → używaj `(admin() as any).from('hr_...')`.
  - UI: BBS `components/adminNew/hr/X` → EBS `components/agencja/X`.
  - `font-display` → `font-sans`.
- **W `route.ts` NIE eksportuj niczego poza handlerami** (`GET`/`POST`/`PATCH`/`DELETE`). Stałe pomocnicze deklaruj jako `const` bez `export` albo wynieś do `lib/`. Naruszenie psuje `.next/types` — ta klasa błędu ugryzła nas w E2b.
- **Brak sesji w `app/api/hr/*` → 403, nie 401** (wzorzec przeniesiony z BBS).
- **AI-guard:** brak `ANTHROPIC_API_KEY` → route zwraca **200** `{ok:false, disabled:true, error}`, nigdy 500. UI pokazuje „funkcja wyłączona".
- **Po każdym tasku dotykającym `app/api/**` uruchom `npx next build`**, nie tylko `npx tsc --noEmit` — build łapie błędy typów route'ów, których tsc nie widzi (`next.config.ts` ma `ignoreBuildErrors: true`).
- **Testy:** `npm test` (= `vitest run`). Pliki testów obok modułu: `lib/hr/foo.test.ts`.
- **`work_status` ≠ `status`.** `status` (active/inactive) steruje rozliczeniami, payrollem i filtrem alertów. `work_status` jest wyłącznie prezentacyjna. Nigdy nie podmieniaj jednego drugim.
- **Dane osobowe:** repo i pliki planów nie mogą zawierać PESEL, IBAN, nazwisk pracowników ani haseł. Testy używają danych syntetycznych.

---

## File Structure

**Nowe pliki:**

| Plik | Odpowiedzialność |
|---|---|
| `supabase/migrations/052_hr_status_tlc.sql` | Trzy kolumny + backfill |
| `lib/hr/workStatus.ts` | Definicje statusów pracy (id, etykieta, klasy koloru) |
| `lib/hr/workStatus.test.ts` | Testy fallbacku |
| `lib/hr/alerts.ts` | Budowa i filtrowanie alarmów — wspólne dla ekranu i PDF |
| `lib/hr/alerts.test.ts` | Testy progów, grupowania, filtrów |
| `lib/hr/nameMatch.ts` | Normalizacja i porównywanie imion/nazwisk (dedup) |
| `lib/hr/nameMatch.test.ts` | Testy dedupu |
| `lib/useHistoryView.ts` | Hook historii ekranów SPA |
| `app/api/hr/alerts/pdf/route.ts` | Raport PDF alarmów z parametrami |
| `app/api/users/[id]/purge/route.ts` | Podsumowanie + purge/anonimizacja konta |
| `scripts/seed-e5-doc-templates.mts` | Seed dwóch nowych dokumentów (4 wersje językowe każdy) |

**Modyfikowane (kluczowe):**

| Plik | Zmiana |
|---|---|
| `app/api/hr/employees/[id]/route.ts` | `FIELDS` += `work_status`, `tlc`, `tlc_expiry` |
| `app/api/hr/employees/[id]/archive/route.ts` | archiwizacja → `zwolniony`, restore → `pracuje` + wybór kontraktu |
| `app/api/hr/employees/route.ts` | dedup po nazwisku gdy brak paszportu |
| `app/api/hr/contracts/route.ts` | `status_counts` per kontrakt |
| `app/api/hr/accommodations/route.ts` | `status_counts` per lokal |
| `app/api/hr/candidates/import-drive/route.ts` | wpięcie OCR + dedup (naprawa) |
| `app/api/hr/doc-generate/route.ts` | `address` z kontraktu + `pesel_sign_city` |
| `app/api/hr/employees/[id]/documents/route.ts` + `[docId]/route.ts` | gate `agencja.dokumenty-usun` |
| `lib/hr/ocr.ts` | prompt: MRZ, kolejność pól |
| `lib/hr/peselForm.ts` | parametr `signCity` |
| `lib/hr/docPlaceholders.ts` | 3 nowe znaczniki + `displayName` |
| `lib/permissions/registry.ts` | klucz `agencja.dokumenty-usun` |
| `components/agencja/*` | HrEmployeePanel, HrKontrakty, HrBazaNoclegowa, HrArchiwum, HrPoczekalnia, HrPermitAlerts, HrGeneratorDokumentow |
| `components/adminNew/AdminUsers.tsx` | przycisk + modal usuwania konta (owner) |
| `app/dashboard/_components/*DashboardClient.tsx` (4 pliki) | `useHistoryView` |
| `app/api/cron/expire-vouchers/route.ts` | TLC w digeście |

---

## Task 1: Migracja 052 + moduł statusów

**Files:**
- Create: `supabase/migrations/052_hr_status_tlc.sql`
- Create: `lib/hr/workStatus.ts`
- Test: `lib/hr/workStatus.test.ts`

**Interfaces:**
- Consumes: nic (pierwszy task)
- Produces:
  - `WORK_STATUSES: ReadonlyArray<{id: WorkStatusId; label: string; badge: string; dot: string}>`
  - `type WorkStatusId = 'pracuje' | 'oczekuje' | 'urlop' | 'zwolniony'`
  - `WORK_STATUS_IDS: readonly WorkStatusId[]`
  - `DEFAULT_WORK_STATUS: 'pracuje'`
  - `workStatusDef(id: string | null | undefined): {id, label, badge, dot}` — fallback do pierwszego
  - `isWorkStatusId(v: unknown): v is WorkStatusId`

- [ ] **Step 1: Napisz test**

`lib/hr/workStatus.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { workStatusDef, isWorkStatusId, WORK_STATUSES, DEFAULT_WORK_STATUS } from './workStatus';

describe('workStatus', () => {
  it('zwraca definicję dla znanego statusu', () => {
    expect(workStatusDef('urlop').label).toBe('Urlop');
  });

  it('robi fallback do pracuje dla nieznanego statusu', () => {
    expect(workStatusDef('kosmita').id).toBe('pracuje');
  });

  it('robi fallback dla null i undefined', () => {
    expect(workStatusDef(null).id).toBe(DEFAULT_WORK_STATUS);
    expect(workStatusDef(undefined).id).toBe(DEFAULT_WORK_STATUS);
  });

  it('ma dokładnie 4 statusy z unikalnymi id', () => {
    expect(WORK_STATUSES).toHaveLength(4);
    expect(new Set(WORK_STATUSES.map(s => s.id)).size).toBe(4);
  });

  it('isWorkStatusId waliduje poprawnie', () => {
    expect(isWorkStatusId('zwolniony')).toBe(true);
    expect(isWorkStatusId('cokolwiek')).toBe(false);
  });
});
```

- [ ] **Step 2: Uruchom test — musi paść**

Run: `npx vitest run lib/hr/workStatus.test.ts`
Expected: FAIL — `Cannot find module './workStatus'`

- [ ] **Step 3: Zaimplementuj moduł**

`lib/hr/workStatus.ts`:

```ts
// Status PRACY pracownika — WYŁĄCZNIE prezentacyjny.
// NIE mylić z hr_employees.status (active/inactive), które steruje
// rozliczeniami, payrollem i filtrem alertów. Rozdział jest świadomy.
export type WorkStatusId = 'pracuje' | 'oczekuje' | 'urlop' | 'zwolniony';

export const WORK_STATUSES = [
  { id: 'pracuje',   label: 'Pracuje',   badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  { id: 'oczekuje',  label: 'Oczekuje',  badge: 'bg-amber-100 text-amber-700 border-amber-200',       dot: 'bg-amber-500' },
  { id: 'urlop',     label: 'Urlop',     badge: 'bg-sky-100 text-sky-700 border-sky-200',             dot: 'bg-sky-500' },
  { id: 'zwolniony', label: 'Zwolniony', badge: 'bg-red-100 text-red-700 border-red-200',             dot: 'bg-red-500' },
] as const satisfies ReadonlyArray<{ id: WorkStatusId; label: string; badge: string; dot: string }>;

export const WORK_STATUS_IDS = WORK_STATUSES.map(s => s.id) as readonly WorkStatusId[];
export const DEFAULT_WORK_STATUS: WorkStatusId = 'pracuje';

export function isWorkStatusId(v: unknown): v is WorkStatusId {
  return typeof v === 'string' && (WORK_STATUS_IDS as readonly string[]).includes(v);
}

export function workStatusDef(id: string | null | undefined) {
  return WORK_STATUSES.find(s => s.id === id) ?? WORK_STATUSES[0];
}
```

- [ ] **Step 4: Uruchom test — musi przejść**

Run: `npx vitest run lib/hr/workStatus.test.ts`
Expected: PASS (5 testów)

- [ ] **Step 5: Napisz migrację**

`supabase/migrations/052_hr_status_tlc.sql`:

```sql
-- E5: status pracy + TLC (karta pobytu z innego kraju)
-- work_status jest ŚWIADOMIE ODDZIELNY od hr_employees.status (active/inactive).
-- status  -> steruje rozliczeniami, payrollem, filtrem alertów
-- work_status -> wyłącznie prezentacja (kropki, liczniki, plakietki)

ALTER TABLE public.hr_employees
  ADD COLUMN IF NOT EXISTS work_status text NOT NULL DEFAULT 'pracuje',
  ADD COLUMN IF NOT EXISTS tlc boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tlc_expiry date;

COMMENT ON COLUMN public.hr_employees.work_status IS
  'pracuje | oczekuje | urlop | zwolniony. Prezentacyjny. NIE mylic ze status (active/inactive).';
COMMENT ON COLUMN public.hr_employees.tlc IS
  'Karta pobytu wydana przez inny kraj UE.';

-- Backfill: tylko rekordy, ktore nadal maja wartosc domyslna po dodaniu kolumny.
-- Idempotentny - powtorne uruchomienie nie nadpisze recznych zmian operatora,
-- bo po pierwszym przebiegu archiwalni maja juz 'zwolniony'.
UPDATE public.hr_employees
   SET work_status = 'zwolniony'
 WHERE archived = true AND work_status = 'pracuje';

UPDATE public.hr_employees
   SET work_status = 'oczekuje'
 WHERE archived = false AND status <> 'active' AND work_status = 'pracuje';

CREATE INDEX IF NOT EXISTS idx_hr_employees_work_status
  ON public.hr_employees (work_status) WHERE archived = false;
```

- [ ] **Step 6: Zastosuj migrację do produkcyjnej bazy**

Użyj MCP `mcp__supabase__apply_migration` na projekcie `ramedybmybcpqvelsmxd`, nazwa `052_hr_status_tlc`.

Następnie zweryfikuj `mcp__supabase__execute_sql`:

```sql
SELECT work_status, count(*) FROM public.hr_employees GROUP BY work_status ORDER BY 2 DESC;
SELECT column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name='hr_employees'
   AND column_name IN ('work_status','tlc','tlc_expiry');
```

Expected: trzy kolumny obecne; rozkład statusów odzwierciedla dane EBS (liczby będą inne niż w BBS — to normalne).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/052_hr_status_tlc.sql lib/hr/workStatus.ts lib/hr/workStatus.test.ts
git commit -m "feat(hr): migracja 052 - work_status + TLC, modul statusow pracy"
```

---

## Task 2: Status pracownika w kartotece i archiwizacji

**Files:**
- Modify: `app/api/hr/employees/[id]/route.ts` (tablica `FIELDS`)
- Modify: `app/api/hr/employees/[id]/archive/route.ts`
- Modify: `components/agencja/HrEmployeePanel.tsx`

**Interfaces:**
- Consumes: `workStatusDef`, `WORK_STATUSES`, `isWorkStatusId`, `DEFAULT_WORK_STATUS` z Task 1
- Produces: `PATCH /api/hr/employees/[id]` przyjmuje `{work_status}`; archiwizacja ustawia `zwolniony`, restore `pracuje`

**Źródło BBS:** commit `f5c7f39`

- [ ] **Step 1: Rozszerz FIELDS w PATCH**

W `app/api/hr/employees/[id]/route.ts` znajdź tablicę `FIELDS` i dopisz `'work_status'`. Waliduj wartość przed zapisem — jeśli przyszła wartość spoza słownika, odrzuć ją (nie zapisuj śmiecia do bazy):

```ts
import { isWorkStatusId } from '@/lib/hr/workStatus';
// ...
if ('work_status' in body && !isWorkStatusId(body.work_status)) {
  return NextResponse.json({ error: 'Nieznany status pracy' }, { status: 400 });
}
```

- [ ] **Step 2: Ustaw status przy archiwizacji i przywracaniu**

W `app/api/hr/employees/[id]/archive/route.ts`: przy archiwizacji dopisz do update `work_status: 'zwolniony'`, przy restore `work_status: 'pracuje'`.

- [ ] **Step 3: Dropdown w kartotece**

W `components/agencja/HrEmployeePanel.tsx` dodaj pod nazwiskiem klikalną plakietkę statusu. Klik otwiera listę czterech opcji; wybór wysyła od razu `PATCH /api/hr/employees/{id}` z `{work_status}` i aktualizuje stan lokalny — **bez trybu edycji** (zapis natychmiastowy, jak w BBS). Kolory bierz z `workStatusDef(emp.work_status).badge`.

- [ ] **Step 4: Weryfikacja**

Run: `npx tsc --noEmit` → 0 błędów
Run: `npx next build` → sukces (dotykamy `app/api/**`)

- [ ] **Step 5: Commit**

```bash
git add app/api/hr/employees/[id]/route.ts app/api/hr/employees/[id]/archive/route.ts components/agencja/HrEmployeePanel.tsx
git commit -m "feat(hr): status pracy w kartotece + automat przy archiwizacji"
```

---

## Task 3: Liczniki statusów per kontrakt i per lokal

**Files:**
- Modify: `app/api/hr/contracts/route.ts`
- Modify: `app/api/hr/accommodations/route.ts`
- Modify: `components/agencja/HrKontrakty.tsx`
- Modify: `components/agencja/HrBazaNoclegowa.tsx`

**Interfaces:**
- Consumes: `workStatusDef`, `WORK_STATUS_IDS` (Task 1)
- Produces: `GET /api/hr/contracts` i `GET /api/hr/accommodations` zwracają na każdym elemencie
  `status_counts: Record<WorkStatusId, number>`

**Źródło BBS:** commity `416ff7e` (kontrakty), `9fe1685` (lokale)

- [ ] **Step 1: Policz statusy w route kontraktów**

W `app/api/hr/contracts/route.ts` po pobraniu kontraktów dociągnij jednym zapytaniem statusy i zgrupuj w pamięci:

```ts
const { data: rows } = await (admin() as any)
  .from('hr_employees')
  .select('contract_id, work_status')
  .eq('archived', false);

const counts = new Map<string, Record<string, number>>();
for (const r of rows ?? []) {
  if (!r.contract_id) continue;
  const bucket = counts.get(r.contract_id) ?? {};
  const key = r.work_status || 'pracuje';
  bucket[key] = (bucket[key] ?? 0) + 1;
  counts.set(r.contract_id, bucket);
}
// dopnij do kazdego kontraktu: status_counts: counts.get(c.id) ?? {}
```

**`status_counts` jest liczone w locie — NIE dodawaj kolumny do bazy.**

- [ ] **Step 2: To samo dla lokali**

W `app/api/hr/accommodations/route.ts` analogicznie, ale grupuj po `accommodation_id`.

- [ ] **Step 3: Plakietki i kropki w UI**

- `HrKontrakty.tsx`: w nagłówku kontraktu plakietki z licznikami (pomiń statusy z zerem); przy nazwisku na liście kropka `workStatusDef(e.work_status).dot`.
- `HrBazaNoclegowa.tsx`: plakietki z licznikami na karcie lokalu.

- [ ] **Step 4: Weryfikacja**

Run: `npx next build` → sukces

- [ ] **Step 5: Commit**

```bash
git add app/api/hr/contracts/route.ts app/api/hr/accommodations/route.ts components/agencja/HrKontrakty.tsx components/agencja/HrBazaNoclegowa.tsx
git commit -m "feat(hr): rozbicie statusow pracownikow per kontrakt i per lokal"
```

---

## Task 4: Zakwaterowani per lokal + przywracanie do kontraktu + dwa imiona

**Files:**
- Modify: `app/api/hr/employees/[id]/archive/route.ts`
- Modify: `app/api/hr/employees/route.ts`
- Modify: `components/agencja/HrArchiwum.tsx`
- Modify: `components/agencja/HrBazaNoclegowa.tsx`
- Modify: `components/agencja/HrKontrakty.tsx`, `HrPoczekalnia.tsx`, `HrEmployeePanel.tsx`
- Modify: `lib/hr/docPlaceholders.ts`

**Interfaces:**
- Produces: `displayName(emp): string` eksportowane z `lib/hr/docPlaceholders.ts` — skleja
  `first_name`, `second_name`, `last_name`, `second_last_name`, pomijając puste

**Źródło BBS:** commity `21feed9` (zakwaterowani), `84a7551` (dwa imiona)

- [ ] **Step 1: displayName**

W `lib/hr/docPlaceholders.ts` dodaj i wyeksportuj:

```ts
export function displayName(e: {
  first_name?: string | null; second_name?: string | null;
  last_name?: string | null; second_last_name?: string | null;
}): string {
  return [e.first_name, e.second_name, e.last_name, e.second_last_name]
    .map(v => (v ?? '').trim())
    .filter(Boolean)
    .join(' ');
}
```

Podmień ręczne sklejanie imienia i nazwiska na `displayName(...)` w `HrEmployeePanel`, `HrKontrakty`, `HrPoczekalnia`.

- [ ] **Step 2: Przywracanie do wybranego kontraktu**

`POST /api/hr/employees/[id]/archive` przy restore przyjmuje opcjonalne `{contract_id}` — jeśli podane, ustawia je na pracowniku. `HrArchiwum` pokazuje przy przycisku przywracania wybór kontraktu z listy.

- [ ] **Step 3: Przenoszenie między lokalami**

W `HrBazaNoclegowa` dodaj akcję przeniesienia zakwaterowanego do innego lokalu (`PATCH /api/hr/employees/[id]` z `{accommodation_id}`).

- [ ] **Step 4: Weryfikacja**

Run: `npx next build` → sukces
Run: `npm test` → wszystkie testy przechodzą (`docPlaceholders.test.ts` nadal zielony)

- [ ] **Step 5: Commit**

```bash
git add lib/hr/docPlaceholders.ts app/api/hr/employees/[id]/archive/route.ts app/api/hr/employees/route.ts components/agencja/HrArchiwum.tsx components/agencja/HrBazaNoclegowa.tsx components/agencja/HrKontrakty.tsx components/agencja/HrPoczekalnia.tsx components/agencja/HrEmployeePanel.tsx
git commit -m "feat(hr): zakwaterowani per lokal, przywracanie do kontraktu, dwa imiona i nazwiska"
```

---

## Task 5: Moduł alarmów (czysty helper, TDD)

**Files:**
- Create: `lib/hr/alerts.ts`
- Test: `lib/hr/alerts.test.ts`

**Interfaces:**
- Produces:
  - `type AlertKind = 'expiry' | 'zus' | 'pesel' | 'lease' | 'medical' | 'fleet'`
  - `type AlertItem = {id: string; kind: AlertKind; label: string; person: string; contract: string | null; date: string | null; days: number | null; employeeId: string | null}`
  - `buildAlerts(employees: any[], accommodations: any[], vehicles?: any[], today?: Date): AlertItem[]`
    — czwarty parametr `today` (domyślnie `new Date()`) jest **dodatkiem wobec BBS**, konieczny
    dla determinizmu testów
  - `groupOf(item: AlertItem): string` — `expired` | `soon` | `warn` | rodzaj
  - `ALERT_GROUPS: ReadonlyArray<{id: string; label: string}>`
  - `filterAlerts(items: AlertItem[], p: {kinds?: string[]; contract?: string; search?: string; maxDays?: number}): AlertItem[]`
  - `daysUntil(date: string | null | undefined, today?: Date): number | null`

**Źródło BBS:** commity `29119b4`, `69cc0fd` — plik `lib/hr/alerts.ts`

**Progi (skopiuj dokładnie):** dokumenty ≤60 dni; Schengen ≤30; badania lekarskie ≤60; flota ≤30; najem ≤3.

- [ ] **Step 1: Napisz testy**

`lib/hr/alerts.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildAlerts, filterAlerts, groupOf, daysUntil } from './alerts';

const TODAY = new Date('2026-08-01T00:00:00Z');
const inDays = (n: number) => new Date(Date.UTC(2026, 7, 1 + n)).toISOString().slice(0, 10);

const emp = (over: Record<string, unknown> = {}) => ({
  id: 'e1', first_name: 'Jan', last_name: 'Testowy', status: 'active',
  contract: { name: 'Kontrakt A' }, pesel: '00000000000',
  zus_registration_date: '2026-01-01', ...over,
});

describe('daysUntil', () => {
  it('liczy dni do daty', () => expect(daysUntil(inDays(10), TODAY)).toBe(10));
  it('zwraca ujemne dla przeszlosci', () => expect(daysUntil(inDays(-5), TODAY)).toBe(-5));
  it('zwraca null dla braku daty', () => { expect(daysUntil(null, TODAY)).toBeNull(); });
});

describe('buildAlerts', () => {
  it('zglasza paszport wygasajacy w progu 60 dni', () => {
    const out = buildAlerts([emp({ passport_expiry: inDays(30) })], [], [], TODAY);
    expect(out.some(a => a.kind === 'expiry')).toBe(true);
  });

  it('NIE zglasza paszportu poza progiem 60 dni', () => {
    const out = buildAlerts([emp({ passport_expiry: inDays(90) })], [], [], TODAY);
    expect(out.some(a => a.kind === 'expiry')).toBe(false);
  });

  it('zglasza TLC tak samo jak inne dokumenty', () => {
    const out = buildAlerts([emp({ tlc: true, tlc_expiry: inDays(20) })], [], [], TODAY);
    expect(out.some(a => a.kind === 'expiry' && /TLC/i.test(a.label))).toBe(true);
  });

  it('zglasza badania lekarskie w progu 60 dni', () => {
    const out = buildAlerts([emp({ medical_exam_expiry: inDays(15) })], [], [], TODAY);
    expect(out.some(a => a.kind === 'medical')).toBe(true);
  });

  it('zglasza brak numeru PESEL', () => {
    const out = buildAlerts([emp({ pesel: null })], [], [], TODAY);
    expect(out.some(a => a.kind === 'pesel')).toBe(true);
  });

  it('pomija pracownikow nieaktywnych', () => {
    const out = buildAlerts([emp({ status: 'inactive', passport_expiry: inDays(5) })], [], [], TODAY);
    expect(out).toHaveLength(0);
  });

  it('zglasza flote w progu 30 dni i pomija wycofane pojazdy', () => {
    const v = { id: 'v1', registration: 'GD123', status: 'aktywny', insurance_until: inDays(10) };
    expect(buildAlerts([], [], [v], TODAY).some(a => a.kind === 'fleet')).toBe(true);
    expect(buildAlerts([], [], [{ ...v, status: 'wycofany' }], TODAY)).toHaveLength(0);
  });

  it('zglasza koniec najmu w progu 3 dni', () => {
    const acc = { id: 'a1', name: 'Lokal 1', lease_end_date: inDays(2) };
    expect(buildAlerts([], [acc], [], TODAY).some(a => a.kind === 'lease')).toBe(true);
  });
});

describe('groupOf', () => {
  it('kwalifikuje przeterminowane jako expired', () => {
    const [a] = buildAlerts([emp({ passport_expiry: inDays(-1) })], [], [], TODAY);
    expect(groupOf(a)).toBe('expired');
  });
  it('kwalifikuje 31-60 dni jako warn', () => {
    const [a] = buildAlerts([emp({ passport_expiry: inDays(45) })], [], [], TODAY);
    expect(groupOf(a)).toBe('warn');
  });
});

describe('filterAlerts', () => {
  const items = buildAlerts(
    [emp({ passport_expiry: inDays(10) }), emp({ id: 'e2', last_name: 'Inny', pesel: null })],
    [], [], TODAY,
  );

  it('filtruje po rodzaju', () => {
    expect(filterAlerts(items, { kinds: ['pesel'] }).every(a => a.kind === 'pesel')).toBe(true);
  });
  it('filtruje po frazie w nazwisku', () => {
    expect(filterAlerts(items, { search: 'inny' }).length).toBeGreaterThan(0);
  });
  it('filtruje po maxDays', () => {
    expect(filterAlerts(items, { maxDays: 5 }).every(a => a.days === null || a.days <= 5)).toBe(true);
  });
  it('pusty filtr zwraca wszystko', () => {
    expect(filterAlerts(items, {})).toHaveLength(items.length);
  });
});
```

- [ ] **Step 2: Uruchom testy — muszą paść**

Run: `npx vitest run lib/hr/alerts.test.ts`
Expected: FAIL — brak modułu

- [ ] **Step 3: Zaimplementuj `lib/hr/alerts.ts`**

Przenieś logikę z BBS `lib/hr/alerts.ts` (commit `69cc0fd`, wersja po rozszerzeniu o flotę i badania). Adaptacje:
- `buildAlerts` przyjmuje **czwarty, opcjonalny** parametr `today: Date = new Date()` — bez tego testy nie są deterministyczne (BBS liczy od `new Date()` w środku).
- `daysUntil` również przyjmuje `today`.
- Zero importów z `@/lib/crm/*` i `@/lib/audit`.
- Etykieta TLC: `'TLC — karta pobytu'`.

- [ ] **Step 4: Uruchom testy — muszą przejść**

Run: `npx vitest run lib/hr/alerts.test.ts`
Expected: PASS (wszystkie)

- [ ] **Step 5: Commit**

```bash
git add lib/hr/alerts.ts lib/hr/alerts.test.ts
git commit -m "feat(hr): wspolny modul alarmow (dokumenty, badania, flota, najem, PESEL, ZUS)"
```

---

## Task 6: Ekran alarmów z filtrami + pola TLC

**Files:**
- Modify: `components/agencja/HrPermitAlerts.tsx`
- Modify: `components/agencja/HrEmployeePanel.tsx` (pola TLC)
- Modify: `app/api/hr/employees/[id]/route.ts` (`FIELDS` += `tlc`, `tlc_expiry`)
- Modify: `app/api/cron/expire-vouchers/route.ts` (TLC w digeście)

**Interfaces:**
- Consumes: `buildAlerts`, `filterAlerts`, `groupOf`, `ALERT_GROUPS` (Task 5)

**Źródło BBS:** commity `29119b4`, `69cc0fd` (ekran), `51547e2` (TLC)

- [ ] **Step 1: Pola TLC w kartotece**

`HrEmployeePanel`: checkbox „TLC — karta pobytu z innego kraju" + data ważności (widoczna tylko gdy zaznaczone). Dopisz `'tlc'`, `'tlc_expiry'` do `FIELDS` w PATCH.

- [ ] **Step 2: Przebuduj ekran alarmów**

`HrPermitAlerts.tsx` liczy pozycje przez `buildAlerts(...)` zamiast własnej logiki. Dodaj pasek filtrów: przełączniki grup (`ALERT_GROUPS`), wybór kontraktu, pole szukania, suwak/pole „termin ≤ N dni". Filtrowanie przez `filterAlerts`. Zmień nagłówek sekcji z „Dokumenty wymagające uwagi" na **„Alarmy wymagające uwagi"**.

Pozycje floty **nie** otwierają kartoteki pracownika (pojazdy mają własną zakładkę) — klik na taką pozycję nie robi nic albo prowadzi do zakładki Flota.

- [ ] **Step 3: TLC w digeście crona**

W `app/api/cron/expire-vouchers/route.ts` w sekcji digestu wygasania (izolowany `try/catch`) dodaj TLC do zbieranych terminów — analogicznie do paszportu i karty pobytu.

- [ ] **Step 4: Weryfikacja**

Run: `npx next build` → sukces
Run: `npm test` → zielone

- [ ] **Step 5: Commit**

```bash
git add components/agencja/HrPermitAlerts.tsx components/agencja/HrEmployeePanel.tsx app/api/hr/employees/[id]/route.ts app/api/cron/expire-vouchers/route.ts
git commit -m "feat(hr): filtrowanie alarmow + TLC w kartotece, alertach i digescie"
```

---

## Task 7: Raport PDF alarmów z parametrami

**Files:**
- Create: `app/api/hr/alerts/pdf/route.ts`
- Modify: `components/agencja/HrPermitAlerts.tsx` (przycisk pobierania)

**Interfaces:**
- Consumes: `buildAlerts`, `filterAlerts` (Task 5); `lib/pdf/renderer.ts`; `coordinatorGrantedContractIds` z `lib/hr/coordinatorScope`
- Produces: `POST /api/hr/alerts/pdf` z body `{kinds?: string[]; contract?: string; search?: string; maxDays?: number}` → PDF (`application/pdf`)

**Źródło BBS:** commit `29119b4` — `app/api/hr/alerts/pdf/route.ts`

**KLUCZOWA ADAPTACJA:** BBS renderuje przez `renderOfferPdfBatch` z `@/lib/crm/offer/pdfRenderer`. **Tego modułu w EBS NIE MA** (CRM wykluczony). Użyj `lib/pdf/renderer.ts` — tego samego, którego używa `hr/doc-generate` i `hr/settlements/pdf`. Sprawdź tam sygnaturę i wzoruj się na sposobie wywołania.

- [ ] **Step 1: Napisz route**

Wymagania:
- Autoryzacja: `canAny(AGENCJA_TABS)`; brak sesji → **403**.
- Zakres danych: role „widzą wszystko" → całość; `koordynator` → swoi pracownicy + kontrakty z `coordinatorGrantedContractIds(auth)`.
- Zbuduj HTML tabeli (inline `<style>`, nagłówek z parametrami raportu i datą), przepuść przez renderer.
- **Nie eksportuj z tego pliku nic poza `POST`** (Global Constraints).
- Pusty wynik → PDF z nagłówkiem i informacją „Brak pozycji spełniających kryteria", nie błąd.

- [ ] **Step 2: Przycisk w UI**

W `HrPermitAlerts` przycisk „Pobierz raport PDF" wysyła aktualnie ustawione filtry jako body, odbiera blob i zapisuje jako plik.

- [ ] **Step 3: Weryfikacja**

Run: `npx next build` → sukces
Ręcznie: wywołaj endpoint z filtrami, **otwórz wygenerowany PDF i obejrzyj go** — sprawdź, że nagłówek zawiera użyte parametry i że wiersze zgadzają się z ekranem.

- [ ] **Step 4: Commit**

```bash
git add app/api/hr/alerts/pdf/route.ts components/agencja/HrPermitAlerts.tsx
git commit -m "feat(hr): raport PDF alarmow z parametrami (renderer EBS)"
```

---

## Task 8: Prompt OCR — kolejność pól i data ważności z MRZ

**Files:**
- Modify: `lib/hr/ocr.ts` (tylko prompt w `extractFromDocument`)

**Interfaces:** bez zmian w sygnaturach — modyfikacja treści promptu

**Źródło BBS:** commity `1e33a02` (kolejność pól), `fd1e893` (data ważności)

- [ ] **Step 1: Dopisz sekcję o kolejności pól**

Do promptu dodaj instrukcję, że **strefa MRZ rozstrzyga** podział na nazwiska i imiona:

```
KOLEJNOŚĆ PÓL W PASZPORCIE:
W wielu paszportach (np. kolumbijskich) nazwiska (Apellidos) są DRUKOWANE PRZED
imionami (Nombres). Nie zgaduj z układu graficznego — rozstrzyga strefa MRZ:
P<KRAJNAZWISKO1<NAZWISKO2<<IMIE1<IMIE2
Wszystko PRZED podwójnym '<<' to NAZWISKA, wszystko PO nim to IMIONA.
```

- [ ] **Step 2: Dopisz sekcję o dacie ważności**

```
DATA WAŻNOŚCI PASZPORTU:
Skan często zawiera dwa dokumenty naraz (np. cédula i paszport). passport_expiry
bierz WYŁĄCZNIE ze strony danych paszportu i zweryfikuj z drugą linią MRZ:
po numerze paszportu, dacie urodzenia i cyfrze kontrolnej występuje płeć (M/F),
a zaraz po niej data ważności w formacie RRMMDD.
Przy rozbieżności między tekstem a MRZ — WYGRYWA MRZ.
```

- [ ] **Step 3: Weryfikacja**

Run: `npx tsc --noEmit` → 0 błędów
Sprawdź, że AI-guard nadal działa: bez `ANTHROPIC_API_KEY` route OCR zwraca 200 z `disabled:true`.

- [ ] **Step 4: Commit**

```bash
git add lib/hr/ocr.ts
git commit -m "fix(ocr): MRZ rozstrzyga kolejnosc imion i nazwisk oraz date waznosci paszportu"
```

---

## Task 9: Naprawa importu z Google Drive

**Files:**
- Modify: `app/api/hr/candidates/import-drive/route.ts`

**Interfaces:**
- Consumes: `resolveOcrType`, `sniffOcrType`, `extractFromDocument`, `aggregateResults`, `mergeIntoEmployee` — **wszystkie już istnieją** w `lib/hr/ocr.ts`

**Źródło BBS:** commit `d64c657` (octet-stream + dedup), `1e33a02` (OCR wygrywa z nazwą folderu)

**UWAGA — to nie jest cherry-pick.** Obecny route w EBS w ogóle nie woła OCR do scalania: buduje dane wyłącznie z nazwy folderu. Trzeba doprowadzić go do stanu funkcjonalnego BBS **i** nałożyć poprawki.

- [ ] **Step 1: Ustal typ pliku odpornie**

Zamiast surowego `contentType` ze Storage:

```ts
const type = resolveOcrType(contentType, fileName) ?? sniffOcrType(buf);
if (!type) continue; // nie da sie OCR-ować
```

Powód: Google Drive zwraca część plików jako `application/octet-stream` — dotąd paszporty w takich plikach **nigdy** nie trafiały do OCR.

- [ ] **Step 2: Wepnij OCR do budowy rekordu**

Dla każdego pliku wywołaj `extractFromDocument(buf, type)`, zbierz wyniki, złóż `aggregateResults(results)`, a potem `mergeIntoEmployee(employee, agg)`.

**Reguła nadpisywania:** dane z OCR **zawsze** wygrywają z placeholderami (`'—'`, `'(import: …)'`). Nazwa folderu Drive służy **wyłącznie** jako fallback, gdy OCR nic nie zwrócił. Bez tego nazwiska z folderu „NAZWISKA IMIONA" lądują w kolumnach imion.

- [ ] **Step 3: Deduplikacja po numerze paszportu**

Po OCR znormalizuj numer paszportu i porównaj z `hr_employees.passport_number`. Trafienie → skasuj świeżo utworzony szkielet rekordu i zwróć dla tej pozycji `{status: 'skipped', reason: 'osoba już istnieje'}`.

- [ ] **Step 4: Zachowaj AI-guard**

Brak `ANTHROPIC_API_KEY` → import nadal działa (pliki się wgrywają), ale bez OCR: zwróć `{ok:true, disabled:true}` i użyj fallbacku z nazwy folderu. **Zero 500.**

- [ ] **Step 5: Weryfikacja**

Run: `npx next build` → sukces
Ręcznie (jeśli klucze AI są ustawione): import folderu z paszportem zapisanym jako `application/octet-stream` — sprawdź, że numer paszportu trafił do kartoteki, a imię i nazwisko nie są odwrócone.

- [ ] **Step 6: Commit**

```bash
git add app/api/hr/candidates/import-drive/route.ts
git commit -m "fix(hr): import Drive czyta octet-stream, OCR nadpisuje nazwe folderu, dedup po paszporcie"
```

---

## Task 10: Deduplikacja po imionach i nazwiskach

**Files:**
- Create: `lib/hr/nameMatch.ts`
- Test: `lib/hr/nameMatch.test.ts`
- Modify: `app/api/hr/employees/route.ts` (POST)

**Interfaces:**
- Produces:
  - `normTok(s: string | null | undefined): string` — lower, bez diakrytyków, końcowe `s`/`z` zrównane
  - `nameKey(e: {first_name?, second_name?, last_name?, second_last_name?}): string` — posortowane tokeny złączone `|`

**Źródło BBS:** commit `d64c657`

- [ ] **Step 1: Napisz testy**

`lib/hr/nameMatch.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normTok, nameKey } from './nameMatch';

describe('normTok', () => {
  it('usuwa diakrytyki i zmienia na male litery', () => {
    expect(normTok('Łukasz')).toBe(normTok('lukasz'));
  });
  it('zrownuje koncowe s i z', () => {
    expect(normTok('VILCHES')).toBe(normTok('VILCHEZ'));
  });
  it('radzi sobie z pustymi wartosciami', () => {
    expect(normTok(null)).toBe('');
    expect(normTok(undefined)).toBe('');
  });
});

describe('nameKey', () => {
  it('jest niezalezny od kolejnosci imion i nazwisk', () => {
    const a = nameKey({ first_name: 'Juan', last_name: 'Vilches' });
    const b = nameKey({ first_name: 'Vilchez', last_name: 'Juan' });
    expect(a).toBe(b);
  });
  it('rozroznia rozne osoby', () => {
    expect(nameKey({ first_name: 'Anna', last_name: 'Kowalska' }))
      .not.toBe(nameKey({ first_name: 'Anna', last_name: 'Nowak' }));
  });
  it('ignoruje puste czlony', () => {
    expect(nameKey({ first_name: 'Ana', second_name: '', last_name: 'Ruiz' }))
      .toBe(nameKey({ first_name: 'Ana', last_name: 'Ruiz' }));
  });
});
```

- [ ] **Step 2: Uruchom testy — muszą paść**

Run: `npx vitest run lib/hr/nameMatch.test.ts`
Expected: FAIL — brak modułu

- [ ] **Step 3: Zaimplementuj moduł**

```ts
export function normTok(s: string | null | undefined): string {
  const base = (s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z]/g, '');
  return base.replace(/[sz]$/, '#'); // VILCHES / VILCHEZ traktujemy jak jedno
}

export function nameKey(e: {
  first_name?: string | null; second_name?: string | null;
  last_name?: string | null; second_last_name?: string | null;
}): string {
  return [e.first_name, e.second_name, e.last_name, e.second_last_name]
    .map(normTok).filter(Boolean).sort().join('|');
}
```

- [ ] **Step 4: Uruchom testy — muszą przejść**

Run: `npx vitest run lib/hr/nameMatch.test.ts`
Expected: PASS

- [ ] **Step 5: Wepnij do POST pracownika**

W `app/api/hr/employees/route.ts`: gdy tworzony pracownik **nie ma numeru paszportu**, porównaj `nameKey(nowy)` z kluczami istniejących nieusuniętych rekordów. Trafienie → **409** z danymi istniejącego pracownika (id i imię/nazwisko), żeby UI mogło pokazać podpowiedź.

- [ ] **Step 6: Weryfikacja**

Run: `npx next build` → sukces
Run: `npm test` → zielone

- [ ] **Step 7: Commit**

```bash
git add lib/hr/nameMatch.ts lib/hr/nameMatch.test.ts app/api/hr/employees/route.ts
git commit -m "feat(hr): dedup po imionach i nazwiskach gdy brak numeru paszportu"
```

---

## Task 11: Ręczna miejscowość we wniosku PESEL

**Files:**
- Modify: `lib/hr/peselForm.ts`
- Modify: `app/api/hr/doc-generate/route.ts`
- Modify: `components/agencja/HrGeneratorDokumentow.tsx`

**Interfaces:**
- Produces: `fillPeselForm(..., opts: {signCity?: string})` — miejscowość w pkt 8 wniosku

**Źródło BBS:** commit `fd1e893`

- [ ] **Step 1: Parametr w generatorze formularza**

`fillPeselForm` przyjmuje `signCity`; gdy podane — wpisuje je w pkt 8 zamiast dotychczasowego źródła.

- [ ] **Step 2: Przekazanie przez API**

`doc-generate` czyta z body `pesel_sign_city` i podaje dalej.

- [ ] **Step 3: Pole w UI**

W `HrGeneratorDokumentow` pole tekstowe „Miejscowość (pkt 8)", widoczne przy wyborze wniosku PESEL.

- [ ] **Step 4: Weryfikacja**

Run: `npx next build` → sukces
Ręcznie: wygeneruj wniosek PESEL z wpisaną miejscowością, **otwórz PDF** i sprawdź pkt 8.

- [ ] **Step 5: Commit**

```bash
git add lib/hr/peselForm.ts app/api/hr/doc-generate/route.ts components/agencja/HrGeneratorDokumentow.tsx
git commit -m "feat(hr): reczna miejscowosc w pkt 8 wniosku o PESEL"
```

---

## Task 12: Uprawnienie na usuwanie dokumentów z teczek

**Files:**
- Modify: `lib/permissions/registry.ts`
- Modify: `app/api/hr/employees/[id]/documents/route.ts`
- Modify: `app/api/hr/employees/[id]/documents/[docId]/route.ts`

**Interfaces:**
- Produces: klucz uprawnienia `agencja.dokumenty-usun` w grupie „Agencja Pracy"

**Źródło BBS:** commit `adba9c9`

**To najprostszy port w całej fali** — EBS ma identyczny silnik uprawnień (migracja 045, `lib/permissions/server.ts`). Zero zmian schematu.

- [ ] **Step 1: Dodaj klucz**

W `lib/permissions/registry.ts`, w grupie „Agencja Pracy", dodaj wpis `agencja.dokumenty-usun` z etykietą „Usuwanie dokumentów z teczek". Domyślnie **nie** przyznawaj go koordynatorowi — to ma być wyjątek nadawany per konto.

- [ ] **Step 2: Podmień twardą blokadę na warunkową**

W obu route'ach dokumentów zamień:

```ts
// było
if (auth.role === 'koordynator') return NextResponse.json({ error: '...' }, { status: 403 });
// ma być
if (auth.role === 'koordynator' && !(await can(auth, 'agencja.dokumenty-usun'))) {
  return NextResponse.json({ error: 'Brak uprawnień do usuwania dokumentów' }, { status: 403 });
}
```

Analogicznie pole `can_delete` w odpowiedzi GET ma uwzględniać to uprawnienie.

- [ ] **Step 3: Weryfikacja**

Run: `npx next build` → sukces
Sprawdź w panelu uprawnień (owner), że nowy klucz jest widoczny i da się go nadać pojedynczemu koordynatorowi.

- [ ] **Step 4: Commit**

```bash
git add lib/permissions/registry.ts app/api/hr/employees/[id]/documents/route.ts app/api/hr/employees/[id]/documents/[docId]/route.ts
git commit -m "feat(uprawnienia): per-user wyjatek na usuwanie dokumentow z teczek"
```

---

## Task 13: Historia ekranów SPA — przycisk wstecz

**Files:**
- Create: `lib/useHistoryView.ts`
- Modify: `app/dashboard/_components/AdminDashboardClient.tsx`
- Modify: `app/dashboard/_components/EmployerDashboardClient.tsx`
- Modify: `app/dashboard/_components/EmployeeDashboardClient.tsx`
- Modify: `app/dashboard/_components/NetworkDashboardClient.tsx`

**Interfaces:**
- Produces: `useHistoryView(view: string, setView: (v: string) => void): void`

**Źródło BBS:** commit `344c850` — `lib/useHistoryView.ts`

**Zakres:** wszystkie **4 panele** (decyzja D3; BBS ma tylko 2).

- [ ] **Step 1: Napisz hook**

```ts
'use client';
import { useEffect, useRef } from 'react';

// Historia ekranow SPA: kazda zmiana widoku dokłada wpis do historii przegladarki,
// dzieki czemu "wstecz" cofa do poprzedniego ekranu zamiast wychodzic z aplikacji.
export function useHistoryView(view: string, setView: (v: string) => void) {
  const fromPop = useRef(false);
  const first = useRef(true);
  const setViewRef = useRef(setView);
  setViewRef.current = setView;

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const v = (e.state as any)?.ebsView;
      if (typeof v === 'string') {
        fromPop.current = true;
        setViewRef.current(v);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (fromPop.current) { fromPop.current = false; return; }
    // Spread zachowuje stan routera Next.js - nadpisujemy tylko nasz klucz.
    const next = { ...(window.history.state || {}), ebsView: view };
    if (first.current) {
      first.current = false;
      window.history.replaceState(next, '');
    } else {
      window.history.pushState(next, '');
    }
  }, [view]);
}
```

- [ ] **Step 2: Wepnij w cztery panele**

W każdym z czterech plików, tuż po `useState` trzymającym `currentView`:

```ts
import { useHistoryView } from '@/lib/useHistoryView';
// ...
useHistoryView(currentView, setCurrentView);
```

- [ ] **Step 3: Weryfikacja**

Run: `npx next build` → sukces
Ręcznie w przeglądarce: w panelu admina przejdź przez 3 widoki, naciśnij wstecz dwa razy — powinieneś wrócić po kolei, a nie wylecieć z aplikacji. Sprawdź, że wewnętrzne zakładki `DashboardAdminNew` też się przełączają (synchronizacja przez `VIEW_TO_TAB`).

- [ ] **Step 4: Commit**

```bash
git add lib/useHistoryView.ts app/dashboard/_components/AdminDashboardClient.tsx app/dashboard/_components/EmployerDashboardClient.tsx app/dashboard/_components/EmployeeDashboardClient.tsx app/dashboard/_components/NetworkDashboardClient.tsx
git commit -m "feat(nav): historia ekranow SPA - wstecz cofa do poprzedniego widoku"
```

---

## Task 14: Usuwanie konta — API (purge albo anonimizacja)

**Files:**
- Create: `app/api/users/[id]/purge/route.ts`

**Interfaces:**
- Produces:
  - `GET /api/users/[id]/purge` → `{mode: 'purge' | 'anonymize', footprint: Record<string, number>, owned: string[], detached: string[], profile: {full_name: string, role: string}}`
  - `DELETE /api/users/[id]/purge` z body `{confirm: string}` → `{ok: true, mode}`

**Źródło BBS:** commit `6149221` — ale **PRZEPROJEKTOWANE**, nie port 1:1 (decyzja D1).

**Dlaczego przeprojektowane:** migracja 001 EBS ma `ON DELETE RESTRICT` na `vouchers.current_owner_id`, `voucher_transactions.from_user_id`/`to_user_id`, `commissions.agent_id`, `distribution_batch_items.user_id`, `buyback_agreements.user_id`, `support_tickets.creator_id`, `ticket_messages.sender_id`. `voucher_transactions` ma dodatkowo trigger `enforce_ledger_immutability` blokujący UPDATE i DELETE (obszar regulowany: bony MPV, dyrektywa UE 2016/1065). Port 1:1 wywaliłby się dla każdego pracownika z historią voucherową — po częściowym wykonaniu, bo kod nie jest transakcyjny.

- [ ] **Step 1: GET — podsumowanie i wybór trybu**

Zbierz liczności (`count: 'exact', head: true`) dla: `vouchers` (current_owner_id), `voucher_transactions` (from + to), `commissions`, `distribution_batch_items`, `buyback_agreements`, `financial_documents` (jeśli wiąże usera), `support_tickets`, `ticket_messages`.

```ts
const total = Object.values(footprint).reduce((a, b) => a + b, 0);
const mode = total === 0 ? 'purge' : 'anonymize';
```

Zwróć też listę tabel kasowanych i odpinanych, żeby modal mógł pokazać „co zniknie / co zostaje".

- [ ] **Step 2: Bramki bezpieczeństwa (obowiązują dla GET i DELETE)**

```ts
if (!auth.isOwner) return NextResponse.json({ error: 'Tylko właściciel' }, { status: 403 });
if (id === auth.id) return NextResponse.json({ error: 'Nie możesz usunąć własnego konta' }, { status: 400 });
if (profile.role === 'owner') return NextResponse.json({ error: 'Nie można usunąć konta właściciela' }, { status: 400 });
```

- [ ] **Step 3: DELETE — potwierdzenie tożsamości**

**Wzmocnienie wobec BBS** (BBS ma tylko jeden klik). Body musi zawierać `confirm` równe `full_name` usuwanego konta po przycięciu białych znaków:

```ts
if ((body.confirm ?? '').trim() !== (profile.full_name ?? '').trim()) {
  return NextResponse.json({ error: 'Potwierdzenie nie zgadza się z nazwą konta' }, { status: 400 });
}
```

- [ ] **Step 4: DELETE — tryb PURGE (ślad pusty)**

Kolejność (od najmniej do najbardziej destrukcyjnej, każdy krok idempotentny):
1. Kasuj: `user_permissions` (user_id), `user_app_entitlements` (user_id), `hr_coordinator_contracts` (coordinator_id).
2. Odepnij (`update ... set null`): `hr_employees.coordinator_id`, `hr_employees.created_by`, `hr_employees.user_id`.
3. `auth.admin.deleteUser(id)` — **przed** usunięciem profilu, żeby nie zostawić konta logowania bez profilu. Błąd pasujący do `/not found/i` toleruj.
4. `user_profiles.delete()`.

**Uwaga:** BBS kasuje też `mail_account_users`, `chat_push_subscriptions`, `chat_participants`, `chat_reactions` — **tych tabel w EBS jeszcze nie ma** (przyjdą z E6). Zostaw komentarz `// TODO E6:` przy liście, żeby przy fali E6 rozszerzyć.

- [ ] **Step 5: DELETE — tryb ANONIMIZACJA (ślad niepusty)**

Konto zostaje jako rekord, ale przestaje zawierać dane osobowe:
- `user_profiles`: `full_name` → `'Konto usunięte'`, a `pesel`, `iban`, `address`, `phone`, `temp_password`, `date_of_birth` → `NULL`.
- `auth.admin.updateUserById(id, {email: 'usuniete+<id>@invalid.local', ...})` oraz zablokowanie logowania (ban/wyczyszczenie sesji).
- **Nie dotykaj** `voucher_transactions`, `vouchers`, `buyback_agreements`, `financial_documents` — księga i dokumenty finansowe zostają nietknięte.

- [ ] **Step 6: Audyt**

Przed operacją zapisz wpis do `audit_log`: aktor (owner), tryb, `footprint`, listy kasowanych i odpinanych. To jedyny trwały ślad operacji nieodwracalnej (Global Constraints — tu **wolno** pisać audyt jawnie).

- [ ] **Step 7: Weryfikacja**

Run: `npx next build` → sukces
**Testuj wyłącznie na koncie testowym**, które sam utworzysz na potrzeby testu (np. `test-purge@example.invalid`). **Nigdy na koncie z danymi produkcyjnymi.** Sprawdź oba tryby: konto świeże (→ purge) i konto z ręcznie dopiętym voucherem (→ anonimizacja). Po teście posprzątaj dane testowe.

- [ ] **Step 8: Commit**

```bash
git add app/api/users/[id]/purge/route.ts
git commit -m "feat(owner): usuwanie konta - purge dla czystych, anonimizacja przy historii finansowej"
```

---

## Task 15: Usuwanie konta — UI

**Files:**
- Modify: `components/adminNew/AdminUsers.tsx`

**Interfaces:**
- Consumes: `GET`/`DELETE /api/users/[id]/purge` (Task 14); `is_owner` z `GET /api/me/permissions`

- [ ] **Step 1: Przycisk widoczny tylko dla właściciela**

Pobierz `is_owner` z `/api/me/permissions`. Czerwony przycisk „Usuń trwale" renderuj wyłącznie gdy `is_owner === true`.

- [ ] **Step 2: Modal**

Po kliknięciu wywołaj `GET .../purge` i pokaż:
- tryb, jaki zostanie zastosowany, opisany po ludzku:
  - `purge` → „Konto zostanie usunięte całkowicie."
  - `anonymize` → „Konto ma historię finansową (vouchery, transakcje). Dane osobowe zostaną wymazane, logowanie zablokowane, a dokumenty księgowe pozostaną nienaruszone."
- listę „co zniknie" i „co zostaje",
- **pole tekstowe z wymogiem przepisania pełnej nazwy konta** — przycisk potwierdzenia nieaktywny, dopóki tekst się nie zgadza.

- [ ] **Step 3: Wykonanie i odświeżenie**

`DELETE` z `{confirm}`; po sukcesie zamknij modal, odśwież listę użytkowników, pokaż komunikat z zastosowanym trybem.

- [ ] **Step 4: Weryfikacja**

Run: `npx next build` → sukces
Ręcznie: zaloguj się jako właściciel, sprawdź że przycisk jest widoczny; zaloguj się jako superadmin (`natalia.kvk@stratton-prime.pl`) i sprawdź, że przycisku **nie ma**.

- [ ] **Step 5: Commit**

```bash
git add components/adminNew/AdminUsers.tsx
git commit -m "feat(owner): modal usuwania konta z potwierdzeniem przez przepisanie nazwy"
```

---

## Task 16: Generator — nowe znaczniki i adres z kontraktu

**Files:**
- Modify: `lib/hr/docPlaceholders.ts`
- Modify: `app/api/hr/doc-generate/route.ts`
- Test: `lib/hr/docPlaceholders.test.ts` (istnieje — dopisz przypadki)

**Interfaces:**
- Produces: znaczniki `dzis_plus_miesiac`, `kontrakt_adres`, `miejsce_szkolenia` dostępne w `buildDocData`

**Źródło BBS:** commity `116d3d7`, `e24e649`

- [ ] **Step 1: Dopisz testy**

Do `lib/hr/docPlaceholders.test.ts`:

```ts
it('dzis_plus_miesiac zwraca date przesunieta o miesiac', () => {
  const d = buildDocData({ /* minimalny pracownik */ } as any, { today: new Date('2026-08-01') } as any);
  expect(d.dzis_plus_miesiac).toBe('01.09.2026');
});

it('miejsce_szkolenia bierze adres z kontraktu', () => {
  const d = buildDocData({ contract: { name: 'K', address: 'ul. Testowa 1, Gdansk' } } as any, {} as any);
  expect(d.miejsce_szkolenia).toContain('Testowa');
});

it('miejsce_szkolenia jest puste gdy kontrakt nie ma adresu', () => {
  const d = buildDocData({ contract: { name: 'K' } } as any, {} as any);
  expect(d.miejsce_szkolenia).toBe('');
});
```

Dopasuj wywołania do faktycznej sygnatury `buildDocData` w EBS (sprawdź plik przed pisaniem).

- [ ] **Step 2: Uruchom — muszą paść**

Run: `npx vitest run lib/hr/docPlaceholders.test.ts`

- [ ] **Step 3: Zaimplementuj znaczniki**

- `dzis_plus_miesiac` — dzisiejsza data plus jeden miesiąc, format jak pozostałe daty w tym module.
- `kontrakt_adres` — `contract.address` lub pusty string.
- `miejsce_szkolenia` — `contract.address` (zamiast zaszytego adresu, jak w BBS).

- [ ] **Step 4: Dociągnij adres w API**

W `app/api/hr/doc-generate/route.ts` zmień select kontraktu na `contract:hr_contracts(id, name, address)`. Kolumna `address` **już istnieje** w EBS (migracja 048) — żadnej migracji nie trzeba.

- [ ] **Step 5: Weryfikacja**

Run: `npx vitest run lib/hr/docPlaceholders.test.ts` → PASS
Run: `npx next build` → sukces

- [ ] **Step 6: Commit**

```bash
git add lib/hr/docPlaceholders.ts lib/hr/docPlaceholders.test.ts app/api/hr/doc-generate/route.ts
git commit -m "feat(generator): znaczniki dzis_plus_miesiac, kontrakt_adres, miejsce_szkolenia"
```

---

## Task 17: Nowe szablony dokumentów (z polami do uzupełnienia)

**Files:**
- Create: `scripts/seed-e5-doc-templates.mts`
- Modify: `scripts/import-bbs-doc-templates.mts` (zabezpieczenie)
- Modify: `CLAUDE.md` (nota o pułapce)

**Interfaces:** brak (skrypt jednorazowy)

**Źródło BBS:** commity `e24e649`, `05ec309`, `9d297a7`, `1d35c55`, `c4064cf`, `116d3d7`, `819ae7d`

**DECYZJA D2 — SZABLONY Z POLAMI DO UZUPEŁNIENIA:**
- **NIE wpisuj danych ALCES ani QALITAS** (nazwa, adres, NIP, KRS, REGON, reprezentant).
- **NIE wpisuj danych pełnomocnika** (imię, nazwisko, telefon) — w BBS jest tam konkretna osoba.
- **NIE przenoś faksymile podpisu** (decyzja K1 — podpis osoby reprezentującej obcą spółkę na dokumentach EBS byłby podrobieniem dokumentu; plik i tak jest w BBS poza gitem).
- W miejscach tych danych wstaw czytelne pola do uzupełnienia, np. `{{firma_nazwa}}`, `{{firma_adres}}`, `{{firma_nip}}`, `{{pelnomocnik_dane}}` — user uzupełni je w panelu **Szablony dokumentów**.

- [ ] **Step 1: Napisz skrypt seed**

Wzoruj się na istniejącym `scripts/import-bbs-doc-templates.mts` (ten sam sposób łączenia: `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` z `.env.local`).

Dwa dokumenty, każdy w 4 wersjach dwujęzycznych (PL/EN, PL/ES, PL/RU, PL/HI) — łącznie 8 wierszy w `hr_doc_templates`:
1. „Porozumienie o bezpłatnym szkoleniu wdrożeniowym"
2. „Oświadczenie — kontakt przez pełnomocnika"

Układ i treść merytoryczną przenieś z BBS (skrypty `seed-porozumienie-szkoleniowe.mjs`, `seed-oswiadczenie-pelnomocnik.mjs`), podmieniając dane podmiotu i pełnomocnika na pola `{{...}}`. Logo w nagłówku: `public/ebs-neon-no-bg.png` (jak pozostałe szablony EBS).

Skrypt **upsertuje po `name`** (tabela nie ma unikalnego constraintu — zrób select, potem insert lub update). Nie kasuj niczego innego.

- [ ] **Step 2: Uruchom seed**

Run: `npx tsx scripts/seed-e5-doc-templates.mts`
Zweryfikuj przez MCP: `SELECT name, category, kind FROM hr_doc_templates WHERE name ILIKE '%porozumienie%' OR name ILIKE '%pełnomocnik%';` → 8 wierszy.

- [ ] **Step 3: Zabezpiecz import z BBS**

W `scripts/import-bbs-doc-templates.mts` dodaj filtr wykluczający nazwy tych 8 szablonów (i komentarz dlaczego). **Powód:** ponowne uruchomienie tamtego skryptu zassałoby je z bazy BBS żywcem — z danymi ALCES i z base64 faksymile podpisu.

- [ ] **Step 4: Udokumentuj pułapkę**

W `CLAUDE.md`, w sekcji o generatorze dokumentów, dopisz ostrzeżenie o tej pułapce.

- [ ] **Step 5: Weryfikacja**

W panelu **Szablony dokumentów** otwórz jeden z nowych szablonów — sprawdź, że pola `{{...}}` są widoczne i edytowalne, oraz że **nie ma** w treści danych ALCES ani żadnego podpisu.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-e5-doc-templates.mts scripts/import-bbs-doc-templates.mts CLAUDE.md
git commit -m "feat(generator): porozumienie szkoleniowe i oswiadczenie o pelnomocniku (4 wersje jezykowe, pola do uzupelnienia)"
```

---

## Task 18: Weryfikacja końcowa, dokumentacja, wdrożenie

**Files:**
- Modify: `CLAUDE.md` (sekcja E5)

- [ ] **Step 1: Pełna weryfikacja**

```bash
npx tsc --noEmit
npm test
npx next build
```

Wszystkie trzy muszą przejść. `tsc` — 0 błędów.

- [ ] **Step 2: Uzupełnij CLAUDE.md**

Dopisz sekcję **E5 (2026-07-29)** w konwencji poprzednich fal: co doszło (statusy pracy, alarmy z raportem PDF, poprawki OCR i importu z Drive, TLC, uprawnienie na usuwanie dokumentów, usuwanie/anonimizacja kont, nawigacja wstecz, nowe szablony), gdzie leży kod, oraz **świadome różnice wobec BBS**: brak faksymile podpisu, szablony z polami zamiast danych ALCES, usuwanie kont przeprojektowane na purge-albo-anonimizacja, raport PDF na rendererze EBS. Odnotuj zależność E6 → rozszerzenie purge o tabele czatu i poczty.

- [ ] **Step 3: Merge i wdrożenie**

```bash
git checkout main
git merge --no-ff feat/e5-rozszerzenia-bbs
git push origin main
npx vercel --prod --yes
```

- [ ] **Step 4: Smoke test na produkcji**

Sprawdź na `https://ebs.elitonbenefits.pl`:
- `/login` zwraca 200,
- panel agencji: statusy widoczne, liczniki przy kontraktach i lokalach się zgadzają,
- ekran alarmów: filtry działają, raport PDF się pobiera i **otwiera** (obejrzyj go),
- wstecz w przeglądarce cofa między widokami,
- generator: nowe szablony widoczne na liście,
- panel użytkowników: przycisk usuwania widoczny tylko dla właściciela.

- [ ] **Step 5: Commit dokumentacji**

```bash
git add CLAUDE.md
git commit -m "docs(e5): podsumowanie fali E5 + swiadome roznice wobec BBS"
git push origin main
```

---

## Kolejność i zależności

```
Task 1 (migracja + workStatus)  ← blokuje 2, 3, 4, 6
  ├─ Task 2 (kartoteka + archiwizacja)
  ├─ Task 3 (liczniki per kontrakt/lokal)
  └─ Task 4 (zakwaterowani + displayName)

Task 5 (alerts.ts, TDD)  ← blokuje 6, 7
  ├─ Task 6 (ekran alarmów + TLC)   ← wymaga też Task 1 (kolumny TLC)
  └─ Task 7 (raport PDF)

Task 8 (prompt OCR)  ← niezależny
Task 9 (import Drive)  ← korzysta z Task 8, ale może iść równolegle
Task 10 (dedup nazwisk)  ← niezależny
Task 11 (PESEL signCity)  ← niezależny
Task 12 (uprawnienie dokumentów)  ← niezależny
Task 13 (nawigacja wstecz)  ← niezależny

Task 14 (purge API)  ← blokuje 15
  └─ Task 15 (purge UI)

Task 16 (znaczniki generatora)  ← blokuje 17
  └─ Task 17 (szablony)

Task 18 (weryfikacja + deploy)  ← wymaga wszystkich
```

Zadania niezależne (8, 10, 11, 12, 13) można rozdzielić równolegle po zamknięciu Task 1.

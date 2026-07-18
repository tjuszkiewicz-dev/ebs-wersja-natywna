# E2b: Agencja — Core HR (API + UI, port z BBS-Unified) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Działający moduł Agencji Pracy w panelu admina EBS: 11 pod-zakładek HrDashboard (Pulpit, Poczekalnia, Kontrakty, Dokumenty, Raporty, Rozliczenia, Noclegi, Dowóz, BHP, Legalizacja, Archiwum) + widok Flota, z pełnym API na 18 tabelach `hr_*` (schemat z E2a) i dynamicznym menu wg uprawnień.

**Architecture:** Port plików z `C:\Users\Użytkownik\Desktop\BBS-Unified` (dalej **BBS**) wg GLOBALNYCH REGUŁ PORTU (niżej). UI ląduje w `components/agencja/*` (EBS ma własne, niezwiązane `components/hr/*` — NIE dotykać!). API 1:1 ścieżki `app/api/hr/*`. Wiring: 2 nowe widoki w `views/DashboardAdminNew.tsx` EBS + sidebar z sekcją Agencja (dynamiczną dla ról agencyjnych). Spec: `docs/superpowers/specs/2026-07-17-e2-agencja-design.md`; mapa: `.superpowers/sdd/e2b-recon.md`.

**Tech Stack:** Next.js 15, Supabase (service-role za bramkami `can()`), vitest. ZERO nowych zależności npm. ZERO nowych migracji (schemat gotowy z E2a; jeśli introspekcja EBS wykaże brak kolumny → BLOCKED, nie ALTER na własną rękę).

## Global Constraints

- Supabase EBS: `ramedybmybcpqvelsmxd` (żywa produkcja). Źródło portu: katalogi BBS (read-only).
- Po każdym tasku `npx tsc --noEmit` = 0 błędów; commit tylko plików taska; repo ma niezwiązane brudne pliki — nie dotykać.
- Gałąź: `feat/e2b-agencja-core-hr` (Task 1 tworzy z aktualnego HEAD = main po E2a).
- Komunikaty UI/komentarze po polsku. Commit + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

### GLOBALNE REGUŁY PORTU (obowiązują KAŻDY plik portowany z BBS)

1. **admin()**: `import { admin } from '@/lib/crm/visibility'` → `import { admin } from '@/lib/supabaseAdmin'` (shim z Task 1). Żadnych importów `@/lib/crm/*` w EBS.
2. **logEvent**: usuń `import ... from '@/lib/audit'` oraz KAŻDE wywołanie `logEvent(...)` / `await logEvent(...)` (całe statementy). Audyt robią triggery DB (decyzja E2a). Nie zostawiaj pustych `try{}`.
3. **UI namespace**: `components/adminNew/hr/X.tsx` (BBS) → `components/agencja/X.tsx` (EBS); wewnętrzne importy między tymi komponentami odpowiednio (`@/components/agencja/...`). Importy `@/components/ui/Hint` zostają (Hint portowany w Task 1).
4. **Flagi out-of-scope** (dokładne miejsca w `.superpowers/sdd/e2b-recon.md` §1):
   - `settlements/pdf/route.ts` — NIE portować (E2c).
   - `candidates/from-passport/route.ts` — NIE portować (E2d).
   - `lib/hr/ocr` w `candidates/import-drive` — usuń import i gałąź wzbogacania OCR; import z Drive bez OCR ma działać; dodaj komentarz `// OCR-enrichment: E2d`.
   - `lib/anthropic` w `vehicles/[id]/license` — upload zdjęcia zostaje; gałąź odczytu AI zastąp odpowiedzią `{ ok: true, ocr: null }` + komentarz `// OCR: E2d`.
   - `lib/accounting/access` w `vehicles/[id]/costs` i `bhp/issues` — usuń import; wywołanie `hrLinkedCompanyId()` zastąp `null`; zapisy do `acc_entries` muszą być objęte guardem `if (accCompanyId) {...}` (jeśli w BBS nie są — dodaj guard) + komentarz `// auto-księgowanie: E4`.
   - `lib/hr/geo` w `contracts/*` i `accommodations/*` oraz `lib/hr/accommodations` — importy zostają, ale wskazują na STUB z Task 1 (ta sama sygnatura, geokodowanie zwraca null).
5. **Bez zmian logiki biznesowej** poza regułami 1–4. Wątpliwość → DONE_WITH_CONCERNS z opisem, nie własna interpretacja.
6. **Storage**: buckety `hr-documents`/`accommodation-photos`/`vehicle-photos` istnieją (E2a); kod BBS używa tych samych nazw — zostaje 1:1.

---

### Task 1: Gałąź + fundamenty (shim admin, uuid, images, Hint, geo-stub)

**Files:**
- Create: `lib/supabaseAdmin.ts`
- Create: `lib/uuid.ts` (kopia z BBS `lib/uuid.ts`)
- Create: `lib/images.ts` (kopia z BBS `lib/images.ts`)
- Create: `components/ui/Hint.tsx` (kopia z BBS `components/ui/Hint.tsx`)
- Create: `lib/hr/geo.ts` (STUB — kod niżej, NIE kopia BBS)
- Test: `lib/hr/geo.test.ts`

**Interfaces:**
- Produces: `admin(): SupabaseClient` (alias supabaseServer); `isUuid(s)`; `looksLikeImage`/`normalizeImage` (sygnatury z BBS); `Hint`; `geocodeAddress(address: string): Promise<{lat:number,lng:number}|null>` (zawsze null) + pozostałe eksporty geo BBS jako stuby o TYCH SAMYCH sygnaturach (odczytaj BBS `lib/hr/geo.ts` i odwzoruj każdy eksport).

- [ ] **Step 1: Gałąź**
```bash
cd "C:/Users/Użytkownik/Desktop/ebs-wersja-natywna"
git checkout main && git checkout -b feat/e2b-agencja-core-hr
```
- [ ] **Step 2: `lib/supabaseAdmin.ts`**
```ts
// Neutralny klient service-role dla modułu agencji (BBS miał admin() w lib/crm/visibility —
// CRM jest wykluczony z EBS, więc alias wskazuje istniejący supabaseServer).
import { supabaseServer } from '@/lib/supabase';

export const admin = supabaseServer;
```
- [ ] **Step 3: Kopie `lib/uuid.ts`, `lib/images.ts`, `components/ui/Hint.tsx`** z BBS (1:1; jeśli Hint używa `font-display` → zamień na `font-sans`).
- [ ] **Step 4: `lib/hr/geo.ts` STUB** — odczytaj `BBS/lib/hr/geo.ts`, odwzoruj KAŻDY eksport (nazwy+sygnatury 1:1), implementacje: geokodowanie → `null`, szacowanie dojazdu → `null`, czyste funkcje pomocnicze (np. haversine, jeśli jest) skopiuj żywcem. Nagłówek: `// STUB E2b — realne geokodowanie (Nominatim) wchodzi w E2d; sygnatury 1:1 z BBS.`
- [ ] **Step 5: Test `lib/hr/geo.test.ts`** — `geocodeAddress('Gdańsk, Długa 1')` → resolves null (nie rzuca); pozostałe stuby analogicznie (po 1 asercji).
- [ ] **Step 6:** `npx vitest run lib/hr` PASS; `npx tsc --noEmit` 0.
```bash
git add lib/supabaseAdmin.ts lib/uuid.ts lib/images.ts components/ui/Hint.tsx lib/hr/geo.ts lib/hr/geo.test.ts
git commit -m "feat(e2b): fundamenty portu HR - supabaseAdmin shim, uuid, images, Hint, geo-stub"
```

---

### Task 2: lib/hr helpery domenowe (TDD)

**Files:**
- Create (kopie 1:1 z `BBS/lib/hr/`): `lib/hr/docPlaceholders.ts`, `lib/hr/readiness.ts`, `lib/hr/rentShare.ts`, `lib/hr/vehicles.ts`, `lib/hr/accommodations.ts`, `lib/hr/driveImport.ts`, `lib/hr/coordinatorScope.ts`
- Test: `lib/hr/docPlaceholders.test.ts`, `lib/hr/rentShare.test.ts`, `lib/hr/readiness.test.ts`

**Interfaces:**
- Consumes: `admin` (Task 1 — coordinatorScope importuje wg reguły portu 1), `geo` stub (accommodations).
- Produces: `fullName`, `buildDocData`, `DOC_PLACEHOLDERS`, `fillPlaceholders`; `readiness(...)`; `rentSharePerPerson(...)`; `buildVehicleRow`, `COST_KINDS`; `buildAccRow`, `composeAccAddress`, `computeAccRent`, `withAccGeo`; `listDriveFolder`/`downloadDriveFile` (nazwy faktyczne z BBS); `coordinatorGrantedContractIds`. Sygnatury 1:1 z BBS — API/UI portowane w T4–T9 używają ich bez zmian.

- [ ] **Step 1:** Skopiuj 7 plików; zastosuj REGUŁĘ 1 w `coordinatorScope.ts`. `grep -n "lib/crm\|logEvent" lib/hr/*.ts` → 0 trafień.
- [ ] **Step 2 (TDD):** Napisz testy PRZED uruchomieniem (FAIL niemożliwy — pliki już są — więc rygor: testy na FAKTYCZNE eksporty, bez `as any`):
  - docPlaceholders: `fullName({first_name:'Jan',last_name:'Kowalski'})` (dopasuj kształt do typu z pliku) zawiera 'Jan' i 'Kowalski'; `fillPlaceholders('X {{imie_nazwisko}}', ...)` podstawia; brakujący placeholder → kropkowana linia + wpis w missing[].
  - rentShare: dzielenie czynszu — suma udziałów = czynsz (inwariant), 0 mieszkańców nie rzuca.
  - readiness: pracownik bez dokumentów → niższy wynik niż z kompletem (inwariant porównawczy).
- [ ] **Step 3:** `npx vitest run lib/hr` PASS; `npx tsc --noEmit` 0.
```bash
git add lib/hr
git commit -m "feat(e2b): helpery domenowe HR (docPlaceholders/readiness/rentShare/vehicles/accommodations/driveImport/coordinatorScope) + testy"
```

---

### Task 3: Wiring — PERMISSION_MENU + Sidebar + DashboardAdminNew (TDD)

**Files:**
- Modify: `lib/permissions/registry.ts` (dodaj `MenuDef` + `PERMISSION_MENU`)
- Modify: `components/Sidebar.tsx`
- Modify: `views/DashboardAdminNew.tsx`
- Test: `lib/permissions/registry.test.ts` (rozszerzenie)

**Interfaces:**
- Consumes: `/api/me/permissions` (istnieje), `Role.COORDINATOR/PAYROLL` (E2a).
- Produces: `PERMISSION_MENU: MenuDef[]`; widoki `hr-pracownicy` i `hr-flota` osiągalne z sidebara; DashboardAdminNew renderuje `<HrDashboard/>` i `<HrFlota/>` (komponenty powstają w T5/T9 — w TYM tasku wstaw tymczasowe `<div>Moduł Agencji — w budowie (E2b)</div>` w gałęziach renderu, podmiana w T5/T9).

- [ ] **Step 1 (TDD):** do `lib/permissions/registry.test.ts` dodaj:
```ts
  it('PERMISSION_MENU: sekcja Agencja Pracy pokrywa hr-pracownicy i hr-flota', () => {
    const views = PERMISSION_MENU.map(m => m.view);
    expect(views).toContain('hr-pracownicy');
    expect(views).toContain('hr-flota');
    for (const m of PERMISSION_MENU) {
      expect(m.anyOf.length).toBeGreaterThan(0);
      for (const p of m.anyOf) expect(ALL_PERMISSIONS).toContain(p);
    }
  });
```
Run → FAIL (brak eksportu).
- [ ] **Step 2: registry** — dodaj na końcu pliku (adaptacja BBS PERMISSION_MENU przycięta do EBS):
```ts
// Mapowanie uprawnień → pozycje menu panelu (dynamiczny sidebar dla ról agencyjnych).
export interface MenuDef { view: string; label: string; section: string; icon: string; anyOf: string[] }
export const PERMISSION_MENU: MenuDef[] = [
  { view: 'hr-pracownicy', label: 'Pracownicy', section: 'Agencja Pracy', icon: 'users',
    anyOf: ['agencja.pulpit', 'agencja.poczekalnia', 'agencja.kontrakty', 'agencja.dokumenty', 'agencja.raporty', 'agencja.rozliczenia', 'agencja.noclegi', 'agencja.archiwum', 'agencja.dowoz', 'agencja.bhp', 'agencja.legalizacja'] },
  { view: 'hr-flota', label: 'Flota', section: 'Agencja Pracy', icon: 'car', anyOf: ['agencja.flota'] },
];
```
- [ ] **Step 3: Sidebar** (`components/Sidebar.tsx`): (a) w `case Role.SUPERADMIN` dopisz po `admin-uprawnienia`:
```tsx
          { id: 'hr-pracownicy', label: 'Agencja — Pracownicy', icon: <HardHat size={20} /> },
          { id: 'hr-flota',      label: 'Agencja — Flota',      icon: <Car size={20} /> },
```
(+ `HardHat`, `Car` do importu lucide). (b) dodaj `case Role.COORDINATOR: case Role.PAYROLL:` budujący pozycje DYNAMICZNIE: komponent na mount robi `fetch('/api/me/permissions')`, trzyma `permissions: string[]` w stanie i filtruje `PERMISSION_MENU` przez `m.anyOf.some(p => perms.includes(p))`; ikony: mapka `{users: <Users/>, car: <Car/>}`. Bez uprawnień → pusta lista (sidebar pokazuje tylko wyloguj). Zachowaj istniejący styl (białe menu jak inne role nie-EMPLOYEE).
- [ ] **Step 4: DashboardAdminNew** (`views/DashboardAdminNew.tsx`): rozszerz union `AdminTab` o `'hr-pracownicy' | 'hr-flota'`, uzupełnij `VIEW_TO_TAB`/`TAB_TO_VIEW`, dodaj DWA branche renderu z placeholderem `<div className="p-8 text-slate-500">Moduł Agencji — w budowie (E2b)</div>`. NIE dodawaj tych tabów do poziomego tab-bara benefitowego — wejście wyłącznie z sidebara (jak w BBS; superadmin i tak ma pozycje w sidebarze).
- [ ] **Step 5:** `npx vitest run lib/permissions` PASS; `npx tsc --noEmit` 0. Dev-smoke: zaloguj nie trzeba — wystarczy kompilacja (behawior w T10).
```bash
git add lib/permissions/registry.ts lib/permissions/registry.test.ts components/Sidebar.tsx views/DashboardAdminNew.tsx
git commit -m "feat(e2b): wiring agencji - PERMISSION_MENU + dynamiczny sidebar rol agencyjnych + widoki hr-pracownicy/hr-flota"
```

---

### Task 4: API plaster 1 — kadra (employees, contracts, coordinators*)

**Files (Create — port z `BBS/app/api/hr/...` wg REGUŁ):**
- `app/api/hr/employees/route.ts`, `employees/[id]/route.ts`, `employees/[id]/accept/route.ts`, `employees/[id]/account/route.ts`, `employees/[id]/archive/route.ts`, `employees/[id]/documents/route.ts`, `employees/[id]/documents/[docId]/route.ts`, `employees/[id]/import-drive/route.ts`
- `app/api/hr/contracts/route.ts`, `contracts/[id]/route.ts`
- `app/api/hr/coordinators/route.ts`, `app/api/hr/coordinator-pay/route.ts`, `app/api/hr/coordinator-visibility/route.ts`
- `app/api/hr/candidates/import-drive/route.ts` (OCR-enrichment wycięty wg REGUŁY 4)

**Interfaces:**
- Consumes: T1 (admin, uuid, images), T2 (coordinatorScope, docPlaceholders, driveImport), geo-stub (contracts), bramki `can/canAny` + `AGENCJA_TABS` (E2a), tabele hr_* (E2a).
- Produces: REST na kadrze — kształty odpowiedzi 1:1 z BBS (UI z T5 konsumuje bez zmian).

- [ ] **Step 1:** Port plików wg REGUŁ (1: admin-shim, 2: strip logEvent, 4: flagi). Po porcie: `grep -rn "lib/crm\|logEvent\|lib/audit\|lib/anthropic\|lib/hr/ocr\|lib/accounting" app/api/hr/` → 0 trafień.
- [ ] **Step 2:** `npx tsc --noEmit` 0.
- [ ] **Step 3:** Dev-smoke bez sesji: `npx next dev --port 3019` → `curl -s -o /dev/null -w "%{http_code}" http://localhost:3019/api/hr/employees` → 401; kill.
```bash
git add app/api/hr
git commit -m "feat(e2b): API kadry - employees/contracts/coordinators (port z BBS, OCR/audit wg regul)"
```

---

### Task 5: UI plaster 1 — HrDashboard + kadra

**Files (Create — port z `BBS/components/adminNew/hr/` → `components/agencja/` wg REGUŁY 3):**
- `components/agencja/HrDashboard.tsx`, `HrKontrakty.tsx`, `HrEmployeePanel.tsx`, `HrEmployeeDocs.tsx`, `HrSchedule.tsx`, `HrPermitAlerts.tsx`, `HrPoczekalnia.tsx`, `HrDokumenty.tsx`, `HrArchiwum.tsx`, `expiry.ts`
- Modify: `views/DashboardAdminNew.tsx` (podmień placeholder `hr-pracownicy` na `<HrDashboard/>` — import dynamic `ssr:false` NIE jest wymagany, komponenty są client-side'owe przez `'use client'`; jeśli któryś używa browser-only API na module-level → dynamic import, odnotuj)

**Interfaces:**
- Consumes: API z T4 (kształty 1:1), `/api/me/permissions`, Hint, docPlaceholders, readiness, expiry.
- Produces: działające pod-zakładki Kontrakty/Poczekalnia/Dokumenty/Archiwum (+ Schedule w panelu pracownika). Pod-zakładki, których API dojdzie w T6/T8 (Pulpit, Rozliczenia, Noclegi, Dowóz, BHP, Legalizacja, Raporty) — komponenty jeszcze NIE istnieją; w `HrDashboard.tsx` tymczasowo zastąp ich importy/gałęzie placeholderem `<div className="p-6 text-slate-400">Wkrótce (E2b)</div>` i oznacz `// T7/T9 podmienia`. HrDashboard MUSI kompilować się w tym tasku.

- [ ] **Step 1:** Port 10 plików wg REGUŁ; w HrDashboard placeholdery jak wyżej. `grep -rn "adminNew/hr\|lib/crm\|logEvent" components/agencja/` → 0.
- [ ] **Step 2:** `npx tsc --noEmit` 0; `npx vitest run` PASS (bez regresji).
```bash
git add components/agencja views/DashboardAdminNew.tsx
git commit -m "feat(e2b): UI kadry - HrDashboard + Kontrakty/Poczekalnia/Dokumenty/Archiwum + panel pracownika"
```

---

### Task 6: API plaster 2 — noclegi, grafik, rozliczenia, pulpit

**Files (Create — port wg REGUŁ):**
- `app/api/hr/accommodations/route.ts`, `accommodations/[id]/route.ts`, `accommodations/[id]/photos/route.ts`
- `app/api/hr/schedule/route.ts`
- `app/api/hr/settlements/route.ts`, `settlements/entry/route.ts`, `settlements/transfers/route.ts` (**pdf/route.ts NIE — E2c**)
- `app/api/hr/pulpit/route.ts`

**Interfaces:**
- Consumes: T1/T2 (accommodations helper + geo-stub, rentShare, docPlaceholders), T4 (employees istnieją).
- Produces: REST noclegi/grafik/rozliczenia/KPI — kształty 1:1 z BBS (UI T7).

- [ ] **Step 1:** Port wg REGUŁ; grep-check jak w T4 → 0 trafień.
- [ ] **Step 2:** `npx tsc --noEmit` 0; dev-smoke: `/api/hr/pulpit` bez sesji → 401.
```bash
git add app/api/hr
git commit -m "feat(e2b): API noclegow/grafiku/rozliczen/pulpitu (bez settlements/pdf - E2c)"
```

---

### Task 7: UI plaster 2 — Noclegi, Rozliczenia, Pulpit

**Files:**
- Create: `components/agencja/HrBazaNoclegowa.tsx`, `HrRozliczenia.tsx`, `HrPulpit.tsx`
- Modify: `components/agencja/HrDashboard.tsx` (podmień 3 placeholdery na realne komponenty)

**Interfaces:** Consumes T6 API + expiry/rentShare. Produces: działające pod-zakładki Pulpit/Rozliczenia/Noclegi. W `HrRozliczenia` przycisk eksportu PDF (jeśli jest) → disabled z tooltipem „PDF list płac — wkrótce (E2c)" (NIE wywołuje settlements/pdf).

- [ ] Port wg REGUŁ; grep-check; `npx tsc --noEmit` 0; `npx vitest run` PASS.
```bash
git add components/agencja
git commit -m "feat(e2b): UI noclegi/rozliczenia/pulpit w HrDashboard"
```

---

### Task 8: API plaster 3 — flota, dowóz, BHP, legalizacja

**Files (Create — port wg REGUŁ, w tym REGUŁA 4 dla accounting/OCR):**
- `app/api/hr/vehicles/route.ts`, `vehicles/[id]/route.ts`, `vehicles/[id]/costs/route.ts`, `vehicles/[id]/license/route.ts`, `vehicles/[id]/photos/route.ts`, `vehicles/people/route.ts`
- `app/api/hr/transport/route.ts`
- `app/api/hr/bhp/items/route.ts`, `bhp/issues/route.ts`
- `app/api/hr/legalization/route.ts`

**Interfaces:** Consumes T1/T2 (vehicles helper, images), T4 (employees). Produces REST floty/dowozu/BHP/legalizacji 1:1 (UI T9).

- [ ] Port wg REGUŁ (license: upload zostaje, OCR → `{ok:true, ocr:null}`; costs/issues: guard `if (accCompanyId)` wokół acc_entries, accCompanyId=null). Grep-check → 0. `npx tsc --noEmit` 0; dev-smoke `/api/hr/vehicles` → 401.
```bash
git add app/api/hr
git commit -m "feat(e2b): API floty/dowozu/BHP/legalizacji (OCR i auto-ksiegowanie odlozone wg planu)"
```

---

### Task 9: UI plaster 3 — Flota, Dowóz, BHP, Legalizacja, Raporty

**Files:**
- Create: `components/agencja/HrFlota.tsx`, `HrDowoz.tsx`, `HrBhp.tsx`, `HrLegalizacja.tsx`, `HrRaporty.tsx`
- Modify: `components/agencja/HrDashboard.tsx` (podmień 4 ostatnie placeholdery), `views/DashboardAdminNew.tsx` (placeholder `hr-flota` → `<HrFlota/>`)

**Interfaces:** Consumes T8 API. Produces: komplet 11 pod-zakładek HrDashboard + widok Flota. W HrFlota przycisk odczytu prawa jazdy AI (jeśli jest) → działa jako upload bez OCR (API zwraca ocr:null — UI ma to znosić gracefully; jeśli UI zakłada niepusty wynik, dodaj obsługę null z komunikatem „Odczyt AI — wkrótce (E2d)").

- [ ] Port wg REGUŁ; grep-check; `npx tsc --noEmit` 0; `npx vitest run` PASS; w HrDashboard nie może zostać ŻADEN placeholder.
```bash
git add components/agencja views/DashboardAdminNew.tsx
git commit -m "feat(e2b): UI flota/dowoz/BHP/legalizacja/raporty - komplet 11 zakladek agencji"
```

---

### Task 10: Weryfikacja + CLAUDE.md + merge + deploy + smoke

**Files:** Modify: `CLAUDE.md`.

- [ ] **Step 1:** `npx vitest run` → wszystkie PASS; `npx tsc --noEmit` → 0; `grep -rn "lib/crm\|logEvent\|from-passport\|settlements/pdf" app/api/hr components/agencja lib/hr` → 0 trafień (poza komentarzami E2c/E2d).
- [ ] **Step 2:** CLAUDE.md — w sekcji Shell/Launcher po akapicie E2a dopisz:
```markdown
**E2b (2026-07-18):** core HR agencji działa: widoki `hr-pracownicy` (`components/agencja/HrDashboard` —
11 pod-zakładek filtrowanych uprawnieniami `agencja.*`) i `hr-flota` (`HrFlota`) w DashboardAdminNew;
sidebar superadmina statycznie + dynamiczne menu ról agencyjnych z `PERMISSION_MENU`
(lib/permissions/registry). API: `app/api/hr/*` (33 route'y; service-role za `can()/canAny()`).
UI w `components/agencja/*` (NIE mylić z niezwiązanym `components/hr/*`). Odłożone świadomie:
`settlements/pdf` + generator (E2c), OCR/tłumacz/mapa + `candidates/from-passport` (E2d),
portal pracownika + tracking GPS (E2e), auto-księgowanie kosztów do `acc_entries` (E4 — guard w kodzie).
Helpery: `lib/hr/*` (geo = stub do E2d), `lib/supabaseAdmin.admin` (alias supabaseServer).
```
```bash
git add CLAUDE.md && git commit -m "docs(claude): E2b - core HR agencji"
```
- [ ] **Step 3:** merge ff + push: `git fetch . feat/e2b-agencja-core-hr:main && git push origin main`
- [ ] **Step 4:** deploy `npx vercel --prod --yes` → READY.
- [ ] **Step 5:** Smoke prod:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://ebs.elitonbenefits.pl/login            # 200
curl -s -o /dev/null -w "%{http_code}\n" https://ebs.elitonbenefits.pl/api/hr/employees # 401
curl -s -o /dev/null -w "%{http_code}\n" https://ebs.elitonbenefits.pl/api/hr/pulpit    # 401
curl -s -o /dev/null -w "%{http_code}\n" https://ebs.elitonbenefits.pl/api/hr/vehicles  # 401
```
- [ ] **Step 6:** Raport: co działa, co odłożone (E2c/d/e/E4), znane ograniczenia; następny krok: plan E2c (generator).

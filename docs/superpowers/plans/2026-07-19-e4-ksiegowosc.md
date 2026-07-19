# E4: Księgowość (bez własnego KSeF, bez faktur sprzedażowych) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Moduł księgowy agencji w EBS: firmy księgowe, kontrahenci, księga kosztów/przychodów (`acc_entries`), KPiR + rejestr VAT (kosztowo), środki trwałe, magazyn, sprawozdania — plus **włączenie auto-księgowania kosztów BHP/pojazdów z E2b**. BEZ własnego klienta KSeF i BEZ wystawiania faktur sprzedażowych (Fakturownia zostaje jedynym fakturującym — decyzja usera 2026-07-19).

**Architecture:** Port `app/api/accounting/*` (bez `ksef/*`, `invoices/*`), `components/adminNew/ksiegowosc/*` + `components/adminNew/AdminKsiegowosc.tsx` (bez pod-zakładki faktur/KSeF), `lib/accounting/{access,assets}` → EBS wg GLOBALNYCH REGUŁ PORTU. Migracja 8 tabel `acc_*` z introspekcji żywej bazy BBS. Mapa: `.superpowers/sdd/e4-recon.md`.

**Tech Stack:** Next.js 15, Supabase, vitest. ZERO nowych deps. ZERO nowych cronów.

## Global Constraints
- Supabase EBS `ramedybmybcpqvelsmxd`. Źródło: `C:\Users\Użytkownik\Desktop\BBS-Unified` (read-only). Introspekcja: BBS Supabase `pcszyyjwrkkkgbbcpzhn` (tylko information_schema/pg_catalog — potwierdź nazwą przez `list_projects`).
- Po każdym tasku `npx tsc --noEmit` = 0; przy route'ach/UI TAKŻE `npx next build`. Commit tylko plików taska; brudne pliki repo — nie dotykać.
- Gałąź `feat/e4-ksiegowosc` (Task 1 z `main`). Komunikaty/komentarze PL. Commit + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

### WYKLUCZENIA (nie portować NIGDY w E4)
- `lib/ksef/*`, `app/api/accounting/ksef/*`, `app/api/accounting/invoices/**` (cały katalog faktur), `components/adminNew/ksiegowosc/KsiegFaktury.tsx`, `lib/accounting/invoices.ts`.
- W `AdminKsiegowosc.tsx`: pod-zakładka „Faktury" — ukryć (przycisk/branch za `{false &&}` lub usunąć z listy sub-tabów) + krótki tekst „Faktury sprzedażowe: Fakturownia". Komentarz `// faktury sprzedazowe: Fakturownia (E4 bez wlasnego wystawiania/KSeF)`.
- W `KsiegFirmy.tsx`: pola tokenu/env KSeF (`ksef_token_enc`, `ksef_env`) — usunąć z formularza (kolumny w DB zostają nieużywane).

### GLOBALNE REGUŁY PORTU (każdy plik z BBS)
1. `admin` z `@/lib/crm/visibility` → `@/lib/supabaseAdmin`.
2. Usuń `@/lib/audit` + każde `logEvent(...)` (27 miejsc; audyt = triggery DB).
3. UI `components/adminNew/ksiegowosc/X`, `components/adminNew/AdminKsiegowosc` → ta sama ścieżka w EBS; importy `@/lib/hr/*`, `@/components/ui/*` zostają; import wykluczonego `KsiegFaktury` → usunąć.
4. Untyped `acc_*`/`hr_*` → `(admin() as any).from('acc_...')`.
5. Non-route `export const` w route.ts → bare const.
6. font-display → font-sans.
7. Bez zmian logiki poza 1–6 + WYKLUCZENIA.

---

### Task 1: Gałąź + migracja 050 (8 tabel acc_*) + bucket invoices
**Files:** Create `supabase/migrations/050_ksiegowosc_schema.sql`.
**Interfaces:** Produces tabele `acc_companies, acc_company_members, acc_contractors, acc_entries, acc_fixed_assets, acc_invoice_items, acc_invoices, acc_products` (kolumny 1:1 z BBS) + bucket Storage `invoices` (private) + 1 wiersz `acc_companies` z `hr_linked=true` (dla auto-księgowania). E4b–c używają tych tabel.

- [ ] **Step 1:** `git checkout main && git checkout -b feat/e4-ksiegowosc`
- [ ] **Step 2:** Introspekcja BBS (`list_projects` → potwierdź „bbs-unified" pcszyyjwrkkkgbbcpzhn; TYLKO odczyt katalogów): kolumny/typy/defaulty/PK/FK/CHECK/indeksy/RLS wszystkich 8 tabel `acc_*` (zapytania jak w migracji 048/E2a).
- [ ] **Step 3:** Wygeneruj `050_ksiegowosc_schema.sql`: `CREATE TABLE IF NOT EXISTS` 8 tabel w kolejności FK (acc_companies → reszta); FK `acc_entries.accommodation_id→hr_accommodations`, `acc_entries.employee_id→hr_employees` (istnieją w EBS); RLS ENABLE na wszystkich (deny-all jak w BBS; jeśli BBS miał polityki „member reads own company" — przenieś 1:1); triggery `fn_audit_log` na `acc_companies, acc_contractors, acc_entries, acc_invoices, acc_fixed_assets` (operacyjne). Nagłówek: `-- E4: schemat ksiegowosci (introspekcja z zywej bazy BBS; bez wlasnego KSeF - kolumny ksef_* zostaja nieuzywane).`
- [ ] **Step 4:** Bucket + seed w tej samej migracji:
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('invoices','invoices',false) ON CONFLICT (id) DO NOTHING;
-- firma HR-linked dla auto-ksiegowania kosztow agencji (Stratton); dane do uzupelnienia w panelu
INSERT INTO public.acc_companies (name, nip, hr_linked)
  SELECT 'Stratton Prime (agencja)', NULL, true
  WHERE NOT EXISTS (SELECT 1 FROM public.acc_companies WHERE hr_linked = true);
```
- [ ] **Step 5:** `apply_migration` (EBS, name `050_ksiegowosc_schema`). Weryfikacja: (a) porównanie kolumn EBS vs BBS = 0 różnic; (b) write-smoke rollback-safe na każdej z 8 tabel (jak 048); (c) `SELECT count(*) FROM acc_companies WHERE hr_linked=true` = 1.
- [ ] **Step 6:** Commit `supabase/migrations/050_ksiegowosc_schema.sql` → `feat(e4): 050 schemat ksiegowosci - 8 tabel acc_* (introspekcja BBS) + bucket invoices + firma hr_linked`.

---

### Task 2: lib/accounting (access + assets) + un-stub auto-księgowania kosztów
**Files:** Create `lib/accounting/access.ts`, `lib/accounting/assets.ts`; Modify `app/api/hr/bhp/issues/route.ts`, `app/api/hr/vehicles/[id]/costs/route.ts`; Test `lib/accounting/assets.test.ts`.
**Interfaces:** Produces `myCompanies`, `companyAccess`, `nextInvoiceNumber`, `hrLinkedCompanyId` (access — port BEZ importu ksef; jeśli `nextInvoiceNumber` używa acc_invoices, zostaw — tabela istnieje); `assetState()` (assets, czysta amortyzacja). Konsumowane przez E4b–c + hr bhp/vehicles.

- [ ] **Step 1:** Port `lib/accounting/access.ts` + `assets.ts` z BBS wg REGUŁ (1: admin-shim; 2: logEvent). `grep -n "lib/crm\|logEvent\|lib/ksef" lib/accounting/*.ts` → 0.
- [ ] **Step 2 (TDD):** `lib/accounting/assets.test.ts` — `assetState` (amortyzacja liniowa): odczytaj eksport; test inwariantu (np. po pełnym okresie written_off = initial_value; w połowie okresu proporcjonalnie; nie przekracza initial_value). Bez `as any`, realne typy.
- [ ] **Step 3: UN-STUB** w `app/api/hr/bhp/issues/route.ts` i `app/api/hr/vehicles/[id]/costs/route.ts`: dopisz `import { hrLinkedCompanyId } from '@/lib/accounting/access';` i zamień KAŻDE `const accCompanyId = null;` (2 w każdym pliku) na `const accCompanyId = await hrLinkedCompanyId();`. Reszta (guardy `if (accCompanyId ...)`) już jest — teraz się aktywują. Usuń komentarze `// auto-księgowanie: E4` (już zrobione).
- [ ] **Step 4:** `npx vitest run lib/accounting` PASS; `npx tsc --noEmit` 0; `npx next build` clean.
- [ ] **Step 5:** Commit `lib/accounting app/api/hr/bhp/issues/route.ts "app/api/hr/vehicles/[id]/costs/route.ts"` → `feat(e4): lib/accounting (access+assets) + wlaczenie auto-ksiegowania kosztow BHP/pojazdow (un-stub E2b)`.

---

### Task 3: Uprawnienia — grupa Księgowość + wiring widoku (placeholder)
**Files:** Modify `lib/permissions/registry.ts`, `lib/adminViews.ts`, `components/Sidebar.tsx`, `views/DashboardAdminNew.tsx`; Test `lib/permissions/registry.test.ts`.
**Interfaces:** Produces klucze `ksiegowosc.faktury`/`ksiegowosc.bilans` + PERMISSION_MENU `admin-ksiegowosc`; widok `admin-ksiegowosc` osiągalny (placeholder do T5).

- [ ] **Step 1 (TDD):** do `registry.test.ts` dodaj asercję: grupa „Księgowość" istnieje z kluczami `ksiegowosc.faktury`+`ksiegowosc.bilans`; oba w `ALL_PERMISSIONS`.
- [ ] **Step 2:** `registry.ts` — dodaj grupę (po „Panel systemowy" lub przed „Agencja Pracy"):
```ts
  { name: 'Księgowość', perms: [
    { key: 'ksiegowosc.faktury', label: 'Księgowość — koszty i wpisy (dodawanie)', kind: 'tab' },
    { key: 'ksiegowosc.bilans', label: 'Pełny bilans firmy (wszystkie kwoty, edycja/usuwanie)', kind: 'action' },
  ]},
```
DEFAULT_ROLE_PERMS: dopisz `ksiegowosc.faktury`+`ksiegowosc.bilans` do `dyrektor`; `ksiegowosc.faktury` do `koordynator`. (superadmin ma wszystko z definicji.) PERMISSION_MENU: dodaj `{ view: 'admin-ksiegowosc', label: 'Księgowość', section: 'Księgowość', icon: 'book', anyOf: ['ksiegowosc.bilans','ksiegowosc.faktury'] }`.
- [ ] **Step 3:** `lib/adminViews.ts` — dodaj `{ id: 'admin-ksiegowosc', label: 'Księgowość' }`.
- [ ] **Step 4:** `Sidebar.tsx` — superadmin case: `{ id: 'admin-ksiegowosc', label: 'Księgowość', icon: <BookOpen size={20} /> }` (+ `BookOpen` do importu; ikona dynamiczna `book: <BookOpen/>`).
- [ ] **Step 5:** `views/DashboardAdminNew.tsx` — `AdminTab` += `'admin-ksiegowosc'`, mapy, render branch placeholder `<div className="p-8 text-slate-500">Księgowość — w budowie (E4)</div>` (podmiana w T5).
- [ ] **Step 6:** `npx vitest run lib/permissions` PASS; `npx tsc --noEmit` 0; `npx next build` clean.
- [ ] **Step 7:** Commit `lib/permissions/registry.ts lib/permissions/registry.test.ts lib/adminViews.ts components/Sidebar.tsx views/DashboardAdminNew.tsx` → `feat(e4): grupa uprawnien Ksiegowosc + wiring widoku admin-ksiegowosc (placeholder)`.

---

### Task 4: API core — companies + contractors
**Files:** Create `app/api/accounting/companies/route.ts` (+`[id]`), `app/api/accounting/contractors/route.ts` (+`[id]`) (port wg REGUŁ).
**Interfaces:** Consumes `lib/accounting/access` (companyAccess/myCompanies). Produces REST firm + kontrahentów. UI T5.
- [ ] Port 4 plików wg REGUŁ. `grep -rn "lib/crm\|logEvent\|lib/ksef" app/api/accounting/companies app/api/accounting/contractors` → 0. `npx tsc --noEmit` 0; `npx next build` clean; dev-smoke `/api/accounting/companies` bez sesji → 403.
```bash
git add app/api/accounting/companies app/api/accounting/contractors
git commit -m "feat(e4): API companies + contractors (ksiegowosc)"
```

---

### Task 5: API entries + UI core (KsiegFirmy, KsiegKontrahenci, AdminKsiegowosc bilans)
**Files:** Create `app/api/accounting/entries/route.ts` (+`analyze`, +`[id]`); `components/adminNew/ksiegowosc/{KsiegFirmy,KsiegKontrahenci}.tsx`, `components/adminNew/AdminKsiegowosc.tsx`; Modify `views/DashboardAdminNew.tsx` (placeholder → `<AdminKsiegowosc/>`).
**Interfaces:** Consumes API T4 + entries. Produces zakładka Księgowość z sub-tabami: bilans (entries), firmy, kontrahenci; **pod-zakładka Faktury UKRYTA** (WYKLUCZENIA). `entries/analyze` (AI odczyt zdjęcia faktury) — ANTHROPIC AI-guard jak E2d (bez klucza → `{ok:false, disabled:true, error}`; UI obsługuje).
- [ ] **Step 1:** Port entries (3 pliki) wg REGUŁ; `entries/analyze` dostaje AI-guard (wzorzec E2d: brak `ANTHROPIC_API_KEY` → 200 `{ok:false,disabled:true,error:'Odczyt AI wyłączony — brak ANTHROPIC_API_KEY'}`). Signed URL z bucketu `invoices`.
- [ ] **Step 2:** Port UI: `AdminKsiegowosc.tsx` (kontener) — usuń import/sub-tab `KsiegFaktury` (WYKLUCZENIA: ukryj zakładkę Faktury + tekst „Faktury: Fakturownia"). `KsiegFirmy.tsx` (usuń pola KSeF), `KsiegKontrahenci.tsx`. Import wykluczonych → usunięte. font-swap.
- [ ] **Step 3:** `views/DashboardAdminNew.tsx`: placeholder `admin-ksiegowosc` → `<AdminKsiegowosc/>` (import).
- [ ] **Step 4:** grep `ksiegowosc/KsiegFaktury\|lib/crm\|logEvent\|lib/ksef\|ksef_token` w portowanych plikach → 0. `npx tsc --noEmit` 0; `npx next build` clean; `npx vitest run` PASS.
```bash
git add app/api/accounting/entries components/adminNew/ksiegowosc/KsiegFirmy.tsx components/adminNew/ksiegowosc/KsiegKontrahenci.tsx components/adminNew/AdminKsiegowosc.tsx views/DashboardAdminNew.tsx
git commit -m "feat(e4): API entries + UI ksiegowosci (bilans/firmy/kontrahenci; faktury=Fakturownia ukryte)"
```

---

### Task 6: API KPiR + VAT + report + summary (kosztowo)
**Files:** Create `app/api/accounting/kpir/route.ts`, `vat/route.ts`, `report/route.ts`, `summary/route.ts` (port wg REGUŁ).
**Interfaces:** Consumes access + rentShare (`rentSharePerPerson`, `rentActiveInPeriod` — istnieją). Produces KPiR/VAT/raporty. **UWAGA:** KPiR/VAT czytają przychody z `acc_invoices` (pusta bo brak modułu faktur) → wychodzą KOSZTOWO; to OK, nie modyfikuj logiki. summary/report czytają też hr_* (advances/payouts/settlements/coordinator_pay/accommodations) — istnieją.
- [ ] Port 4 plików wg REGUŁ. `grep -rn "lib/crm\|logEvent\|lib/ksef" app/api/accounting/{kpir,vat,report,summary}` → 0. `npx tsc --noEmit` 0; `npx next build` clean; dev-smoke `/api/accounting/summary` → 403.
```bash
git add app/api/accounting/kpir app/api/accounting/vat app/api/accounting/report app/api/accounting/summary
git commit -m "feat(e4): API KPiR/VAT/raport/bilans miesieczny (kosztowo - przychody w Fakturowni)"
```

---

### Task 7: API środki trwałe + magazyn
**Files:** Create `app/api/accounting/assets/route.ts` (+`[id]`), `app/api/accounting/products/route.ts` (+`[id]`).
**Interfaces:** Consumes `lib/accounting/assets` (assetState). Produces REST ŚT + magazyn. UI T8.
- [ ] Port 4 plików wg REGUŁ. grep → 0. `npx tsc --noEmit` 0; `npx next build` clean.
```bash
git add app/api/accounting/assets app/api/accounting/products
git commit -m "feat(e4): API srodki trwale + magazyn"
```

---

### Task 8: UI KsiegKpirVat + KsiegMagazynST + KsiegSprawozdania
**Files:** Create `components/adminNew/ksiegowosc/{KsiegKpirVat,KsiegMagazynST,KsiegSprawozdania}.tsx`; Modify `components/adminNew/AdminKsiegowosc.tsx` (podłącz sub-taby kpir/vat/magazyn/srodki/sprawozdania).
**Interfaces:** Consumes API T6/T7. Produces komplet sub-zakładek księgowości (bez faktur).
- [ ] Port 3 plików wg REGUŁ (font-swap, import rewrites); w `AdminKsiegowosc` podłącz brakujące sub-taby. grep `lib/crm\|logEvent\|ksef` → 0. `npx tsc --noEmit` 0; `npx next build` clean; `npx vitest run` PASS.
```bash
git add components/adminNew/ksiegowosc/KsiegKpirVat.tsx components/adminNew/ksiegowosc/KsiegMagazynST.tsx components/adminNew/ksiegowosc/KsiegSprawozdania.tsx components/adminNew/AdminKsiegowosc.tsx
git commit -m "feat(e4): UI KPiR/VAT + magazyn/srodki trwale + sprawozdania"
```

---

### Task 9: Weryfikacja + CLAUDE.md + merge + deploy + smoke
**Files:** Modify `CLAUDE.md`.
- [ ] **Step 1:** `npx vitest run` PASS; `npx tsc --noEmit` 0; `npx next build` clean; `grep -rn "lib/ksef\|KsiegFaktury\|accounting/invoices" app components lib` → 0 (KSeF/faktury nieobecne).
- [ ] **Step 2:** CLAUDE.md — akapit **E4** po E2e: moduł księgowości (`admin-ksiegowosc` → `AdminKsiegowosc`, gate `ksiegowosc.*`); tabele `acc_*` (migracja 050); auto-księgowanie kosztów BHP/pojazdów WŁĄCZONE (`hrLinkedCompanyId`, firma hr_linked); **BEZ własnego KSeF i BEZ faktur sprzedażowych — Fakturownia zostaje jedynym fakturującym; KPiR/VAT kosztowo (przychody z Fakturowni; ewentualny sync = przyszłość)**; `entries/analyze` AI-guard. Bucket `invoices`.
```bash
git add CLAUDE.md && git commit -m "docs(claude): E4 - ksiegowosc (bez KSeF/faktur, Fakturownia zostaje)"
```
- [ ] **Step 3:** merge ff + push: `git fetch . feat/e4-ksiegowosc:main && git push origin main`.
- [ ] **Step 4:** deploy `npx vercel --prod --yes` → READY.
- [ ] **Step 5:** Smoke: `/login` 200; `/api/accounting/companies` → 403; `/api/accounting/summary` → 403; `/api/accounting/invoices` → 404 (nieportowane); `/api/accounting/ksef/inbox` → 404.
- [ ] **Step 6:** Raport: **migracja BBS→EBS KOMPLETNA** (E1 + E2 + E4); co świadomie odłożone (własny KSeF + faktury sprzedażowe = Fakturownia; czat/notatki = E3); klucze AI do wpisania.

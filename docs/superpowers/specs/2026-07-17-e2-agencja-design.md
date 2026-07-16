# E2: Agencja Pracy + HR agencyjny + Generator dokumentów (port z BBS-Unified do EBS)

**Data:** 2026-07-17
**Status:** spec do akceptacji
**Źródło:** `C:\Users\Użytkownik\Desktop\BBS-Unified` (system „rich" `hr/*`)
**Cel:** `ebs-wersja-natywna` (EBS / Stratton Prime)
**Poprzednik:** E1 (shell/launcher + uprawnienia) — wdrożony 2026-07-16
**Mapa rekonesansu:** `.superpowers/sdd/e2-recon.md` (inwentarz plik-po-pliku, tabele, couplingi)

---

## 1. Decyzje kierunkowe (wywiad 2026-07-17)

| Decyzja | Wybór |
|---|---|
| Model użycia | **Stratton wewnętrznie** (jak BBS) — jedna organizacja, port 1:1, BEZ tenant-scopingu |
| Zakres | **Pełny port 15 zakładek** systemu `hr/*` |
| Który system | **Tylko nowy/rich `hr/*`** (~10k LOC). Stary `agencja/*` (~1,1k LOC, porzucony duplikat z osobną bazą `worker_placements`) — NIE portujemy; `/app/agencja` prowadzi do nowego systemu |
| Klucze API | **Kopiowane programowo z BBS** (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`): z `BBS-Unified\.env.local` do EBS `.env.local` + na Vercel przez `vercel env add` ze stdin — wartości nigdy nie są wyświetlane ani przepisywane ręcznie |
| Czat pracownik↔koordynator | **Odłożony do E3** (używa tabel systemu czatu). W E2e przycisk czatu ukryty |
| Cron „wygasające dokumenty" | **Doklejony do dziennego `expire-vouchers`** (Vercel Hobby: limit 2 cronów, oba zajęte). Mail przez EBS `lib/mailer` (SMTP Stratton) |
| Księgowanie kosztów BHP/pojazdów | Stub/no-op do czasu E4 (`hrLinkedCompanyId` → null) |
| Dane z BBS | Szablony dokumentów HR (`hr_doc_templates`) + słowniki konfiguracyjne modułów. Dane operacyjne (pracownicy/kontrakty/noclegi BBS) — NIE (osobne firmy) |

## 2. Pod-etapy (każdy = osobny plan → wdrożenie subagentami → deploy)

### E2a — Fundamenty + schemat (~700 LOC + migracje)
1. **Introspekcja żywej bazy BBS** (MCP, projekt bbs-unified): pełny schemat 22 tabel
   `hr_*` (kolumny, typy, defaulty, FK, indeksy, RLS) — brak plików migracji w BBS.
   Wynik → migracja EBS `048_agencja_schema.sql` (+ RLS: pracownik czyta swoje,
   zapis service-role; triggery `fn_audit_log` — działa z kluczami złożonymi po 046).
2. Rozszerzenie ról: constraint `user_profiles.role` + `types/enums.Role`
   (`COORDINATOR`, `PAYROLL`, `TEMP_WORKER`, `HR_PANEL`…) + `lib/roleMap.ts`
   (DbRole: `koordynator`, `szef_koordynatorow`, `platnik`, `pracownik_tymczasowy`, `hr`)
   + `ROLE_DASHBOARD` (koordynator → `/dashboard/admin`, pracownik_tymczasowy → `/dashboard/agencja`).
3. Merge grupy uprawnień **Agencja Pracy** (16 kluczy + `AGENCJA_TABS`) do
   `lib/permissions/registry.ts`; `DEFAULT_ROLE_PERMS` wg BBS (dyrektor/koordynator =
   AGENCJA_TABS; hr/pracodawca = AGENCJA_TABS; koordynator +`.mapa`); port
   `syncAgencyPermsForCustomizedRoles` + endpoint `permissions/sync` (odłożone w E1).
4. Rejestr appek: `agencja` w `lib/apps/registry.ts` (defaultRoles: COORDINATOR,
   PAYROLL, SUPERADMIN) + `appTargets` (agencja → `/dashboard/admin` dla ról
   admin-panelowych; superadmin j.w.).
5. Porty neutralne: `lib/crm/tax-engine` → **`lib/agencja/tax-engine`** (421 LOC,
   czysta matematyka płacowa PL, testy jadą razem); `lib/crm/offer/pdfRenderer.ts` →
   **`lib/pdf/renderer.ts`** (Puppeteer + @sparticuz/chromium, fallback PDF-serwer);
   zamiast BBS `admin()` wszędzie EBS-owe `supabaseServer()`.
6. Audyt: BBS `logEvent`/`event_log` NIE jest portowany — audyt przez triggery
   `audit_log` EBS (jak E1); wywołania `logEvent` w portowanym kodzie usuwane.
7. Buckety Storage: `hr-documents`, `accommodation-photos`, `vehicle-photos` (private).
8. Nowe zależności: `@anthropic-ai/sdk`, `puppeteer-core`, `@sparticuz/chromium`,
   `pdf-lib`, `leaflet` + `@types/leaflet`, `leaflet.markercluster` (`web-push`
   celowo NIE — wchodzi dopiero z czatem/push w E3, patrz §6).

### E2b — Core HR: API + UI (~4 700 LOC)
- API: `hr/employees/*` (8 plików), `contracts/*`, `accommodations/*`, `vehicles/*`,
  `bhp/*`, `legalization`, `coordinators`, `coordinator-pay`, `coordinator-visibility`,
  `pulpit`, `schedule`, `settlements/*`, `transport`, `candidates/*` (bez `from-passport` — E2d).
- Lib: `docPlaceholders`, `docRules`, `readiness`, `rentShare`, `vehicles`,
  `accommodations`, `geo` (samo cache/haversine), `driveImport`, `coordinatorScope`.
- UI: `components/adminNew/hr/*` (21 plików) → **`components/agencja/*`**
  (kolizja: EBS ma własne `components/hr/*`!). Zakładki w `DashboardAdminNew` EBS
  (sekcja „Agencja Pracy") + **dynamiczne menu z uprawnień** (`PERMISSION_MENU`
  z registry — sidebar dla ról nie-superadmin; superadmin widzi wszystko statycznie).
- Gate'y per zakładka: `can(auth, 'agencja.…')` server-side na każdym route.
- Bez zakładek z E2c/E2d (generator, tłumacz, mapa, OCR w poczekalni ograniczony
  do ręcznego wpisu do czasu E2d).

### E2c — Generator dokumentów (~950 LOC)
- `hr/doc-templates` (+`[id]`), `hr/doc-generate`, `lib/hr/peselForm.ts`,
  `HrGeneratorDokumentow.tsx`; placeholdery (39), reguły kopii, batch max 6 par,
  output → bucket `hr-documents` + wiersz `hr_documents` + signed URL 1 h.
- Assety `public/`: **logo Stratton/EBS** (zamiast `znmp-logo.*`),
  `templates/pesel-elw1.pdf`, `fonts/noto-deva.woff2` — skopiowane z BBS.
- Import danych: szablony `hr_doc_templates` z bazy BBS (skrypt jak w E1 T9).

### E2d — AI: OCR + tłumacz + mapa (~700 LOC)
- OCR: `lib/hr/ocr.ts` (Claude Vision), `hr/ocr`, `hr/candidates/from-passport`,
  `hr/vehicles/[id]/license`; `lib/anthropic.ts` (singleton, `AI_MODEL`).
- Tłumacz: `translateCore` (Claude), `hr/translate` + `voice` (Whisper) +
  `tts` + `rt-session` (OpenAI Realtime), `translatorLimit` (10 min/dzień),
  `HrTlumacz.tsx`.
- Mapa: `hr/map`, `HrMapa.tsx` (Leaflet+markercluster), `lib/hr/tracking.ts`
  (geofence), `me/location`.
- **Klucze API kopiowane programowo z BBS** (patrz §1); brak klucza = łagodna
  degradacja (komunikat, funkcja wyłączona) — wzorzec Fakturownia/SMTP.

### E2e — Portal pracownika + domknięcie (~1 400 LOC)
- `/dashboard/agencja` + `TempWorkerDashboard.tsx` (profil, dokumenty, rozliczenia,
  grafik z GPS auto-clock-in, zmiana konta bankowego z podwójnym potwierdzeniem,
  tłumacz); **czat ukryty do E3**; `me/worker/*` (bez `chat`).
- Digest „wygasające dokumenty/najmy/pojazdy" dopisany do crona `expire-vouchers`
  (logika z `cron/expiry-alerts`, mail przez `lib/mailer`).
- `/app/agencja` (host shell) → redirect wg roli do `/dashboard/admin` (zakładki
  agencji) lub `/dashboard/agencja` (pracownik tymczasowy).
- Słowniki konfiguracyjne z BBS (skrypt importu — zakres ustalony przy planie E2e).

## 3. Bezpieczeństwo (kontynuacja wzorców E1)
- Wszystkie zapisy przez service-role za bramkami `can()/canAny()` + rola;
  RLS deny-all na tabelach administracyjnych, odczyt własnych wierszy dla pracownika
  (`hr_documents`, `hr_settlements`, `hr_schedule`, `hr_advances`, `hr_payouts`…).
- Scoping koordynatora (`coordinatorScope`) — koordynator widzi wyłącznie przyznane
  kontrakty; szef_koordynatorow/superadmin bez filtra.
- Buckety private; dostęp wyłącznie signed URL (1 h).
- Przy okazji E2a: **usunięcie backdoora `INTERNAL_API_KEY`** z `lib/apiAuth.ts`
  (zalecenie final review E1) + weryfikacja, że env nie jest ustawiony na Vercelu.

## 4. Weryfikacja
- Testy jednostkowe: tax-engine (jadą z BBS), `docPlaceholders` (podstawianie,
  missing[]), `rentShare`, `readiness`, `translatorLimit` — vitest.
- `tsc --noEmit` = 0 po każdym tasku; smoke po każdym pod-etapie (dev + prod).
- E2a: weryfikacja schematu na żywej bazie EBS (introspekcja porównawcza z BBS).
- E2b+: smoke z zalogowanym superadminem (zakładki agencji widoczne i działające).

## 5. Ryzyka
| Ryzyko | Mitygacja |
|---|---|
| Schemat 22 tabel tylko w żywej bazie BBS | Introspekcja MCP → migracja weryfikowana kolumna-po-kolumnie; smoke zapisu na każdej tabeli (lekcja z E1/046) |
| Rozmiar ~10k LOC | 5 pod-etapów, osobne plany, subagenci + review per task, final review per pod-etap |
| Kolizja `components/hr` | Port UI do `components/agencja/*`; grep przed każdym taskiem |
| Puppeteer na Vercel (rozmiar funkcji) | `@sparticuz/chromium` (sprawdzony w BBS na serverless); fallback PDF-serwer Railway |
| Nowe deps zwiększają build | Monitorować rozmiar builda po E2a; leaflet tylko client-side (`ssr:false`) |
| `platnik` bez uprawnień domyślnych | Port 1:1 (DEFAULT puste — jak BBS); nadania przez panel Uprawnienia |

## 6. Poza zakresem E2
- Stary system `agencja/*` + `components/agencja` BBS (legacy — świadomie pominięty).
- Czat (E3), księgowość/auto-księgowanie kosztów (E4), CRM (wykluczony na stałe).
- Tenant-scoping (jedna organizacja; ewentualna wielofirmowość = osobny projekt).
- Push notyfikacje czatu (`lib/push`) — wchodzą z czatem w E3; `web-push` w deps
  dopiero gdy potrzebny.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npx next dev --port 3010   # Start Next.js dev server (PRIMARY - deploys to Vercel)
node server/app.js          # Start PDF generation server on port 3015 (required for document export)

# Build
npm run build   # next build (Vite fully removed — deps + config)
npm start       # next start (production server)
```

> Brak skryptu `preview` i brak `jest` w zależnościach. `services/payrollService.test.ts`
> istnieje, ale jest osierocony (test runner nieskonfigurowany) — patrz „Dead Code / Audit".

## Architecture

**STRATTON PRIME: Eliton Benefits System (EBS)** — enterprise benefits management platform with role-based portals.

### Framework

**Next.js 15 (App Router)** is the sole frontend framework. Vite has been removed entirely — config files (`index.html`, `App.tsx`, `vite.config.ts`) **and** the `vite` / `@vitejs/plugin-react` dev-dependencies (audyt 2026-06-12). Deploy na **Vercel** odbywa się **ręcznie przez `npx vercel --prod`** (CLI; konto **Hobby** — crony max raz/dobę). Push na `main` **nie** uruchamia automatycznie produkcyjnego buildu (brak działającej integracji Git → Vercel). Branch service `main`.

- Next.js dev: port `3010`
- PDF server: port `3015` (changed from 3001/3012)
- Animacje: `motion` (Framer Motion) + `ogl` (shader aurora). Usunięto martwe `three`, `@react-three/*`, `gsap` — patrz „Dead Code / Audit".

### Auth

Supabase SSR (`@supabase/ssr`) + cookie-based sessions.
- Supabase project: `ramedybmybcpqvelsmxd.supabase.co`
- **Faktyczny flow logowania**: `app/(auth)/login/page.tsx` loguje przez `supabaseBrowser` (client-side `signInWithPassword`), następnie `GET /api/auth/role` ustala rolę i przekierowanie. Server-side endpoint: `POST /api/auth/login` (oraz `login-v2`).
- ⚠️ `app/actions/auth.ts` (`loginAction`) jest **nieużywany** (martwy kod — patrz „Dead Code / Audit"). Nie polegać na nim.
- Roles: `pracodawca` → `Role.HR`, `pracownik` → `Role.EMPLOYEE`, `superadmin` → `Role.SUPERADMIN`

### Routing (Next.js App Router)

- `/login` → `app/(auth)/login/page.tsx`
- `/dashboard/employee` → `app/dashboard/employee/page.tsx` → `EmployeeDashboardClient`
- `/dashboard/employer` → `app/dashboard/employer/page.tsx` → `EmployerDashboardClient`
- `/dashboard/admin` → `app/dashboard/admin/page.tsx`
- `/dashboard/network` → `app/dashboard/network/page.tsx`

Dashboard clients (`app/dashboard/_components/`) bridge Supabase session ↔ StrattonContext via `DashboardBootstrap`.

### Shell / Launcher (E1, port z BBS-Unified — 2026-07-16)

Architektura super-appa: `/launcher` (kafelki appek), `/app/[appId]` (host z guardem),
`/admin/uprawnienia` (panel entitlements, superadmin). Rejestr appek: `lib/apps/registry.ts`
(E1: tylko `benefity`; CRM wykluczony — osobny CRM Stratton Prime). Dostęp = defaultRoles
per appka + wyjątki `user_app_entitlements` (migracja 044). Po zalogowaniu `/api/auth/role`
kieruje: 1 appka → jej dashboard (zero zmiany UX), >1 → `/launcher` (`lib/auth/postLoginRedirect`).
Szczegółowe uprawnienia (fundament pod E2): `lib/permissions/*` + tabele `app_roles`/
`role_permissions`/`user_permissions`/`admin_view_config` (migracja 045); superadmin zawsze
ma wszystko. Spec: `docs/superpowers/specs/2026-07-16-e1-shell-launcher-design.md`.

Uwaga: role sieciowe (`partner`/`menedzer`/`dyrektor`) nie mają appek w E1 — po zalogowaniu lądują na `/launcher` z komunikatem o braku dostępu (dawniej `/dashboard/network`). W produkcyjnej bazie nikt tych ról nie ma.

**E2a (2026-07-17):** appka `agencja` w rejestrze (placeholder `/app/agencja` do czasu E2b);
role agencji w DB/enum: `hr`, `koordynator`, `szef_koordynatorow`, `platnik`,
`pracownik_tymczasowy` (migracja 049); schemat 22 tabel `hr_*` z introspekcji żywej bazy BBS
(migracja 048); grupa uprawnień „Agencja Pracy" (16 kluczy; ADAPTACJA EBS: domyślnie tylko
koordynator — pracodawcy/role sieciowe nie dostają agencji); silnik płacowy
`lib/agencja/tax-engine`, renderer PDF `lib/pdf/renderer.ts` (puppeteer-core+@sparticuz).
Backdoor `INTERNAL_API_KEY` usunięty z `lib/apiAuth.ts`. Buckety: `hr-documents`,
`accommodation-photos`, `vehicle-photos` (private).

**E2b (2026-07-18):** core HR agencji działa. Widoki w `views/DashboardAdminNew.tsx`:
`hr-pracownicy` → `components/agencja/HrDashboard` (11 pod-zakładek filtrowanych uprawnieniami
`agencja.*`: Pulpit/Poczekalnia/Kontrakty/Dokumenty/Raporty/Rozliczenia/Noclegi/Dowóz/BHP/
Legalizacja/Archiwum) i `hr-flota` → `HrFlota`. Wejście z sidebara: superadmin statycznie,
role agencyjne (`koordynator`/`platnik`) dynamicznie z `PERMISSION_MENU` (`lib/permissions/registry`)
+ `GET /api/me/permissions`. API: `app/api/hr/*` (~33 route'y, service-role za `can()/canAny()`;
brak sesji → **403** nie 401 — wzorzec BBS). **UI agencji jest w `components/agencja/*` — NIE mylić
z niezwiązanym, benefitowym `components/hr/*`.** Helpery: `lib/hr/*` (`docPlaceholders`, `readiness`,
`rentShare`, `accommodations`, `coordinatorScope`, `driveImport`, `vehicles`; **`lib/hr/geo` = stub
zwracający null do E2d**); `lib/supabaseAdmin.admin` = alias `supabaseServer` (BBS-owe `admin()` z
`lib/crm/visibility` — CRM wykluczony). Tabele `hr_*` nie są w `types/database.ts` → kod używa
`(admin() as any).from('hr_...')` (konwencja repo). Audyt: **triggery DB**, nie `logEvent` (usunięte
przy porcie). **Świadomie odłożone (stuby w kodzie):** `settlements/pdf` + generator dokumentów →
**E2c**; OCR (Claude Vision) w `vehicles/[id]/license` i `candidates` → zwraca `ocr:null`,
`candidates/from-passport` nieportowany → **E2d**; auto-księgowanie kosztów do `acc_entries`
(`vehicles/costs`, `bhp/issues`) za guardem `if (accCompanyId)` (=null) → **E4**; portal pracownika
+ tracking GPS + czat → **E2e**. Write-gate floty zawężony do `agencja.flota` (spójność z zakładką);
`vehicles/{people,license,photos}` na szerszym `canAny(AGENCJA_TABS)` — do zawężenia w E2c.
Dep: `heic-convert` (konwersja zdjęć HEIC z telefonów w `lib/images.ts`).

**E2c (2026-07-18):** generator dokumentów działa. Widok `hr-generator` →
`components/agencja/HrGeneratorDokumentow` (top-level w `HrDashboard`, gate `agencja.generator`).
API: `hr/doc-templates` (CRUD szablonów HTML), `hr/doc-generate` (render HTML→PDF przez
`lib/pdf/renderer`, druk formularza PESEL osobną ścieżką `lib/hr/peselForm` przez `pdf-lib`),
`hr/settlements/pdf` (PDF listy płac — odblokowany przycisk „Pobierz PDF" w `HrRozliczenia`).
Nagłówek generowanych dokumentów: `public/ebs-neon-no-bg.png` (zamiast BBS-owego `znmp-logo`).
Assety: `public/templates/pesel-elw1.pdf` (formularz wniosku o PESEL) + `public/fonts/noto-deva.woff2`
(font do hindi). Deps: `pdf-lib` + `jszip` (jawnie w `package.json`, było tranzytywne — poprawka
phantom-dep). Szablony (35 szt.) zaimportowane z BBS przez `scripts/import-bbs-doc-templates.mts`
(upsert po `name`, bez unikalnego constraintu w DB więc ręczny insert-lub-update; logo podmienione
regexem `znmp-logo`→`ebs-neon-no-bg`) — **do przeglądu/edycji w panelu**: część szablonów zawiera
zwykły tekst nagłówka firmowego BBS (`www.znmp.pl`, `zp@znmp.pl`) niezwiązany z logo-obrazkiem,
świadomie nieusunięty (nie jest to logo, tylko dane kontaktowe do ewentualnej ręcznej korekty).

**E2d (2026-07-18):** moduły AI agencji. Widoki `hr-tlumacz` → `components/agencja/HrTlumacz`
(gate `agencja.tlumacz`) i `hr-mapa` → `HrMapa` (gate `agencja.mapa`, Leaflet+markercluster
przez `next/dynamic {ssr:false}` — leaflet jest browser-only). API: `hr/ocr` (Claude Vision —
`lib/hr/ocr` + `lib/anthropic`), `hr/translate` (+`/voice` Whisper, `/tts`, `/rt-session` OpenAI
Realtime, `/usage` heartbeat limitu 10 min/dzień `lib/hr/translatorLimit`), `hr/map` (odczyt
`hr_locations`), `hr/candidates/from-passport` i `hr/vehicles/[id]/license` (odblokowane OCR z
E2b). **`lib/hr/geo` = REALNE** (Nominatim/OSM, bez klucza — odstubowane; kontrakty/noclegi teraz
geokodują; UA nagłówek EBS). **ŁAGODNA DEGRADACJA:** brak `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` →
route zwraca 200 `{ok:false, disabled:true, error}` (Claude) / `{ok:true,ocr:null,disabled:true}`
(license — upload zostaje), a UI pokazuje komunikat „funkcja wyłączona" (obsłużone w HrEmployeeDocs/
HrPoczekalnia/HrTlumacz) — **zero crashy bez kluczy**. Klucze OpenAI wołane przez `fetch` (bez
pakietu npm). Deps: `@anthropic-ai/sdk`, `leaflet`+`leaflet.markercluster` (+typy). **Aby OCR/tłumacz
działały: wpisać `ANTHROPIC_API_KEY` + `OPENAI_API_KEY` (opcj. `AI_MODEL`) w `.env.local` i na Vercel**
(skopiować z BBS `.env.local`); mapa i geokodowanie działają od razu bez kluczy. Świadomie odłożone:
`translate` przycisk „Przetwórz rozmowę" woła `/api/notes/from-text` (moduł notatek → E3, degraduje
gracefully); żywe pingi GPS pracownika (`me/location`, `tracking`) → E2e.

**E2e (2026-07-18) — E2 (agencja) KOMPLETNE:** portal pracownika tymczasowego
`/dashboard/agencja` (`components/worker/TempWorkerDashboard`, gate `pracownik_tymczasowy`
+ superadmin do testów; wzorzec auth jak `app/dashboard/employee/page.tsx`): profil, dokumenty,
rozliczenia, grafik z GPS auto-clock-in (ping co 2 min, geofence), zmiana konta bankowego
(walidacja IBAN + podwójne potwierdzenie), tłumacz. API `me/worker`(+`bank`), `me/location`
(GPS ping → `hr_locations`, zasila mapę E2d), `lib/hr/tracking` (geofence). `lib/apps/appTargets`:
appka `agencja` kieruje `pracownik_tymczasowy` → `/dashboard/agencja`, koordynator/płatnik/
superadmin → `/dashboard/admin` (naprawia placeholder z E2a). Digest wygasania dokumentów/
najmów/floty **doklejony do crona `expire-vouchers`** (sekcja w izolowanym `try/catch`, EBS
`sendEmail`; adresaci superadmin/dyrektor/szef_koordynatorow) — bez nowego crona (Vercel Hobby).
**Odłożone: czat pracownik↔koordynator (`me/worker/chat` + panel „Komunikator" ukryty za
`{false &&}`) → E3; auto-księgowanie kosztów → E4.**

**E4 (2026-07-19) — MIGRACJA BBS→EBS KOMPLETNA:** moduł księgowości. Widok `admin-ksiegowosc`
→ `components/adminNew/AdminKsiegowosc` (sub-taby: bilans/firmy/kontrahenci/KPiR/VAT/magazyn/
środki trwałe/sprawozdania; gate `ksiegowosc.faktury`/`ksiegowosc.bilans`). Tabele `acc_*`
(8 szt., migracja 050 z introspekcji żywej bazy BBS): companies, company_members, contractors,
entries (księga), fixed_assets, invoices(+items), products; bucket `invoices` (private).
`lib/accounting/{access,assets}`. API `app/api/accounting/*` (service-role za `companyAccess`/
`can(ksiegowosc.*)`). **Auto-księgowanie kosztów BHP/pojazdów WŁĄCZONE** — `hrLinkedCompanyId()`
(1 firma `acc_companies.hr_linked=true`) odblokowuje zapis kosztów do `acc_entries` w
`hr/bhp/issues` + `hr/vehicles/[id]/costs` (E2b guardy aktywne; delete round-trip przez
`acc_entry_id`). `entries/analyze` (odczyt AI faktury) = AI-guard jak E2d.
**ŚWIADOME WYKLUCZENIA (decyzja 2026-07-19): BEZ własnego klienta KSeF i BEZ wystawiania faktur
sprzedażowych — Fakturownia zostaje jedynym fakturującym/KSeF.** `lib/ksef/*`, `accounting/ksef/*`,
`accounting/invoices/*`, `KsiegFaktury` NIE portowane; kolumny `ksef_*`/`acc_invoices` zostają
puste. **KPiR/VAT jadą KOSZTOWO** (przychody sprzedażowe w Fakturowni; ewentualny sync
Fakturownia→`acc_invoices` = przyszły krok, NIE duplikat wystawiania). Follow-up: picker „dodaj
członka firmy" w `KsiegFirmy` woła `/api/users` (403 dla dyrektora — do domknięcia z E3/katalogiem).

### State Management

All application state lives in `context/StrattonContext.tsx` (StrattonProvider). It composes modular hooks:
- `hooks/modules/useUserLogic.ts` — auth, user CRUD
- `hooks/modules/useOrderLogic.ts` — order placement & approval
- `hooks/modules/useVoucherLogic.ts` — voucher lifecycle
- `hooks/modules/useNotificationLogic.ts` — notifications

State is persisted to `localStorage` via `hooks/usePersistedState.ts`. Components access state and actions via the `useStrattonState` / `useStrattonSystem` hooks **exported from `context/StrattonContext.tsx`** (the standalone `hooks/useStrattonSystem.ts` is orphaned — patrz „Dead Code / Audit").

Initial demo data is seeded from `services/mockData.ts`.

### Backend (PDF Server)

`server/app.js` is a separate Express server (port **3015**) using Puppeteer. It handles `POST /api/generate-pdf` for document types: `DEBIT_NOTE`, `VAT_INVOICE`, `BUYBACK_AGREEMENT`, `IMPORT_REPORT`, `PROTOCOL`. Must be running independently alongside the Next.js dev server.

### Fakturownia Integration

Faktury VAT i noty księgowe są wystawiane w **Fakturowni** (źródło prawdy), z automatycznym KSeF po stronie konta FA. KSeF nie ma kodu w EBS.

- **Env vars** (`.env.local` + Vercel Production): `FAKTUROWNIA_API_TOKEN`, `FAKTUROWNIA_DOMAIN` (np. `stratton-prime`), `FAKTUROWNIA_WEBHOOK_SECRET`. Brak env → integracja wyłączona (`getFakturowniaClient()` zwraca `null`, flow działa jak dawniej). Opcjonalnie `CRON_SECRET` — gdy ustawiony, cron sync wymaga nagłówka `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron dodaje go automatycznie); brak env = brak weryfikacji (zgodność wsteczna).
- **Moduły** `lib/fakturownia/`:
  - `client.ts` — czysty wrapper HTTP REST API (zero wiedzy o EBS), testy `client.test.ts` (Vitest, mock `fetch`).
  - `invoiceService.ts` — `ensureClient` (mapuje firmę EBS → klienta FA po NIP, cache w `companies.fakturownia_client_id`), `buildNotaInput`/`buildFakturaInput`, `issueDocumentsForOrder` (idempotentne, opcjonalny filtr `only: 'nota'|'faktura_vat'`, zwraca `IssueResult {issued,failed,skipped}`, zapisuje `fakturownia_invoice_id`/`token`/`payment_url`/`pdf_url`/`fakturownia_sync_status` do `financial_documents`), `issueFakturaForOrder` (wystawia fakturę VAT dla zamówienia — wołane PO opłaceniu noty). **Uwaga: konto FA jest w trybie cen brutto** — faktura VAT musi iść z `total_price_gross` + `tax:23` (sam `price_net` → 422 `positions.total_price_gross nie może być puste`); nota zawsze `total_price_gross` + `tax:'np'`. Ochrona przed duplikatem: błąd `createInvoice` → `sync_status='failed'` (bezpieczny retry); ale jeśli dokument powstał w FA, a zapis id do DB padnie, ponawia zapis (3×) i NIE oznacza `failed` — loguje `KRYTYCZNE` do ręcznej reconcyliacji.
  - `factory.ts` — `getFakturowniaClient()` z env.
- **Wystawianie (przepływ 2-etapowy, od 2026-06-30)**: **nota księgowa jest generowana WYŁĄCZNIE lokalnie** (`createOrderDocuments` → PDF-serwer → Storage) — wzór noty w FA (`accounting_note`) jest wadliwy (dwóch „Wystawców", brak konta bankowego), więc `hr-confirm` NIE wystawia nic w FA. **Faktura VAT powstaje w FA dopiero po oznaczeniu noty jako opłaconej** (auto-KSeF po stronie konta FA; KSeF: auto-wysyłka ON, walidacja struktury OFF — ustawione 2026-06-30). Trzy wewnętrzne ścieżki oznaczenia opłaty wołają `issueFakturaForOrder`: `PATCH /api/invoices/[id]/pay`, `PATCH /api/orders/[id]/pay` (oznacza też notę jako paid) i `PATCH /api/companies/[id]/financials/[doc_id]` (używane przez `AdminPlatnosci.markPaid`). Prowizja na fakturze VAT = `companies.fee_percent` (migracja 015, `NOT NULL DEFAULT 20`, zakres 15–31%; docelowo 10–32 — patrz spec CRM); fallback 20% gdy brak.
- **Sync płatności**: webhook `POST /api/webhooks/fakturownia?secret=...` (instant) + cron `GET /api/cron/sync-fakturownia-payments` raz dziennie 06:00 (`vercel.json`, chroniony `CRON_SECRET`; plan Vercel Hobby dopuszcza crony max raz/dobę). Dotyczy **faktur VAT** (noty nie są w FA; gałąź nota→faktura w webhook/cron zostaje jako legacy-safety). Webhook nie ufa polu `status` z payloadu — po sprawdzeniu sekretu potwierdza stan faktury bezpośrednio w FA (`fa.getInvoice`).
- **Retry**: `POST /api/financial-documents/[id]/retry-fakturownia` (superadmin) — przycisk „Ponów wysyłkę" w `AdminPlatnosci` przy `sync_status='failed'`, **tylko dla faktur VAT** (nota → 400, jest lokalna).
- **DB**: migracja `038_fakturownia.sql` — `companies.fakturownia_client_id` + `financial_documents.{fakturownia_invoice_id,fakturownia_token,payment_url,fakturownia_sync_status}`.
- **Lokalna generacja PDF**: nota — **podstawowa** (nasz wzór, Sprzedawca/Nabywca/konto); faktura VAT — `pdf_url` z Fakturowni po wystawieniu, lokalny PDF jako fallback. Nota drukuje `companies.bank_account` (dedykowane subkonto Millennium per firma, migracja 040; `DocumentContext.sellerBankAccount`) — brak wartości = fallback `ISSUER.bank`. PDF-serwer produkcyjny: Railway (`PDF_SERVER_URL`; wartość env naprawiona 2026-06-30 — miała trailing newline, przez co lokalna generacja PDF na Vercelu cicho nie działała; kod ma teraz `.trim()`).

### Employee Dashboard Layout (`EmployeeDashboardClient.tsx`)

`app/dashboard/_components/EmployeeDashboardClient.tsx` — full layout with:
- Black header (`bg-black`) with EBS logo (`/ebs-black.svg` + CSS `brightness(0) invert(1)` for white), search bar, balance widget, expiry widget, notifications, logout
- Hamburger `<Menu>` button (mobile only, `md:hidden`) → opens sidebar drawer (`isMobileSidebarOpen`)
- Desktop sidebar toggle (`hidden md:flex`) → `isDesktopSidebarOpen`
- `Sidebar` component (black theme)
- `SoftAurora` background (WebGL shader from `components/ui/SoftAurora.tsx`, `ssr: false`)
- `<main className="main-zoom">` — zoom 0.9 only on desktop via CSS (see `index.css`)
- Orange popup (`/popup_orange.png`) shown every login — `useState(true)`, no localStorage gate
  - Mobile: slides from bottom (`items-end`, `rounded-t-3xl`), Desktop: centered (`sm:items-center`, `rounded-2xl`)
- 3-column layout on `xl` screens: `240px` banner slots + center content
- Aurora params: `speed=0.4, scale=1.2, brightness=1.6, color1="#30df6a", color2="#4297cd", noiseFrequency=2, noiseAmplitude=3, bandHeight=0.7, bandSpread=1, octaveDecay=0.27, layerOffset=0.25`

### Employee Dashboard Content (`DashboardEmployee.tsx`)

`views/DashboardEmployee.tsx` — 3-column content layout:
- Left bottom banner (h=200): `<img src="/orange.png" className="w-full h-full object-cover" />`
- Right bottom banner (h=200): `<img src="/PZU.png" className="w-full h-full object-cover" />`

### Admin Dashboard Layout (`AdminDashboardClient.tsx`)

`app/dashboard/_components/AdminDashboardClient.tsx` — light-themed layout with:
- `AdminLayout` function: sidebar + white header + `<DashboardAdminNew>`
- Header: `bg-white border-slate-200`, hamburger on mobile, logo, search (Ctrl+K), notifications, logout
- Background: `backgroundColor: '#f1f5f9'`
- `currentView` state synced with `DashboardAdminNew` for tab navigation
- No StrattonContext props for content — `adminNew` components fetch data via API routes directly

### New Admin Panel (`DashboardAdminNew.tsx` + `components/adminNew/`)

`views/DashboardAdminNew.tsx` — tab-based admin UI:
- Tabs: **Pulpit**, **Baza klientów**, **Płatności i faktury**, **Archiwum**, **Vouchery**
- `VIEW_TO_TAB` mapping syncs Sidebar navigation with tab state
- `-m-4 md:-m-8` to compensate parent padding
- Each tab is a standalone component in `components/adminNew/` — fetches own data from API routes (`/api/companies`, `/api/vouchers`, etc.)
- **Szablony dokumentów** (tab `admin-szablony`, `AdminSzablony.tsx`) — edytor szablonu umowy odkupu (SP3).
- **Logi systemowe** (tab `admin-logi`, `AdminLogi.tsx`) — czyta `audit_log` przez `GET /api/admin/logs` (superadmin, filtry `table`/`operation` + paginacja). `audit_log` wypełniany automatycznie przez triggery `fn_audit_log` (SP6).

### Sidebar (`components/Sidebar.tsx`)

**Układ/struktura 1:1 z BBS-Unified (2026-07-19)**, branding EBS: jeden ciemny motyw dla WSZYSTKICH
ról (gradient czerń→zieleń jak launcher; poprzednie per-rolowe białe/czarne motywy usunięte),
nagłówek brandowy (logo `/ebs-black.svg` inverted + „Eliton Benefits" + `roleLabel`), wskaźnik
aktywności `primary-300`, `sticky md:top-0 md:h-screen`, stopka „Wersja EBS 1.1.0".

Struktura przeniesiona z BBS:
- **`MENU_ICONS`** — mapa `string→ikona` dla dynamicznego menu z `PERMISSION_MENU`.
- **`STATIC_MENU_ROLES`** = `{SUPERADMIN, HR, HR_PANEL, EMPLOYEE, ADVISOR, MANAGER, DIRECTOR}` —
  statyczne menu; **reszta (`koordynator`, `platnik`, role własne) buduje menu DYNAMICZNIE z uprawnień**
  (`buildPermissionMenu(permKeys)` — `fetch('/api/me/permissions')`, dywidery per `section`).
- **`roleLabel`** — z `role_label` (app_roles, role własne) albo statyczna per rola.
- **`hiddenViews?`** (opcjonalny) — filtr „Widoku" per rola; `visibleMenu` = `menuItems` po filtrze (puste dywidery odpadają).

**SUPERADMIN menu (kolejność jak BBS; treść EBS)**: `admin-pulpit`, `admin-ksiegowosc`,
`admin-uprawnienia`, `admin-szablony`, `admin-logi` (Rejestr zdarzeń) · **── Benefity ──**
`admin-klienci`, `admin-platnosci`, `admin-archiwum`, `admin-vouchery`, `admin-buyback` ·
**── Agencja Pracy ──** `hr-pracownicy`, `hr-mapa`, `hr-flota`, `hr-generator`, `hr-tlumacz`.

**Świadome różnice vs BBS** (CRM wykluczony — osobny CRM Stratton Prime): usunięta sekcja CRM
i pozycje ownera (`owner-panel`/`admin-ustawienia` — EBS nie ma roli `owner`, prop `isOwner`
usunięty); role sprzedażowe (DIRECTOR/MANAGER/ADVISOR) → Panel Sprzedaży + Moje Prowizje (bez CRM).

### CSS (`index.css`)

Custom classes:
- `.main-zoom` — `zoom: 1` default, `zoom: 0.9` on `@media (min-width: 768px)` → desktop-only scaling
- `.pb-safe` — safe area padding for mobile

### Accounts (Supabase)

Produkcyjna baza: `ramedybmybcpqvelsmxd.supabase.co` — zawiera 12 auth users, 8 z profilem w `user_profiles`.

**Konta z profilem (produkcja):**

| Email | Rola | Imię i nazwisko | Firma (company_id prefix) | Hasło tymczasowe |
|---|---|---|---|---|
| `admin@eliton-benefits.com` | `superadmin` | System Administrator | — | — |
| `natalia.kvk@stratton-prime.pl` | `superadmin` | Natalia Kvk | — | — |
| `j.jablonski@stratton-prime.pl` | `superadmin` | J. Jabłoński | — | — |
| `m.hagno@stratton-prime.pl` | `pracodawca` | Maciej Hagno | `f03ed36e` (Stratton Prime) | — |
| `t.juszkiewicz@gmail.com` | `owner` | Tomasz Juszkiewicz | `f03ed36e` (Stratton Prime) | `uz7u2hq9rdpMBJLO37JHLM!` |
| `biuro@aneza.pl` | `pracodawca` | Agnieszka Cięciara | `8dbe726e` (Aneza) | — |
| `pasek.agnieszka@wp.pl` | `pracownik` | AGNIESZKA PASEK | `8dbe726e` (Aneza) | `u7fjcez88jbGJHVNE6DB64!` |
| `j.drobnikowska.bazyluk@gmail.com` | `pracownik` | JOANNA DROBNIKOWSKA-BAZYLUK | `8dbe726e` (Aneza) | `pqp51yllud3INZ0MXVDNM!` |
| `katarzynacygan@op.pl` | `pracownik` | KATARZYNA CYGAN | `8dbe726e` (Aneza) | `BF61fczv25!` |
| `maciej.hagno@gmail.com` | `pracownik` | Maciej Hagno | `f03ed36e` (Stratton Prime) | `wjohc1wcuwfR9VRL78GEVF!` |

**Konta auth BEZ profilu (testowe/nieużywane):** `k.nowak@firma.pl`, `j.kowalski@firma.pl`, `dlkso@wp.pl`, `vcx@wp.pl`

**Znane hasła (nie przechowywane w DB):**
- `admin@eliton-benefits.com` → `Password123!`
- `biuro@aneza.pl` (Agnieszka Cięciara) → `Afryka1974`
- `natalia.kvk@stratton-prime.pl` → `Stratton1.`
- `j.jablonski@stratton-prime.pl` → `Stratton1.`

> Kolumna `temp_password` w `user_profiles` przechowuje hasło jednorazowe generowane przy tworzeniu konta pracownika (plaintext — do zmiany przy pierwszym logowaniu).

> **IBAN pracownika** (SP2): walidowany mod-97 i normalizowany przez `lib/iban` (`isValidIBAN` + `normalizeIBAN`; 26-cyfrowy NRB → `PL…`) we WSZYSTKICH ścieżkach wejścia — `PATCH /api/users/[id]/finance`, `bulk-import`, parsery Excel (`utils/excelHr.ts`), edycja inline w `DashboardNewHR`. Każdy nowo wprowadzony/zmieniony IBAN ustawia `iban_verified=false` (weryfikacja to osobny krok). `services/payrollService.validatePLIBAN` pozostaje, ale używany wyłącznie przez martwe komponenty.

### Key Types

`types.ts` is a barrel that re-exports all domain type files from `types/`:
- `types/enums.ts` — wszystkie enumy: `Role`, `VoucherStatus`, `OrderStatus`, `ContractType`, `NotificationTrigger`, `ServiceType`, `DocumentType`, `CommissionType`, itp.
- `types/user.ts` — `User`, `UserIdentity`, `UserOrganization`, `UserContract`, `UserFinance`, `UserAddress`, `IbanChangeRequest`
- `types/company.ts` — `Company`
- `types/voucher.ts` — `Voucher`, `Transaction`, `DistributionBatch`, `BuybackAgreement`
- `types/order.ts` — `Order`, `PayrollEntry`, `PayrollSnapshot`, `PayrollDecision`, `ImportRow`, `ImportHistoryEntry`
- `types/core.ts` — `EntityType`, `AuditLogEntry`, `Commission`, `QuarterlyPerformance`, `AnalyticMetric`
- `types/notification.ts` — `Notification`, `NotificationAction`, `NotificationConfig`
- `types/system.ts` — `SystemConfig`, `ServiceItem`, `DocumentTemplate`, `SupportTicket`, `IntegrationConfig`

Consumers import from `../types` or `@/types`. `types/database.ts` pozostaje osobnym plikiem Supabase schema (nie przez barrel).

### Umowa odkupu (buyback) — edytowalny szablon + serwerowy PDF (SP3)

- **Szablon** trzymany w tabeli `document_templates(key, html, updated_by, updated_at)`; wiersz `key='buyback_agreement'` (migracja 041). Edytowalny w panelu: **Admin → „Szablony dokumentów"** (`components/adminNew/AdminSzablony.tsx`, tab `admin-szablony`) przez `GET/PATCH /api/admin/document-templates/[key]` (superadmin).
- **Pola-zmienne** `{{…}}` podstawiane przez `lib/documents/templateEngine.renderTemplate`: `imie_nazwisko, pesel_nip, adres, nr_ilustracji, liczba_voucherow, wartosc_pln, iban_zbywajacego, email_zbywajacego, data`.
- **PDF** generowany serwerowo przez `lib/documents/buybackAgreementService.createBuybackAgreementPdf(agreementId)` (szablon + `buyback_agreements` + `user_profiles` → `generatePdfBuffer`+`uploadPdf`), URL zapisywany w `buyback_agreements.pdf_url`.
- `document_templates` nie jest jeszcze w `types/database.ts` — zapytania używają `(supabase as any)` (konwencja repo). Wpięcie generacji PDF w automat odkupu + wypełnienie snapshotu danymi pracownika = SP5.

### Wygaśnięcie → przypomnienie → odkup → paczki przelewów (SP4/SP5)

Wszystko doklejone do dziennego crona `app/api/cron/expire-vouchers` (Vercel Hobby: max 2 crony — bez nowego).
- **E-mail**: `lib/mailer.sendEmail` (**SMTP przez nodemailer**, skrzynka poczty Stratton / hosting home.pl). Env: **`SMTP_USER` + `SMTP_PASS`** (login i hasło skrzynki) — wymagane; opcjonalnie `SMTP_HOST` (dom. `serwer2690202.home.pl`), `SMTP_PORT` (dom. `465`), `SMTP_SECURE` (`true` dla 465/SSL, `false` dla 587/STARTTLS), `SMTP_FROM` (dom. = zalogowana skrzynka). **Brak `SMTP_USER`/`SMTP_PASS` = wysyłka pomijana** (log, flow działa dalej). Wysyłka zawsze z uwierzytelnionej skrzynki (unika odrzucenia SPF/relay); `contact-bok` też korzysta z tego mailera (`replyTo` = pracownik). `resend` usunięty z zależności.
- **SP4 — przypomnienie 1-dzień-przed** (przed RPC): cron znajduje vouchery `status='distributed'` z `valid_until` w oknie „jutro" i `expiry_reminder_at IS NULL` (migracja 042), grupuje po właścicielu (`lib/vouchers/expiryReminders.groupExpiringByOwner`), wysyła e-mail + powiadomienie in-app, ustawia `expiry_reminder_at` (idempotencja).
- **SP5 — odkup** (po RPC `expire_vouchers_and_create_buybacks`): dla nowych `buyback_agreements` (`pdf_url IS NULL`) generuje PDF umowy (`createBuybackAgreementPdf`, SP3), wysyła pracownikowi e-mail z załączoną umową, i buduje **paczki przelewów per firma** w `buyback_batches` (format `elixir0` + `millennium`, `status='generated'`): `lib/bank/elixir0.buildElixir0` (KIR, rekord 110) + `lib/bank/millenniumCsv.buildMillenniumCsv`. Obciążenie = konto Stratton (`ISSUER.bank`), uznanie = IBAN pracownika. **Elixir-0 wymaga weryfikacji testowym importem w banku** przed pierwszym realnym użyciem; żaden przelew nie jest wykonywany automatycznie (tylko pliki do pobrania).

### AI Integration

`DashboardEmployee` includes an AI Legal Assistant powered by Google Gemini (`@google/generative-ai`). The API key is loaded from `VITE_GEMINI_API_KEY` in `.env.local`.

`LegalAssistantDashboard` is loaded with `next/dynamic` + `ssr: false` (uses `html2pdf.js` which requires browser `self`).

### UI Components (react-bits)

Available in `components/ui/` and `components/bits/`:
- `components/ui/SoftAurora.tsx` + `SoftAurora.css` — WebGL shader aurora (OGL-based), use with `ssr: false`
- `components/ui/Orb.tsx` + `Orb.css` — animated orb
- `components/ui/MagicRings.tsx` + `MagicRings.css`
- `components/ui/ServiceCarousel.tsx` — Embla carousel, 4-column layout (`md:flex-[0_0_25%]`), `AppIconCard` min-height `220px`
- `components/bits/StarBorder/`
- `components/employee/mobile/WalletCard.tsx` — animated voucher balance card, `p-8` padding, white text

### Extracted Sub-Components & Helpers

- `utils/hrUtils.tsx` — typy i helpery HR (`HrOrder`, `STATUS_MAP`, `formatPeriod`, `buildOrderReportHtml`)
- `utils/formatters.ts` — `formatCurrency`, `formatDate`
- `lib/documents/pdfUtils.ts` — `ISSUER`, `generatePdfBuffer`, `uploadPdf`
- `lib/documents/umowaService.ts` — `createUmowaDocument`, `UmowaContext`
- `components/hr/dashboard/HRPageHeader.tsx` — nagłówek Panelu Kadrowego + definicja typu `HRTab`
- `components/hr/dashboard/documentBinderHelpers.ts` — `sanitizeFilename`, `generateClientSidePdf`, `enrichBatchWithRanges`
- `components/hr/modals/HROrderPickerModal.tsx`, `HROrderHistoryModal.tsx`, `HRAddEmployeeModal.tsx`
- `components/hr/dashboard/EmployeeCard.tsx` — `EmpDetailRow`, `EmployeeCard`
- `components/employee/dashboard/EmployeeWidgets.tsx` — `SectionDivider`, `AppIconCard`, `FloatingTabBar`
- `components/employee/dashboard/legal/constants.ts` — barrel re-export `wizardData`, `categoryConfig`, `documentTemplates`

`HRTab` jest definiowany i eksportowany z `HRPageHeader.tsx` — importuj stamtąd, nie deklaruj lokalnie.

### Path Aliases

`@/` maps to the repository root (configured in `tsconfig.json`).

### Known Issues / Gotchas

- Browser-only libraries (`html2pdf.js`, `ogl`/SoftAurora) must be loaded with `next/dynamic` + `{ ssr: false }`
- `ebs-black.svg` exists in `public/`; white version achieved via CSS `filter: brightness(0) invert(1)` — do NOT rely on `ebs-white.svg`
- `zoom` CSS property is in `.main-zoom` CSS class (not inline style) — applies desktop-only via media query
- All UI changes must work identically on **localhost:3010** AND **Vercel** — no localStorage-gated visibility

### Dead Code / Audit (2026-06-12)

Audyt repo. **Faza 1 (wykonana)** — usunięto śmieci i martwe zależności:
- Usunięto fizycznie: `dist/` (61 MB build po Vite), `ebs-stack-report.pdf`, zarejestrowany worktree `.claude/worktrees/`.
- `.gitignore`: dodano `.claude/worktrees/`, `tsconfig.tsbuildinfo` (odpięty z gita), `/ebs-stack-report.pdf`.
- Usunięto z `package.json` (0 importów): `vite`, `@vitejs/plugin-react`, `three`, `@react-three/drei`, `@react-three/fiber`, `gsap`, `@gsap/react`, `@supabase/auth-ui-react`, `@supabase/auth-ui-shared`, `@types/three`.

**Faza 2 — WYKONANA (stan 2026-06-30)**: `npx tsc --noEmit` daje **0 błędów**; kolumna `umowa_pdf_url` **istnieje** na `voucher_orders` (zweryfikowane w żywej bazie). Uwaga: `next.config.ts` ma `typescript.ignoreBuildErrors: true` — build nie pilnuje typów, pilnuj `tsc --noEmit` ręcznie.

**Faza 3 (do zrobienia) — martwy kod (zweryfikowany, 0 importów)**, kandydaci do usunięcia:
- `app/actions/auth.ts` (`loginAction` nieużywany — login idzie przez `supabaseBrowser` + `/api/auth/role`)
- `hooks/useStrattonSystem.ts` (duplikat — realny w `context/StrattonContext.tsx`)
- Osierocone przez monolit `views/DashboardNewHR.tsx` fragmenty starego panelu HR:
  - `components/hr/dashboard/`: `HRPageHeader`, `HRDocumentBinder`, `HRCommandCenter`, `HREmployeeTable`, `HRDistributionWidget`, `HRShortcuts`, `HRDashboardGuide`, `HREmployeeGuide`, `SettlementGuide`, `HRImportHistoryTable`
  - `components/hr/modals/`: `EmployeeEditModal`, `EmployeeHistoryModal`, `DistributionModal`, `DistributionChoiceModal`, `DistributionEvidenceModal`, `BulkTransferModal`
  - `components/hr/`: `EmployeeImportModal`, `HRIntegrationsManager`, `HRReportCenter`
  - inne: `components/DocumentModal.tsx`, `components/ui/Orb.tsx`, `components/employee/dashboard/EmployeeStats.tsx`, `OrangeOfferSection`, `PZUServiceSection`, `components/employee/mobile/MobileNav.tsx`, `components/ui/EmptyState.tsx`, `components/notifications/NotificationPreferences.tsx`, `MarketplaceHero`, `ElitonBanner`, `CaseListView`
  - `services/payrollService.test.ts` (brak test runnera)

> 🔴 **ŻYWE — NIE usuwać** (mimo że leżą w `components/hr/**`; importowane przez działający panel): `components/hr/dashboard/EmployeeCard` (`EmpDetailRow`), `components/hr/KartotekaImportZone`, `components/hr/HRSettingsModal` (import w `EmployerDashboardClient`), `components/hr/modals/HROrderPickerModal`, `HROrderHistoryModal`, `HRAddEmployeeModal` (import w `DashboardNewHR`). Usunięcie „całego `components/hr/dashboard/`" **zepsuje build** — kasuj wyłącznie po imienne pliki z listy powyżej i sprawdź `grep -r` przed usunięciem.

**Bezpieczeństwo (osobno)**: `npm audit` zgłasza 18 podatności (1 krytyczna) — głównie `xlsx`. Rozważ migrację z `xlsx` na `exceljs` (już w projekcie).


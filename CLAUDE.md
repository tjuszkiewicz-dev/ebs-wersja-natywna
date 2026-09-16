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

```bash
# Testy
npm test        # vitest run — 42 pliki, 401 testów (stan 17.09.2026)
npm run test:watch
```

> **Test runner JEST skonfigurowany** (`vitest.config.ts`, środowisko `node`, alias `@`).
> Zakres: `lib/**`, `services/**`, `app/**`, `utils/**` — wszystkie `*.test.ts`.
> Wcześniejsza notatka w tym pliku twierdziła, że runnera nie ma; było to nieaktualne
> (sprostowane 02.09.2026). `services/payrollService.test.ts` — stary skrypt asercji bez
> `describe/it` — został usunięty razem z resztą martwego kodu, więc `exclude` go nie
> potrzebuje. **Uwaga: `next.config.ts` ma `typescript.ignoreBuildErrors: true`**, czyli
> build nie pilnuje typów — `npx tsc --noEmit` i `npm test` uruchamiaj ręcznie.

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
(E1: tylko `benefity`; CRM był wtedy wykluczony — **decyzja odwrócona 2026-08-31, patrz E7**). Dostęp = defaultRoles
per appka + wyjątki `user_app_entitlements` (migracja 044). Po zalogowaniu `/api/auth/role`
kieruje: 1 appka → jej dashboard (zero zmiany UX), >1 → `/launcher` (`lib/auth/postLoginRedirect`).
Szczegółowe uprawnienia (fundament pod E2): `lib/permissions/*` + tabele `app_roles`/
`role_permissions`/`user_permissions`/`admin_view_config` (migracja 045); superadmin zawsze
ma wszystko. Spec: `docs/superpowers/specs/2026-07-16-e1-shell-launcher-design.md`.

Uwaga: role sieciowe (`partner`/`menedzer`/`dyrektor`) nie mają appek w E1 — po zalogowaniu lądują na `/launcher` z komunikatem o braku dostępu (dawniej `/dashboard/network`). W produkcyjnej bazie nikt tych ról nie ma.

**Kafelki launchera od 2026-09-15 (decyzja właściciela):** „Benefity" = **aplikacja pracownicza**
dla każdej roli, która ją widzi — `pracownik` → `/dashboard/employee`, `pracodawca` → `/dashboard/employer`,
**superadmin/owner → `/dashboard/employee` w trybie podglądu** (menu boczne pracownika wymuszone w
`EmployeeDashboardClient`, bo pozycje admina nie działają w tym layoucie). Panel administratora ma
**własny kafelek „Administracja"** (`administracja` w `lib/apps/registry`, `defaultRoles: [SUPERADMIN]`,
→ `/dashboard/admin`). **Superadmin/owner widzi w launcherze TYLKO Benefity i Administrację** (decyzja
właściciela 15.09 po południu): `agencja` nie ma już `SUPERADMIN` w `defaultRoles`, a `appsForUser` daje
superadminowi appki z jego `defaultRoles` (wyjątki z panelu Uprawnień dalej ignorowane). Kafelek „Agencja Pracy"
widzą koordynator, płatnik i pracownik tymczasowy; superadmin do agencji wchodzi z menu Administracji.
**Historia:** przez kilka godzin 15.09 istniał trzeci kafelek dla superadmina (`fba8285`:
„Agencja Pracy" → `/dashboard/admin?view=hr-pracownicy`, panel otwarty od razu
na sekcji agencji). Mechanizm `?view=` w `AdminDashboardClient` (tylko widoki z `VIEW_TO_TAB`) **zostaje** — każdy link
może otworzyć panel na wskazanej sekcji. Do 15.09 oba kafelki
superadmina prowadziły do panelu admina. Cele: `lib/apps/appTargets.ts` + testy `appTargets.test.ts`.

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
`lib/crm/visibility` — wtedy wykluczone; od E7 `lib/crm/visibility` istnieje i reeksportuje ten alias).
Tabele `hr_*` nie są w `types/database.ts` → kod używa
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

> ⚠️ **PUŁAPKA `import-bbs-doc-templates.mts` (E5 T17, 2026-07-29):** ten skrypt kopiuje
> `hr_doc_templates` z bazy BBS **żywcem** (imię firmy, adres, NIP, a w niektórych szablonach
> także zakodowany w treści base64 obrazek podpisu prezesa) — dobre dla ogólnych szablonów
> BBS, ale **nie wolno** nim (re)generować „Porozumienia o szkoleniu wdrożeniowym" ani
> „Oświadczenia — kontakt przez pełnomocnika": w BBS mają one na sztywno dane obcej spółki
> ALCES i/lub dane osobowe konkretnego pełnomocnika (imię, nazwisko, telefon), a w wersji
> porozumienia dodatkowo faksymile podpisu. EBS ma te 8 szablonów (4 języki × 2 dokumenty)
> wgrane osobno przez `scripts/seed-e5-doc-templates.mts` z polami `{{firma_nazwa}}`,
> `{{firma_adres}}`, `{{firma_nip}}`, `{{pelnomocnik_dane}}` do ręcznego uzupełnienia w panelu
> „Szablony dokumentów" — bez żadnych danych ALCES ani podpisu. `import-bbs-doc-templates.mts`
> ma wbudowany filtr wykluczający te 8 nazw, więc rerun ich nie nadpisze — **nie usuwaj tego
> filtra**.

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
**Odłożone (stan E2e): czat pracownik↔koordynator → zrobione w E6a (`me/worker/chat`,
`components/worker/WorkerChat`, zakładka „Komunikator" włączona); auto-księgowanie kosztów → E4.**

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

**E5 (2026-07-29) — port delty z BBS (bloki C–H):** rozszerzenia agencji pracy dosypane po E2.
Migracja `052_hr_status_tlc.sql` — `hr_employees.work_status` (`pracuje`/`oczekuje`/`urlop`/
`zwolniony`, **świadomie oddzielony od `status`** active/inactive, który dalej steruje
rozliczeniami i alertami), `tlc` (bool) + `tlc_expiry` (karta pobytu z innego kraju UE); backfill
ze strażnikiem jednorazowości. Nowe moduły: `lib/hr/workStatus.ts` (definicje statusów),
`lib/hr/alerts.ts` (wspólny silnik alarmów dla ekranu i PDF — progi: dokumenty ≤60 dni,
Schengen ≤30, badania ≤60, flota ≤30, najem ≤3; `buildAlerts`/`daysUntil` mają dodatkowy
parametr `today` — determinizm), `lib/hr/nameMatch.ts` (dedup po imionach/nazwiskach,
transliteracja pod NFD znaków nierozkładalnych: ł, ß, ø, đ, æ, œ, þ, ð), `lib/useHistoryView.ts`
(historia ekranów SPA — wpięta w **3 panele**, nie 4: `NetworkDashboardClient` nie ma stanu
widoku), `lib/users/accountPurge.ts` (logika usuwania/anonimizacji kont).

Funkcje: statusy pracy w kartotece z licznikami per kontrakt i per lokal; zakwaterowani per
lokal z przenoszeniem; przywracanie z archiwum do wybranego kontraktu; `displayName` (dwa
imiona/dwa nazwiska); ekran „Alarmy wymagające uwagi" z filtrami + raport PDF
(`app/api/hr/alerts/pdf`, renderer **`lib/pdf/renderer.ts` — EBS, nie moduł CRM**, bo CRM jest
wykluczony z EBS); TLC w kartotece, alertach i digeście crona `expire-vouchers`; poprawki OCR
(MRZ rozstrzyga kolejność imion/nazwisk i datę ważności paszportu); naprawiony import z Google
Drive (OCR w pamięci PRZED zapisem, `octet-stream`, dedup po paszporcie); dedup po nazwiskach
przy ręcznym dodaniu (409); ręczna miejscowość w pkt 8 wniosku PESEL (+ transliteracja
cyrylicy — znaki spoza WinAnsi cicho gubiły pole); uprawnienie `agencja.dokumenty-usun`
(per-user wyjątek, **z zakresem koordynatora**); nawigacja wstecz; usuwanie/anonimizacja kont;
nowe szablony dokumentów (patrz PUŁAPKA `import-bbs-doc-templates.mts` powyżej — 8 szablonów
z polami `{{firma_nazwa}}`/`{{firma_adres}}`/`{{firma_nip}}`/`{{pelnomocnik_dane}}` czekają na
dane rejestrowe Stratton Prime, w `companies` na razie zaślepkowy NIP). Faksymile podpisu
prezesa (BBS) **nieprzeniesione** — decyzja właściciela.

**Usuwanie kont** (`app/api/users/[id]/purge`) — **PRZEPROJEKTOWANE względem BBS, nie port.**
Tryb wybierany automatycznie po śladzie finansowym: pusty → **PURGE** (kasuje profil i konto
logowania), niepusty → **ANONIMIZACJA** (dane osobowe wymazane, logowanie zablokowane, **księga
nietknięta**). Powód: 11 kluczy obcych blokujących fizyczne usunięcie (zweryfikowane w
`pg_constraint`), w tym `voucher_transactions` pod triggerem `enforce_ledger_immutability`
(bony MPV, dyrektywa UE 2016/1065). Bramki: tylko `auth.isOwner`, nie siebie, nie właściciela,
potwierdzenie przez przepisanie nazwy konta. Audyt do `audit_log` **przed** operacją (wyjątek
od reguły „audyt triggerami" — nieudany zapis audytu przerywa operację).

> **Zależność zwrotna E6→E5:** tabele czatu (`chat_participants`, `chat_reactions`,
> `chat_push_subscriptions`) **dopisane do purge w E6a** (+ `chat_messages.sender_id` i
> `chat_conversations.created_by` odpinane tylko przy PURGE — treść wiadomości zostaje, spec E6 §4.5).
> **Zostało `mail_account_users` → E6d**, znacznik `// TODO E6d:` w `lib/users/accountPurge.ts`.

**Świadomie odłożone (E5):** wskaźniki-widma bez klucza obcego w wielu tabelach `hr_*`/`acc_*`
(m.in. `hr_coordinator_pay.user_id`); czy zgłoszenia do BOK powinny blokować usunięcie konta;
pliki w Storage nietykane przy usuwaniu konta; dogrywanie dokumentów do istniejącej teczki
przy imporcie z Google Drive (jest w BBS, brak w EBS); `dzis_plus_miesiac` dolicza miesiąc
kalendarzowo (31.01 → 03.03, nie koniec lutego).

**E7a (2026-08-31) — CRM WCHODZI DO EBS (odwrócenie decyzji):** user cofnął pierwotne
„skopiuj wszystko z BBSa bez CRMa". CRM ma docelowo **zastąpić** osobną aplikację Stratton CRM.
Spec: `docs/superpowers/specs/2026-08-31-e7-crm-design.md` (dekompozycja E7a–E7e).

E7a dowozi fundament: migracja `054_crm_schema.sql` (tabele `leads`, `crm_activities`,
`crm_contacts`, `crm_tasks`, `crm_offers`, `crm_invoices` + hierarchia w `user_profiles`:
`manager_id`, `hierarchical_id`, `is_agent_authorized`, `leadowiec_opiekun_id`, rola
`leadowiec`, bucket `crm-offers`); `lib/crm/{visibility,activities}.ts`; API
`app/api/crm/leads/{route, [id]/route, [id]/activities/route}`; UI
`components/crm/pipeline/*` (kanban + lista + panel szczegółów, port 1:1 — komponenty są
samowystarczalne, zależą tylko od `react` i `lucide-react`); zakładka `crm-pipeline`
w `DashboardAdminNew`; sekcja **── CRM ──** w `Sidebar`; grupa uprawnień **CRM**
(`crm.pipeline/kontakty/kalendarz/kalkulator/leaderboard/org-chart/notatki/poczta/delete`).

Adaptacje względem BBS (uzasadnienia w specu):
- **Kolumna `workspace` NIE portowana** — EBS jest jednonajemcowy (K2).
- **`admin()` nie jest odtwarzany** — `lib/crm/visibility` reeksportuje `lib/supabaseAdmin.admin`,
  więc proteza z E2b stała się rozwiązaniem docelowym.
- **Pełną widoczność ma też `owner`** (BBS tej roli nie zna; `getAuthUserWithRole` i tak
  normalizuje `owner`→`superadmin`, gałąź jest zabezpieczeniem).
- **`crm_invoices` = EWIDENCJA prowizji, bez wystawiania i bez KSeF** — decyzja E4 (Fakturownia
  jedynym fakturującym) zostaje w mocy (K3).
- **Poczta CRM NIE jest portowana w E7 — należy do E6d** (K4). `crm.poczta` to rezerwacja klucza;
  `DetailsPanel` woła `/api/crm/mail/by-contact` i `/api/crm/offers`, oba degradują się cicho
  (`r.ok ? … : puste`), więc brak tych endpointów w E7a niczego nie wywala.
- **Usunięty `app/api/companies/sync-crm` wraz z przyciskiem „Synchronizuj z CRM"**
  w `CompanyFormModal` — route wstawiał do produkcyjnych `companies` trzy firmy-atrapy
  zaszyte w kodzie (K7).
- **Numeracja migracji:** `053` zarezerwowane dla `053_chat.sql` z E6a, CRM dostał `054`.
  Naprawiony historyczny duplikat: `050_drop_permissive_voucher_accounts_insert.sql` →
  `049a_…` (był drugim plikiem `050_`; w bazie zastosowany przed `050_ksiegowosc_schema`).
  `053_chat.sql` **istnieje od E6a (2026-09-03)** — do tego dnia był samym zarezerwowanym
  numerem i dziura `052`→`054` była zamierzona.

> ⚠️ **MARTWY KOD W ŹRÓDLE — nie portować (K9).** 1 910 z 9 734 LOC modułu CRM w BBS jest
> martwe i **zweryfikowane dwiema drogami** (grep po importach + `information_schema` żywej bazy
> BBS): `components/adminNew/crm/CrmPipeline` + 5 helperów `crmPipeline*` i `CrmKalkulator`
> (zero importów — żywe są `components/crm/pipeline/PipelineKanban` i
> `components/crm/calculator/CalculatorWizard`), oraz sześć route'ów stojących na
> nieistniejących obiektach: `app/api/crm/activities/*` (`crm_client_activities`),
> `leads/[id]/notes` (`lead_notes`), `leads/[id]/qualify` (`leads.qualification_notes`),
> `leads/[id]/convert` (`crm_client_profiles`, `leads.company_id`, `leads.converted_at`).
> **Jedyna żywa oś czasu to `crm_activities` przez `leads/[id]/activities` + `lib/crm/activities`.**

**E7b (2026-09-01) — kontakty + kalendarz i zadania.** Widoki `crm-kontakty` →
`components/adminNew/crm/CrmKontakty` (gate `crm.kontakty`) i `crm-kalendarz` → `CrmKalendarz`
(gate `crm.kalendarz`). API: `app/api/crm/contacts/{route,[id]/route}`,
`app/api/calendar/events/{route,[id]/route}`, `app/api/tasks/{route,[id]/route,people/route}`.
Migracja `056_kalendarz_zadania.sql`: `calendar_events`, `calendar_attendees`, `app_tasks`.
Helper `lib/crm/profiles.ts` (`profilesMap` — w BBS mieszkał w `lib/chat/server`, czatu nie ma do E6a).

> ⚠️ **KALENDARZ NIE STOI NA `crm_tasks`.** Spec E7 tak zakładał — błędnie. `CrmKalendarz` woła
> `/api/calendar/events` i `/api/tasks`, a te używają `calendar_events` + `calendar_attendees` +
> `app_tasks`. **`crm_tasks` (migracja 054) jest w EBS pusta i nieużywana** — w BBS też nikt jej
> nie czyta (`app/api/crm/tasks/` jest pusty). Nie budować na niej niczego bez świadomej decyzji.

Adaptacje E7b:
- **Dołożona bramka `crm.kalendarz` do pięciu route'ów `calendar/*` i `tasks/*`** — w BBS nie
  mają ŻADNEJ bramki poza zalogowaniem, więc moduł widziałby każdy użytkownik EBS (także
  pracownicy i pracodawcy-klienci).
- `calendar_attendees` dostaje **klucz główny (event_id, user_id) i FK z ON DELETE CASCADE**;
  w BBS nie ma ani jednego, ani drugiego, więc usunięcie wydarzenia zostawia sieroty.
  `app_tasks.event_id` → ON DELETE SET NULL: skasowanie spotkania odpina zadanie, nie kasuje go.
- `CrmKalendarz` wołał `/api/chat/users` (E6a) — podmienione na `/api/tasks/people`, rozszerzony
  o pole `me`, żeby kalendarz obchodził się jednym wywołaniem. Zalogowany jest odfiltrowany
  z listy, żeby nie dublował pozycji „Ja".
- Wyszukiwarka kontaktów escapuje `,()\` przed wstawieniem do `or()` PostgREST — bez tego
  przecinek albo nawias w polu szukania rozwalał całe zapytanie.
- `logEvent` (BBS) → triggery `trg_audit_calendar_events` i `trg_audit_app_tasks`.

**E7c (2026-09-02) — kalkulator ofertowy + generator oferty PDF.** Widok `crm-kalkulator`
→ `components/crm/calculator/CalculatorWizard` (default export, mount wprost w
`DashboardAdminNew` — bez przejściówki w `adminNew`, bo BBS-owy `CrmKalkulator` jest martwy,
K9). Wizard 6 kroków: `steps/Step0Company` (wybór leada z `/api/crm/leads` + GUS po NIP),
`Step1Employees`, `Step2Standard`, `Step3Split`, `Step4BusinessCase`, `Step5Summary`
(zapis kalkulacji, generowanie oferty PDF, eksport CSV). API: `app/api/crm/kalkulator/
{calculate,sessions}` i `app/api/crm/offers/{route,generate}`. Migracja `057_crm_kalkulator.sql`.

Adaptacje E7c:
- **Silnik podatkowy NIE jest kopiowany.** BBS-owy `lib/crm/tax-engine` jest **bajt w bajt
  identyczny** z istniejącym w EBS `lib/agencja/tax-engine` (7 plików, `diff` czysty) —
  importy w kalkulatorze przepisane na `@/lib/agencja/tax-engine`.
- **PDF przez `lib/pdf/renderer.ts` (EBS)**, nie CRM-owy `lib/crm/offer/pdfRenderer.ts`
  (decyzja ze specu). Oba pliki miały identyczny kontrakt `renderOfferPdf(html)`, więc port
  to zmiana jednej linii importu; `lib/crm/offer/pdfRenderer.ts` **nie istnieje w EBS**.
- **Tabela `crm_calculations`, nie `payroll_calculations`** (nazwa z BBS) — w EBS
  „payroll" to listy płac agencji pracy (`hr_*`), nazwa BBS-owa myliłaby dwie różne domeny.
- **`calculator_configs` nie portowana** — EBS nie ma panelu do edycji stałych silnika,
  więc kalkulator jedzie na `DEFAULT_CONFIG`; użyte parametry lądują w kolumnie `config`,
  żeby stara kalkulacja dała się odtworzyć po zmianie stałych.
- **`sharp` NIE jest dokładany.** BBS przepuszczał przez niego swoje logo 4,5 MB; EBS wstawia
  `public/ebs-neon-no-bg.png` (49 KB) wprost jako data URI. Brak pliku → oferta z tekstowym „EBS".
- Bucket `offers` (BBS) → **`crm-offers`** (nazwa z migracji 054).
- Bramki: `can(auth,'crm.kalkulator')` zamiast listy ról zaszytej w kodzie BBS
  (`superadmin/partner/menedzer/dyrektor`); brak dostępu → **403**, nie 401.
- **`GET /api/crm/offers` to NIE port — w BBS tego endpointu nie ma.** `DetailsPanel`
  i `ActivityPanel` (port 1:1 z E7a) wołają go od początku i degradują się cicho, więc
  w BBS sekcja „Oferty" przy leadzie jest zawsze pusta. W EBS pętla jest domknięta.
- `applyVisibilityFilter` dostał 4. parametr `column` (domyślnie `assigned_to`) — kalkulacje
  i oferty mają właściciela w `created_by`. `sessions` filtruje widocznością; **w BBS route
  oddawał kalkulacje wszystkich użytkowników każdemu z rolą CRM.**
- Branding szablonu oferty przepisany BBS→EBS (Eliton Benefits System, Stratton Prime
  sp. z o.o., `www.elitonbenefits.pl` — strona produktowa EBS, potwierdzona
  aliasem produkcyjnym `ebs.elitonbenefits.pl` i tytułem strony; kontakt `biuro@stratton-prime.pl`).

**E7d (2026-09-02) — leaderboard + org-chart.** Widoki `crm-leaderboard` →
`components/adminNew/crm/CrmLeaderboard` (gate `crm.leaderboard`) i `crm-org-chart` →
`components/adminNew/org/OrgChartView` (gate `crm.org-chart`; `OrgChart` + `OrgNodeEditor`
+ `OrgAddMemberModal`). Silnik rankingu: `lib/crm/leaderboard.ts`. API:
`app/api/crm/leaderboard/{route,export}` i `app/api/org/users/{route,[id]}`.
Widget `components/crm/sales/PartnerLeaderboardWidget` wpięty w `NetworkDashboardClient`
dla `Role.ADVISOR`. Dep: **`d3`** (+ `@types/d3`) — używane wyłącznie w `OrgChart.tsx`
(`select`, `tree`, `linkHorizontal`, `zoom`, `drag`); komponent ładowany `ssr:false`,
bo rysuje po DOM-ie. Migracja `058_audyt_user_profiles.sql`.

Adaptacje E7d:
- **Dwie bramki na `/api/org/users`, nie jedna.** Odczyt: `can('crm.org-chart')`. Zapis:
  dodatkowo rola z `ROLE_ZARZADZAJACE` (`superadmin`/`owner`/`dyrektor`/`menedzer`).
  W BBS bramką była wyłącznie lista ról, więc nadanie uprawnienia do zakładki dawałoby
  **prawo zakładania kont z hasłem** — ten route tworzy użytkowników w `auth`.
- **Dochodzi `owner`** (rola nieznana BBS-owi) i `leadowiec` w rolach do utworzenia.
- **Dwie dziury z BBS zamknięte w `PUT /api/org/users/[id]`:** `manager_id = własne id`
  (cykl w drzewie → nieskończona rekurencja w org-charcie) i zmiana **własnej** roli
  (można się było samemu zablokować). Oba → 400/403.
- **Kwoty premii w eksporcie CSV NIE są zaszyte.** BBS wpisywał na sztywno 5000/3000/1000 zł
  za złoto/srebro/brąz — to jego regulamin, nie Strattona, a plik idzie do ludzi. W EBS kwoty
  biorą się z env `LEADERBOARD_PREMIA_{ZLOTO,SREBRO,BRAZ}`; gdy nieustawione, kolumna
  „Premia_bazowa" po prostu nie powstaje. Reguły prowizji MLM dalej poza zakresem (K8).
- `CRM_ROLES` z BBS → `ROLE_SPRZEDAZOWE` (`partner`/`menedzer`/`dyrektor`): to lista ról
  **występujących w rankingu**, a nie bramka dostępu — bramkuje `can()`. Dzięki temu
  owner/superadmin są obserwatorami rankingu, nie jego uczestnikami.
- Korzeń zastępczy org-chartu (gdy struktura ma wiele wierzchołków): „Stratton Prime"
  zamiast „BBS".
- **`user_profiles` dostała audyt (migracja 058) — ale WŁASNĄ funkcją, nie `fn_audit_log()`.**
  Standardowa funkcja zapisuje `to_jsonb(NEW)`, czyli cały wiersz, a w `user_profiles` są
  `pesel`, `pesel_encrypted`, `iban`, `temp_password` (hasło jednorazowe otwartym tekstem),
  telefon i adres — wpięcie jej skopiowałoby te dane do `audit_log` przy każdej edycji profilu.
  `fn_audit_user_profiles()` zapisuje wyłącznie 9 pól strukturalnych i tylko gdy któreś
  z nich faktycznie się zmieniło. **Nie podmieniać jej na `fn_audit_log()`.**

**E7e (2026-09-02) — notatki głosowe. FALA E7 KOMPLETNA.** Widok `crm-notatki` →
`components/adminNew/crm/CrmNotatki` (gate `crm.notatki`): dyktowanie przez `MediaRecorder`
albo wklejenie zapisu rozmowy → Claude wyciąga ustalenia → terminy lądują w `calendar_events`,
zadania w `app_tasks` (`source='ai'`), maile zostają **szkicami**. Silnik:
`lib/notes/extract.ts`. API: `app/api/notes/{route,from-text,transcribe}`.
Migracja `059_crm_notatki_glosowe.sql` (`crm_voice_notes`).

> ⚠️ **E7e NIE JEST PORTEM.** W BBS-Unified **nie ma** ani `app/api/notes/`, ani `lib/notes`,
> ani tabeli notatek. Jedynym wywołaniem `/api/notes/from-text` w obu repozytoriach jest
> `components/agencja/HrTlumacz.tsx:437` (przeniesiony w E2d), który degradował się cicho,
> bo endpoint nie istniał **nigdzie**. Moduł zbudowany pod kontrakt narzucony przez tego
> jedynego wołającego: `{text, title}` → `{title, results:{events,tasks,emails}}`.
> Nie szukać źródła w BBS — go nie ma.

Decyzje E7e:
- **Model dostaje dzisiejszą datę i dzień tygodnia.** Bez tego „w przyszły wtorek" jest
  nierozwiązywalne, a rozmowy handlowe brzmią właśnie tak.
- **Odporność na model:** JSON wycinany z odpowiedzi (`{` … `}`), każde zdarzenie/zadanie
  walidowane osobno, `due_date` przycinane do 10 znaków (kolumna jest `DATE` — pełny ISO
  by ją wywalił), niepoprawne daty odrzucane. Zły wpis nie przewraca całej notatki:
  wstawki lecą pojedynczo, nie wsadem.
- **Szkice maili nigdzie nie wychodzą** — poczta CRM to E6d (K4). Do tego czasu kopiowanie.
- **Bramka `from-text` przepuszcza też `agencja.tlumacz`**, nie tylko `crm.notatki` —
  inaczej przycisk „Przetwórz rozmowę" w Tłumaczu byłby dla koordynatora martwy.
- **`transcribe` celowo NIE używa `/api/hr/translate/voice`** — tamten route bramkują
  uprawnienia agencji i zjada dzienny limit tłumacza (`translatorLimit`), który z notatkami
  CRM nie ma nic wspólnego.
- AI-guard jak w E2d: brak `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` → 200 `{ok:false,disabled:true}`
  i komunikat w UI; wpisywanie notatki tekstem działa dalej.

> 🔑 **KLUCZE AI WŁĄCZONE 2026-09-02.** `ANTHROPIC_API_KEY` i `OPENAI_API_KEY` są w
> `.env.local` **oraz na Vercelu (production)**. Odblokowały: OCR i tłumacz (E2d), analizę
> faktur (E4) i notatki głosowe (E7e). **Źródłem był `Desktop/Stratton Prime/php-api/.env`,
> NIE BBS** — czyli projekt tej samej spółki, więc nie ma kwestii, kto płaci za zużycie
> (wcześniejsza instrukcja „skopiować z BBS" jest nieaktualna; BBS to inna spółka).
> **`AI_MODEL` świadomie NIE skopiowany:** php-api jedzie na `claude-sonnet-4-6`, a EBS ma
> w `lib/anthropic.ts` domyślny `claude-opus-4-8` i pod niego był pisany — podmiana po cichu
> zmieniłaby zachowanie OCR-u, tłumacza i notatek.
>
> Zweryfikowane realnym wywołaniem, nie deklaracją: model `claude-opus-4-8` odpowiada,
> a asystent notatek rozwiązał „w przyszły wtorek o czternastej" (ze środy 02.09) na
> **2026-09-08 14:00** i „do piątku" na **2026-09-04** — daty policzone poprawnie,
> `due_date` w formacie `YYYY-MM-DD`. Klucz OpenAI: `GET /v1/models` → 200,
> `whisper-1` dostępny (`shutdown_date: null`).

**Prowizje MLM poza zakresem** — rozbicie self 10% / L1 5% / L2 2% / agent 10% to zmiana
reguł rozliczeń, nie port UI (K8). **Poczta CRM → E6d.**

**E8 (2026-09-02) — MIGRACJA DANYCH ZE STRATTON CRM WYKONANA.** Importer:
`scripts/import-stratton-crm.mts` (`npx tsx --env-file=.env.local … [--wykonaj]`; bez flagi
tylko podgląd). Migracja `060_e8_powiazanie_ze_stratton_crm.sql` — `external_source`/
`external_id` na `leads` i `crm_activities`. Przeniesione: **20 leadów + 101 aktywności**
(2 leady z kontaktami, 6 autorów zachowanych). Idempotencja sprawdzona: drugie uruchomienie
nie zdublowało niczego.

> ⚠️ **SEDNO E8 TO MAPOWANIE, NIE IMPORT — bo `leads` w Stratton CRM jest PUSTA.**
> Tamtejszy model klienta to `companies` (20) + `crm_client_profiles` (20, 1:1) +
> `client_contacts` (3) + `crm_client_activities` (101). EBS-owy CRM (port z BBS) stoi na
> `leads`. Kto szuka w źródle tabeli `leads`, znajdzie zero wierszy i wyciągnie błędny wniosek,
> że nie ma czego migrować.

Mapowanie i decyzje:
- `companies` + `crm_client_profiles` → **`leads`**; klucz `companies.id`. NIP jest w źródle
  wypełniony i **unikalny we wszystkich 20 rekordach**, więc nadaje się na klucz naturalny,
  ale idempotencję opieramy na `external_id` (odporne na korektę NIP-u).
- `client_contacts` → `leads.contacts` (jsonb). `crm_client_activities` → `crm_activities`;
  typy `CALL`/`MEETING`/`NOTE` mapują się **1:1**, nic nie trzeba tłumaczyć.
- **Statusy: doszedł piąty etap `RESIGNED`** (`pipelineTypes` + `pipelineConfig`). Stratton
  rozróżnia „zrezygnował przed podpisaniem" (2 rekordy) od „umowa rozwiązana" (1). Wciśnięcie
  ich do `TERMINATED` sfałszowałoby dane, a zostawienie samego tekstu uczyniłoby te leady
  **niewidocznymi na kanbanie** — `byStatus` filtruje po znanych kolumnach.
- **Opiekunowie: identyfikatory NIE przenoszą się.** `users.supabase_id` w Strattonie pochodzi
  z **tamtejszego** projektu Supabase — żaden z 6 opiekunów nie istniał w `auth.users` EBS.
  Dopasowanie idzie po **e-mailu**, rozwiązywanym na żywo z `auth.users`; sztywna tablica
  `INNY_ADRES_W_EBS` w skrypcie obsługuje tylko przypadki, gdy ta sama osoba ma w obu
  systemach inny adres (dziś: `t.juszkiewicz@stratton-prime.pl` → `t.juszkiewicz@gmail.com`).
  Krok `1b` importu **uzupełnia opiekuna tam, gdzie jest pusty** (nigdy nie nadpisuje
  przypisania zmienionego ręcznie), więc po założeniu nowego konta wystarczy powtórzyć import.
  Konta zakłada `scripts/e8-konta-opiekunow.mts`.
- **Stan przypisań po E8:** właściciel 14 · Marzanna Szarolkiewicz (`partner`) 2 ·
  Tomasz Górski (`dyrektor`) 1 · Maciej Hagno 2 · bez opiekuna 1 (w źródle też go nie ma).

> ⚠️ **DWA OTWARTE PRZYPADKI OSOBOWE (do decyzji właściciela, celowo nierozstrzygnięte):**
> · ✅ **ROZSTRZYGNIĘTE 03.09.2026** — właściciel podniósł jego konto prywatne
> (`maciej.hagno@gmail.com`) do roli `superadmin`, więc widzi CRM i swoje leady. Konto służbowe
> zostaje pracodawcą HAPAG-LLOYD (jedyne w tej roli). Poniższy opis zachowany jako uzasadnienie.
> · **`m.hagno@stratton-prime.pl`** ma w EBS konto w roli **`pracodawca`** (klient benefitowy),
> a w Stratton CRM jest DIRECTOR-em sprzedaży. Jego 2 leady są mu przypisane, ale **tej roli
> nie widać w CRM**: `pracodawca` należy do `STATIC_MENU_ROLES` w `Sidebar` i ma menu bez
> sekcji CRM, więc samo dosypanie uprawnień przez `user_permissions` nic nie da. Wybór:
> druga rola, drugie konto, albo zostawić (leady i tak widzi superadmin/owner).
> · **`biuro@stratton-prime.pl`** — wspólna skrzynka biura z rolą ADMIN w Strattonie,
> nie prowadzi żadnego klienta. Konta **nie zakładano**: nadanie skrzynce współdzielonej
> uprawnień administratora to decyzja bezpieczeństwa, nie szczegół migracji.
- **`users` i `offers` NIE migrowane.** Konta to osobna decyzja. `offers` (9) to w Strattonie
  oferta kwotowa (`subtotal_net`/`total_vat`/`total_gross`/`commission_percent`), a EBS-owe
  `crm_offers` to snapshot kalkulatora oszczędności (`total_savings_*`, `pdf_url`, `snapshot`)
  — **te modele się nie mapują**; wciśnięcie jednego w drugi dałoby rekordy z pustymi
  oszczędnościami i bez PDF-u.
- **Kierunek jednostronny.** Skrypt nie zapisuje niczego w Strattonie; kolumny
  `companies.ebs_company_id`/`ebs_synced_at` (puste) celowo zostają nietknięte. Powiązanie
  trzymamy u siebie.
- Indeks unikalny `uq_leads_external` **nie jest częściowy** — PostgREST nie potrafi użyć
  indeksu częściowego jako celu `ON CONFLICT` (`upsert` z supabase-js wywala się na
  „no unique or exclusion constraint matching…"). Zwykły indeks niczego nie blokuje, bo NULL-e
  są w unikalności rozróżnialne.
- Dostęp do źródła: **wprost po Postgresie** poświadczeniami z `Stratton Prime/php-api/.env`
  (rola `postgres`). Token MCP tamtego konta jest read-only, a PostgREST jest tam zamknięty
  po audycie RLS (Krok 2), więc REST-em danych się nie weźmie.

> **Historia (nieaktualne):** E8 była zablokowana brakiem dostępu do konta „stratton dev".
> `tjuszkiewicz-dev`; Stratton CRM stoi na koncie „stratton dev". Kolejność ustalona przez usera:
> **najpierw moduł, potem dane**; źródłem prawdy w okresie przejściowym pozostaje Stratton CRM
> (EBS czyta), **bez dwukierunkowej synchronizacji**. Otwarte pytanie: kod pochodzi z BBS, a dane
> ze Stratton CRM — to dwa systemy o prawdopodobnie różnych schematach i to mapowanie, nie sam
> import, jest właściwą treścią E8.

**E6a (2026-09-03) — KOMUNIKATOR FIRMOWY (czat tekstowy) DZIAŁA.** Spec:
`docs/superpowers/specs/2026-08-03-e6-komunikator-poczta-design.md` (napisany 03.08, **zrewidowany
03.09** — §0 to dziennik korekt po E7/E8; czytać spec, nie ten akapit, gdy coś się nie zgadza).
Dekompozycja: **E6a czat (zrobione) → E6b push → E6c rozmowy audio/wideo + notatki AI → E6d poczta**.

Migracja `053_chat.sql` — schemat **z introspekcji żywej bazy BBS** (`bbs-unified`,
`pcszyyjwrkkkgbbcpzhn`), nie z kodu: 6 tabel `chat_*` (`conversations`, `messages`, `participants`,
`reactions`, `policy`, `push_subscriptions`), `user_profiles.last_seen_at` (obecność), FK
`calendar_events.conversation_id` (obietnica z 056), bucket `chat-media` (private), GIN `pg_trgm`
na treści. Kolumny pod E6c (`duration_sec`, `kind` 6 wartości) i tłumaczenie (`translated_*`) są
od razu — **E6b/E6c nie robią ALTER-ów na tabelach czatu**; jedyna nowa tabela później to
`meeting_notes` (E6c). Kod: `lib/chat/{policy,server,realtime,translate,format}.ts`,
`app/api/chat/*` (13 route'ów + `…/translate`), `app/api/me/worker/chat`, `components/chat/*`
(`useChat` hook + `ChatButton`/`ChatApp`/`ConversationList`/`MessageThread`/`GroupPanel`/
`modals/PeoplePickerModal`/`Avatar`), `components/worker/WorkerChat`.

Adaptacje E6a względem BBS (uzasadnienia w specu §3, K1–K19):
- **Dostęp = uprawnienie `komunikator.czat`** (nowa grupa „Komunikator" w rejestrze; każdy route
  przez `can()`, brak → 403). BBS bramkował samą sesją. Domyślnie ma je **cała firma** poza
  rolami zewnętrznymi `pracodawca`/`pracownik` (decyzja usera D6). Role własne (`customized`)
  dostały klucz w migracji (`role_permissions`), bo nie czytają `DEFAULT_ROLE_PERMS`.
- **Polityka „kto z kim" = czysta funkcja `lib/chat/policy.canConverse` po wykluczeniu**
  (`EXTERNAL_ROLES`), z testami; `pracownik_tymczasowy` **tylko ze swoim koordynatorem**
  (`hr_employees.coordinator_id`), sprawdzane przy tworzeniu rozmowy, dodawaniu **i każdej
  wysyłce**. `chat_policy` w BBS jest pusta — logika siedziała w `NON_STAFF_ROLES`; tabela
  zostaje jako blokady par ról dla właściciela (route `chat/policy`, **bez UI** — K16).
- **`chat_messages.sender_id` nullowalny + FK `ON DELETE SET NULL`; FK do `user_profiles` na
  każdej kolumnie użytkownika** (BBS: brak FK). Powód: tryb PURGE z E5 kasuje profil fizycznie;
  treść wiadomości zostaje („Konto usunięte").
- **Bez triggera audytu na `chat_messages`/`chat_reactions`** — `fn_audit_log` kopiuje
  `to_jsonb(NEW)`, czyli treść prywatnych rozmów; triggery tylko na `conversations` i `participants`.
- **`profilesMap` z `lib/crm/profiles` (E7b)** — nie dublowany w `lib/chat/server`.
- Realtime: broadcast na `user:{id}` (RLS deny-all → `postgres_changes` nic nie widzi),
  `typing:{convId}` klient↔klient; `chat-calls` zarezerwowany dla E6c.
- **Tłumaczenie (D7):** na żądanie („Przetłumacz" na cudzej wiadomości → `…/translate`, cache
  w `translated_content/lang`, edycja kasuje cache) i **automatyczne przy wysyłce w rozmowie 1:1
  z pracownikiem tymczasowym** (pracownik→`pl`, koordynator→`hr_employees.language`
  znormalizowany przez `normalizeLang`). Silnik: `lib/hr/translateCore` z E2d; limit dzienny
  `consumeTranslator` tylko dla pracownika tymczasowego; AI-guard: brak klucza → wiadomość bez
  tłumaczenia, nigdy blokada wysyłki.
- **Kanał pracownika** `/api/me/worker/chat` = cienka nakładka na te same tabele (koordynator widzi
  rozmowę w zwykłym `ChatApp`); kontrakt `{id, mine, worker, pl}` narzucił stub z E2e.
- **`ChatButton` sam sprawdza uprawnienie** (`/api/me/permissions`) i renderuje nic bez niego:
  nagłówek `AdminDashboardClient`, pływający w `NetworkDashboardClient` (brak nagłówka), zakładka
  w `TempWorkerDashboard`. **Nie montować w `Employee`/`EmployerDashboardClient`** (role zewnętrzne).
- Wycięte z portu do E6b/E6c: push (`sendPushTo`, `sw.js`), rozmowy głosowe/wideo (`VoiceCall`,
  `ringtone`, sygnalizacja), nagrania, „Notatka AI" (`transcribe` → `meeting_notes`).
- Stylistyka: układ BBS (dwa panele, dymki, ✓✓), kolory WhatsAppa zamienione na `primary-*` EBS.

> ⚠️ **`leadowiec` do E6a nie miał ŻADNYCH uprawnień domyślnych** (brak wpisu w
> `DEFAULT_ROLE_PERMS` **i** w `app_roles`, więc panel Uprawnień też go nie widzi) — luka z E7a.
> E6a dodało mu `komunikator.czat`; **domyślne klucze CRM dla tej roli to decyzja właściciela.**

**E6b/E6c/E6d — NIEZBUDOWANE.** Fakty zebrane 03.09 (spec §8): EBS **nie ma `app_config`**
(BBS trzyma tam klucze VAPID) ani zależności `web-push`, `imapflow`, `mailparser`; `MailClient`
i `lib/mail/server.ts` (502 linie, IMAP na żywo — wiadomości nie są w bazie) czekają w
`Desktop/BBS-Unified`; poczta idzie pod istniejącym `crm.poczta` (`DetailsPanel` woła
`/api/crm/mail/by-contact`, dziś degraduje się cicho). Cron alertów BBS **scalić** z cronem E5
(Vercel Hobby), env `MAIL_*`→`SMTP_*`, `mail_account_users` do purge.

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

### Sklep benefitów v2 (2026-09-15)

Spec: `docs/superpowers/specs/2026-09-15-sklep-benefitow-design.md`. Pełnoekranowy sklep
(`components/employee/store/*`) pod `activeTab === 'CATALOG'`; katalog **w kodzie**
(`INITIAL_SERVICES` + `category`/`partner`/`fulfillment`; **bez trwałości w localStorage** — zdjęta
po recenzji końcowej 16.09, bo zamrażała ceny; zmiana katalogu działa od następnego załadowania);
logika w `lib/benefits/*` (czyste funkcje z testami). Dwie ścieżki: cena > 0 → `RedemptionModal` →
`POST /api/vouchers/purchase` (serwer **waliduje cenę z katalogiem** i realizuje vouchery jedną
funkcją `redeem_vouchers_for_service`, migracja 061 — jeden wpis w ledgerze, e-maile do BOK
i pracownika); cena 0 → `POST /api/benefits/inquiry` (tabela `benefit_inquiries`, deduplikacja
7 dni, e-maile). Aplikacje Eliton (`fulfillment: 'auto'`) odblokowują się same.
**Stary Pulpit z karuzelami zostaje w kodzie pod `STORE_LAYOUT = 'v1'`
(`lib/benefits/storeLayout.ts`) — nie usuwać.** Do 15.09.2026 zakup za punkty **nigdy nie zadziałał
na produkcji** (`redeem_voucher` wymagał statusu `active`, dystrybucja nadaje `distributed`); ledger
nie miał ani jednego wpisu `wykorzystanie`. Zgłoszenia `SupportTicketSystem` w portalu to nadal
tylko `localStorage` — BOK pracuje z e-maili (`BOK_EMAIL`, dom. `bok@stratton-prime.pl`).

**Decyzje właściciela 17.09.2026 (spec §10):** wydatki `INTERNAL-*` wewnątrz aplikacji Eliton
**schodzą z kont** (zostaje); pozycje partnerskie **zostają na „Zapytaj o ofertę"** — pracownik ma
dodatkowo dostać telefon do BOK (slot `BOK_PHONE` = env `NEXT_PUBLIC_BOK_PHONE`, pusty = ukryty;
numer właściciel poda 18.09); pisownia **UNIQA** (`SRV-P-UNIQA`).

**Kolejka zgłoszeń BOK (17.09.2026, spec §11):** Sidebar ── Benefity ── „Zgłoszenia BOK" →
`admin-zgloszenia` → `components/adminNew/AdminZgloszenia.tsx`. Dwa rodzaje: **zamówienia**
(`benefit_order_fulfillments`, migracja 062 — stan obsługi obok niezmiennej księgi, 1:1 po
`transaction_id`; **kolejka jest pochodną księgi**: odczyt listy woła `bok_sync_order_queue`, więc
zamówienia nie da się zgubić; `auto`/`INTERNAL-*` wchodzą od razu jako `done`) i **zapytania**
(`benefit_inquiries` + `handled_by`/`handled_at`/`note`). Logika: `lib/benefits/bokQueue.ts`
(statusy `new`→`in_progress`→`done`, podpis obsługującego, „po terminie" = 2 dni robocze w UTC),
I/O: `lib/benefits/bokQueueServer.ts`, API `app/api/admin/bok/{summary,[kind],[kind]/[id]}`.
Bramka **`can(auth,'benefity.zgloszenia')`** (nowy klucz + `PERMISSION_MENU`) — osobę z BOK da się
wpuścić rolą własną bez superadmina. Maile do BOK mają link do tej kolejki (`BOK_QUEUE_URL`).

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
**── Agencja Pracy ──** `hr-pracownicy`, `hr-mapa`, `hr-flota`, `hr-generator`, `hr-tlumacz` ·
**── CRM ──** `crm-pipeline` (E7a; kolejne pozycje dochodzą z E7b–E7e).

**Świadome różnice vs BBS**: pozycje ownera są w EBS obecne (`owner-panel`/`admin-ustawienia`,
rola `owner` doszła migracją 051); role sprzedażowe (DIRECTOR/MANAGER/ADVISOR) → Panel Sprzedaży
+ Moje Prowizje. Sekcja CRM **wróciła** w E7 (do E6 była wycięta).

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
| `m.hagno@stratton-prime.pl` | `pracodawca` | Maciej Hagno | `f03ed36e` (HAPAG-LLOYD POLSKA) | — |
| `t.juszkiewicz@gmail.com` | `owner` | Tomasz Juszkiewicz | `f03ed36e` (HAPAG-LLOYD POLSKA) | `uz7u2hq9rdpMBJLO37JHLM!` |
| `biuro@aneza.pl` | `pracodawca` | Agnieszka Cięciara | `8dbe726e` (Aneza) | — |
| `pasek.agnieszka@wp.pl` | `pracownik` | AGNIESZKA PASEK | `8dbe726e` (Aneza) | `u7fjcez88jbGJHVNE6DB64!` |
| `j.drobnikowska.bazyluk@gmail.com` | `pracownik` | JOANNA DROBNIKOWSKA-BAZYLUK | `8dbe726e` (Aneza) | `pqp51yllud3INZ0MXVDNM!` |
| `katarzynacygan@op.pl` | `pracownik` | KATARZYNA CYGAN | `8dbe726e` (Aneza) | `BF61fczv25!` |
| `maciej.hagno@gmail.com` | **`superadmin`** | Maciej Hagno | `f03ed36e` (HAPAG-LLOYD POLSKA) | — (wyczyszczone 03.09.2026) |

**Konta auth BEZ profilu (testowe/nieużywane):** `k.nowak@firma.pl`, `j.kowalski@firma.pl`, `dlkso@wp.pl`, `vcx@wp.pl`

> ⚠️ **Sprostowanie (03.09.2026): `f03ed36e` to HAPAG-LLOYD POLSKA sp. z o.o., NIE Stratton Prime.**
> Ta tabela nazywała ją błędnie przez miesiące. To firma-klient benefitowy: 4 pracowników, 8400 bonów,
> a **jedynym** kontem w roli `pracodawca` jest `m.hagno@stratton-prime.pl` (nigdy się nie logowało).
> Zmiana roli TEGO konta odcięłaby firmie panel pracodawcy — nie ruszać bez zastępstwa.
>
> **`maciej.hagno@gmail.com` podniesione z `pracownik` na `superadmin`** (decyzja właściciela, 03.09.2026).
> Konto ma 1500 bonów i 2 transakcje jako beneficjent — dane zostają, ale po zalogowaniu trafia do
> panelu administratora, nie do portalu pracownika. Hasło ustawione przez właściciela;
> `temp_password` (stare, plaintext) **wyczyszczone** — nie odtwarzać. Ślad w `audit_log`.
> Otwarty przypadek z E8 („czy Maciej Hagno ma widzieć CRM") **rozstrzygnięty tą drogą**:
> jako superadmin widzi wszystko, więc jego 2 leady też. Konto służbowe zostaje pracodawcą.

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
- `components/ui/MagicRings.tsx` + `MagicRings.css`
- `components/ui/ServiceCarousel.tsx` — Embla carousel, 4-column layout (`md:flex-[0_0_25%]`), `AppIconCard` min-height `220px`
- `components/bits/StarBorder/`
- `components/employee/mobile/WalletCard.tsx` — animated voucher balance card, `p-8` padding, white text

### Extracted Sub-Components & Helpers

- `utils/hrUtils.tsx` — typy i helpery HR (`HrOrder`, `STATUS_MAP`, `formatPeriod`, `buildOrderReportHtml`)
- `utils/formatters.ts` — `formatCurrency`, `formatDate`
- `lib/documents/pdfUtils.ts` — `ISSUER`, `generatePdfBuffer`, `uploadPdf`
- `lib/documents/umowaService.ts` — `createUmowaDocument`, `UmowaContext`
- `components/hr/modals/HROrderPickerModal.tsx`, `HROrderHistoryModal.tsx`, `HRAddEmployeeModal.tsx`
- `components/hr/dashboard/EmployeeCard.tsx` — `EmpDetailRow`, `EmployeeCard`
- `components/employee/dashboard/EmployeeWidgets.tsx` — `SectionDivider`, `AppIconCard`, `FloatingTabBar`
- `components/employee/dashboard/legal/constants.ts` — barrel re-export `wizardData`, `categoryConfig`, `documentTemplates`

`HRTab` jest definiowany i eksportowany z **`utils/hrUtils.tsx`** (`'ORDER' | 'HISTORY' |
'EMPLOYEES' | 'PAYMENTS' | 'BUYBACK'`) — importuj stamtąd, nie deklaruj lokalnie.

> ⚠️ **Sprostowanie (02.09.2026):** ten plik wcześniej kazał importować `HRTab`
> z `components/hr/dashboard/HRPageHeader.tsx`. To był **martwy plik** (usunięty przy
> sprzątaniu Fazy 3) i definiował **inny** typ o tej samej nazwie
> (`'START' | 'EMPLOYEES' | …`) — pochodzący jeszcze z nieistniejącego panelu.
> Wskazówka aktywnie kierowała w złe miejsce.

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

**Faza 3 — WYKONANA (2026-09-02): usunięto 57 plików martwego kodu.** `tsc --noEmit` 0 błędów,
`npm test` 298/298, `next build` exit 0.

Lista w tym pliku wymieniała ~30 plików; realnie było ich **57**, bo martwy kod tworzył
**łańcuchy**: usunięcie wierzchołka osierocało kolejną warstwę. Metoda, którą warto powtórzyć
przy następnym sprzątaniu — kasuj, potem **ponów wykrywanie osieroconych i iteruj aż do stanu
stabilnego** (tu: 34 → 16 → 6 → 1 → 0, cztery rundy). Przykłady łańcuchów, których pierwotna
lista nie znała: `HRSettlementWizard` (zero importów) ciągnął `PayrollModal`;
`HRDocumentBinder` ciągnął `documentBinderHelpers`; cały `components/Documents/**`
(szablony PDF, `documentUtils`, `PDF_LAYOUT`) odpadł po usunięciu `DocumentModal`.

Warto wiedzieć, co przy okazji zniknęło: `components/security/SessionGuard.tsx` — komponent
auto-wylogowania po bezczynności, pochodzący jeszcze z commita `init: kopia kodu EBS demo`
i **nigdy niepodpięty** w wersji Next.js. **EBS nie ma wygaszania sesji po stronie UI**;
sesje wygasają wyłącznie mechanizmem Supabase. Jeśli kiedyś pojawi się takie wymaganie
(RODO, dane paszportowe na ekranie), trzeba to napisać od nowa — nie ma czego odkopywać.

> 🔴 **ŻYWE — NIE usuwać** (mimo że leżą w `components/hr/**`; importowane przez działający panel): `components/hr/dashboard/EmployeeCard` (`EmpDetailRow`), `components/hr/KartotekaImportZone`, `components/hr/HRSettingsModal` (import w `EmployerDashboardClient`), `components/hr/modals/HROrderPickerModal`, `HROrderHistoryModal`, `HRAddEmployeeModal` (import w `DashboardNewHR`). Usunięcie „całego `components/hr/dashboard/`" **zepsuje build** — kasuj wyłącznie po imienne pliki i sprawdź `grep -r` przed usunięciem.

**Bezpieczeństwo zależności (stan 2026-09-02): 30 → 13 podatności.**
- `npm audit fix` bez zmian major zamknął m.in. `handlebars` (CRITICAL) i `next` (HIGH, DoS
  w Server Components — 15.5.x podbite do 15.5.25 w obrębie `^15.5.14`). `package.json` nietknięty.
- **`xlsx` (SheetJS) USUNIĘTY** — miał Prototype Pollution i ReDoS **bez dostępnej łatki**,
  odpalane przy czytaniu cudzego pliku. Cały `utils/excelHr.ts` stoi na **ExcelJS**.
  ⚠️ **Konsekwencja: nie czytamy już starego formatu `.xls`** (ExcelJS obsługuje tylko OOXML).
  Pola uploadu zawężone do `.xlsx`, użytkownik dostaje instrukcję „zapisz jako .xlsx".
  Regresję pilnuje `utils/excelHr.test.ts` — buduje prawdziwy plik i czyta go z powrotem
  (data, formuła, pusta komórka, pusty wiersz w środku).
- **Zostaje 13 i każda wymaga skoku major** — świadomie nietknięte: `puppeteer` 25 (siedzi pod
  produkcyjnym serwerem PDF), `vitest` 4 (dev-only; CRITICAL dotyczy serwera Vitest UI,
  którego nie uruchamiamy), `postcss` (łata się dopiero przez **next@16**), `exceljs`→`uuid`
  (moderate; „naprawa" to downgrade exceljs do 3.4.0, czyli breaking).


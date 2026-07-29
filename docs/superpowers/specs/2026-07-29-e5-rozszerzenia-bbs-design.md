# E5 — Rozszerzenia z BBS (delta 2026-07-16..29)

Data: 2026-07-29
Status: spec do akceptacji
Poprzednie fale: E1 (shell/launcher), E2a–E2e (agencja), E4 (księgowość)

## 1. Kontekst

Migracja BBS→EBS (E1–E4) bazowała na stanie BBS z ~16–19 lipca 2026. Od tego czasu
w BBS-Unified przybyły 22 commity (do 2026-07-29). User poprosił o przeniesienie
wszystkich nowych opcji.

Zakres podzielono na dwie fale:

- **E5 (ten spec)** — rozszerzenia modułów, które już żyją w EBS. Bloki C, D, E, F, G, H.
- **E6 (osobny spec, po E5)** — komunikator + poczta, **z rozmowami wideo włącznie**
  (WebRTC + serwer TURN). Bloki A i B. Wymaga osobnej decyzji infrastrukturalnej.

Kolejność zatwierdzona przez usera: najpierw E5, potem E6.

## 2. Decyzje usera (2026-07-29)

| # | Decyzja | Wybór |
|---|---|---|
| D1 | Trwałe usuwanie kont (blok G) | **Blokada + anonimizacja** — nie port 1:1 |
| D2 | Dane podmiotu w nowych dokumentach (blok C) | **Szablony z placeholderami** — bez danych ALCES |
| D3 | Zakres nawigacji wstecz (blok H) | **Wszystkie 4 panele** (Admin, pracodawca, pracownik, sieć) |

## 3. Decyzje kontrolera (nie wymagały pytania)

| # | Decyzja | Uzasadnienie |
|---|---|---|
| K1 | **NIE przenosimy faksymile podpisu** prezesa ALCES | Umieszczenie podpisu osoby reprezentującej obcą spółkę na dokumentach EBS = podrobienie dokumentu. Plik jest w BBS poza gitem (`assets-private/`, w `.gitignore`) — nie ma go nawet w historii repo. Jeśli EBS ma mieć faksymile, wymaga podpisu osoby faktycznie reprezentującej podmiot i jej zgody — poza zakresem E5. |
| K2 | Raport PDF alertów renderuje przez `lib/pdf/renderer.ts` | BBS używa `renderOfferPdfBatch` z `@/lib/crm/offer/pdfRenderer`; CRM jest świadomie wykluczony z EBS (osobny CRM Stratton Prime). Zweryfikowano: `lib/crm/offer` nie istnieje w EBS. |
| K3 | Audyt przez `audit_log` (triggery + jawny wpis dla purge), nie `logEvent` | EBS nie ma `lib/audit`/`event_log` (usunięte przy porcie E2b — audyt robią triggery `fn_audit_log`). Operacja nieodwracalna wymaga jawnego wpisu. |
| K4 | Blok E to nie cherry-pick, tylko naprawa + poprawki w jednym zadaniu | `import-drive` w EBS jest w stanie WCZEŚNIEJSZYM niż punkt wyjścia BBS (nie scala OCR, buduje dane z nazwy folderu — dokładnie bug naprawiony w 1e33a02). |
| K5 | Klucz historii SPA: `ebsView` (nie `bbsView`) | Spójność nazewnictwa; klucz i tak jest wewnętrzny. |

## 4. Architektura

### 4.1 Migracja `052_hr_status_tlc.sql`

Jedyna migracja w całej fali. Trzy kolumny na `hr_employees`:

```sql
ALTER TABLE hr_employees
  ADD COLUMN IF NOT EXISTS work_status text NOT NULL DEFAULT 'pracuje',
  ADD COLUMN IF NOT EXISTS tlc boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tlc_expiry date;
```

- `work_status` ∈ `pracuje | oczekuje | urlop | zwolniony`. Bez CHECK constraint
  (walidacja aplikacyjna przez `WORK_STATUS_IDS`) — zgodnie z BBS.
- **`work_status` jest ŚWIADOMIE ODDZIELNA od istniejącej `status` (active/inactive).**
  `status` nadal steruje rozliczeniami, payrollem i alertami. `work_status` jest
  wyłącznie informacyjna/prezentacyjna. Nie mieszać.
- `tlc`/`tlc_expiry` — karta pobytu z innego kraju (Temporary Legal Card). BBS nie ma
  pliku migracji (kolumny dodane bezpośrednio na Supabase), DDL odtworzony z użycia w kodzie.
- Backfill (idempotentny, tylko gdy kolumna świeżo dodana):
  archiwum → `zwolniony`, kandydaci/inactive → `oczekuje`, reszta → `pracuje`.
- Migracja idempotentna (`IF NOT EXISTS`), zgodnie z konwencją repo.

### 4.2 Nowe moduły współdzielone

| Plik | Rola |
|---|---|
| `lib/hr/workStatus.ts` | Single source of truth statusów: `WORK_STATUSES` (id, label, klasy badge/dot), `DEFAULT_WORK_STATUS`, `workStatusDef(id)` z fallbackiem. ~16 LOC. |
| `lib/hr/alerts.ts` | `buildAlerts(employees, accommodations, vehicles)`, `filterAlerts(items, params)`, `ALERT_GROUPS`, `groupOf()`. Używany IDENTYCZNIE przez ekran i przez PDF — nie mogą się rozjechać. ~120 LOC. |
| `lib/useHistoryView.ts` | Hook historii ekranów SPA (`popstate` + `pushState`/`replaceState`). ~37 LOC. |

## 5. Etapy

### E5a — Fundament (blokuje resztę)

- Migracja 052 + apply do produkcyjnej bazy Supabase (`ramedybmybcpqvelsmxd`).
- `lib/hr/workStatus.ts`.
- Weryfikacja backfillu na żywych danych EBS (liczby będą inne niż w BBS — bez znaczenia).

### E5b — Statusy pracownika (blok D, część 1)

- **Kartoteka**: dropdown statusu pod nazwiskiem w `HrEmployeePanel` → `PATCH /api/hr/employees/[id]`
  (`FIELDS` += `work_status`), zapis natychmiastowy bez trybu edycji.
- **Archiwizacja**: `POST .../archive` ustawia `work_status:'zwolniony'`; restore → `'pracuje'`.
- **Per kontrakt**: `GET /api/hr/contracts` zwraca `status_counts` (liczone w locie, Map po
  `contract_id` + `work_status`, tylko `archived=false`) → plakietki z licznikami w nagłówku
  kontraktu + kropka koloru przy nazwisku na liście (`HrKontrakty`).
- **Per lokal**: `GET /api/hr/accommodations` zwraca analogiczne `status_counts` po
  `accommodation_id` → plakietki na karcie lokalu (`HrBazaNoclegowa`).
- **Zakwaterowani per lokal**: przenoszenie między lokalami + przywracanie z archiwum do
  wybranego kontraktu (`archive/route.ts`, `employees/route.ts`, `HrArchiwum`, `HrBazaNoclegowa`).
- **Dwa imiona / dwa nazwiska**: wspólny `displayName` na listach (`HrEmployeePanel`,
  `HrKontrakty`, `HrPoczekalnia`) + `lib/hr/docPlaceholders`.

`status_counts` jest polem liczonym w odpowiedzi API — **nie kolumną w bazie**.

### E5c — Alarmy + TLC (blok D część 2 + blok F część 1)

- `lib/hr/alerts.ts` — wspólny helper. Typy alarmów (`AlertKind`):
  - `expiry` — paszport, karta pobytu, pozwolenie na pracę, wiza, **TLC** (≤60 dni);
    Schengen 90-dniowy (≤30 dni). Tylko pracownicy `status==='active'`.
  - `medical` — `medical_exam_expiry` ≤60 dni (kolumna JUŻ JEST w EBS).
  - `fleet` — `hr_vehicles` poza `status==='wycofany'`: `insurance_until`, `inspection_until`,
    `license_expiry`, próg ≤30 dni (te same progi co istniejący digest e-mail). Klik NIE otwiera
    kartoteki pracownika (pojazdy mają własną zakładkę).
  - `zus` / `pesel` — brak `zus_registration_date` / `pesel`.
  - `lease` — `hr_accommodations.lease_end_date` ≤3 dni.
- Filtry: grupy wg pilności (`expired` / `soon` ≤30 / `warn` 31–60) + wg rodzaju
  (`medical`, `fleet`, `lease`, `zus`, `pesel`). Łączone sumą (OR).
  `filterAlerts(items, {kinds, contract, search, maxDays})`.
- Sekcja przemianowana: „Dokumenty wymagające uwagi" → **„Alarmy wymagające uwagi"**.
- **Raport PDF**: `POST /api/hr/alerts/pdf` z parametrami `{kinds, contract, search, maxDays}`.
  Renderuje przez `lib/pdf/renderer.ts` (K2). Zakres danych wg uprawnień: role „widzą wszystko"
  → całość; `koordynator` → swoi + kontrakty przyznane przez `coordinatorGrantedContractIds`
  (`lib/hr/coordinatorScope` — istnieje w EBS).
- **TLC w kartotece i cronie**: pola `tlc`/`tlc_expiry` w `HrEmployeePanel`, `FIELDS` w PATCH,
  alert w `HrPermitAlerts`, oraz w digeście wygasania (w EBS doklejony do crona
  `expire-vouchers`, nie osobny `expiry-alerts` — adaptacja wobec BBS, Vercel Hobby).

### E5d — OCR / import z Drive / PESEL (blok E)

**To NIE jest cherry-pick** (K4). Jedno zadanie obejmujące naprawę i poprawki:

- **Prompt OCR** (`lib/hr/ocr.ts`), dwie brakujące sekcje:
  - *Kolejność pól w paszporcie* — strefa MRZ rozstrzyga podział:
    `P<KRAJNAZWISKO1<NAZWISKO2<<IMIE1<IMIE2` — przed `<<` nazwiska, po `<<` imiona.
    Naprawia paszporty kolumbijskie (Apellidos przed Nombres).
  - *Data ważności paszportu* — `passport_expiry` wyłącznie ze strony danych paszportu,
    weryfikowana 2. linią MRZ (po numerze, dacie urodzenia i cyfrze kontrolnej idzie płeć M/F,
    zaraz po niej data ważności RRMMDD). Przy rozbieżności **MRZ wygrywa**. Naprawia skany
    z dwoma dokumentami na jednym obrazie (cédula + paszport).
- **Import z Drive** (`app/api/hr/candidates/import-drive/route.ts`):
  - Typ pliku przez `resolveOcrType(contentType, name)` z fallbackiem `sniffOcrType(buf)`
    (sygnatura bajtów) — Drive zwraca część plików jako `application/octet-stream`, przez co
    paszporty nigdy nie trafiały do OCR.
  - **Wpięcie `aggregateResults`/`mergeIntoEmployee`** (helpery ISTNIEJĄ w EBS, ale nie są użyte
    w tym route). Dane z OCR **zawsze** nadpisują placeholdery (`'—'`, `'(import: …)'`);
    nazwa folderu używana **tylko** gdy OCR nic nie zwrócił.
  - Deduplikacja: znormalizowany numer paszportu vs `hr_employees.passport_number`;
    trafienie → kasuje świeżo utworzony szkielet, zwraca `status:'skipped'`.
- **Dedup przy ręcznym dodaniu** (`app/api/hr/employees/route.ts` POST): gdy brak numeru
  paszportu — fallback po posortowanym zbiorze znormalizowanych tokenów imion i nazwisk
  (bez diakrytyków, `s`/`z` na końcu członu równoważne) → 409 z podpowiedzią istniejącego rekordu.
- **Wniosek PESEL, pkt 8**: ręczna miejscowość — pole w `HrGeneratorDokumentow`,
  `pesel_sign_city` przez `doc-generate`, `signCity` w `fillPeselForm` (`lib/hr/peselForm.ts`).
- **Zachować AI-guard z E2d**: brak `ANTHROPIC_API_KEY` → 200 `{ok:false, disabled:true}`,
  nigdy 500. UI pokazuje „funkcja wyłączona".

### E5e — Uprawnienia, usuwanie kont, nawigacja (bloki F część 2, G, H)

**F2 — per-user wyjątek na usuwanie dokumentów** (najprostszy port w całej fali):
- Nowy klucz `agencja.dokumenty-usun` w `lib/permissions/registry.ts` (grupa Agencja Pracy).
- W `documents/route.ts` i `documents/[docId]/route.ts`: twardą blokadę
  `auth.role === 'koordynator'` zamienić na
  `auth.role === 'koordynator' && !(await can(auth, 'agencja.dokumenty-usun'))`.
- Wyjątek nadaje się istniejącą macierzą uprawnień (wpis `grant` w `user_permissions`).
  EBS ma ten mechanizm 1:1 (migracja 045, `lib/permissions/server.ts`). **Zero nowego schematu.**

**G — usuwanie kont: PRZEPROJEKTOWANE (D1)**

Wersja BBS kasuje profil + `auth.users`, odpinając garść tabel. W EBS to się wywali:
migracja 001 ma `ON DELETE RESTRICT` na `vouchers.current_owner_id`, `voucher_transactions`
(obie strony), `commissions.agent_id`, `distribution_batch_items.user_id`,
`buyback_agreements.user_id`, `support_tickets.creator_id`, `ticket_messages.sender_id`.
`voucher_transactions` to zadeklarowana **niezmienna księga** z triggerem
`enforce_ledger_immutability` (obszar regulowany: bony MPV, dyrektywa UE 2016/1065).

Projekt dla EBS — `app/api/users/[id]/purge/route.ts`:

- `GET` — podsumowanie skutków: **ślad finansowy** (liczby: vouchery, transakcje, prowizje,
  pozycje dystrybucji, umowy odkupu, dokumenty finansowe, zgłoszenia) + lista danych
  do skasowania i do odpięcia. To podsumowanie decyduje o trybie.
- `DELETE` — dwa tryby, wybierane automatycznie na podstawie śladu:
  - **Ślad pusty → PURGE.** Kasowane: `user_permissions`, `hr_coordinator_contracts`
    (coordinator_id), `user_app_entitlements` (user_id). Odpinane (`set null`):
    `hr_employees.coordinator_id`, `hr_employees.created_by`, `hr_employees.user_id`.
    Następnie `auth.admin.deleteUser(id)` i `user_profiles.delete()`.
    **Uwaga:** BBS kasuje dodatkowo `mail_account_users`, `chat_push_subscriptions`,
    `chat_participants`, `chat_reactions` — tych tabel w EBS jeszcze NIE MA (przyjdą z E6).
    Zweryfikowano: zero trafień w `supabase/migrations/`. **Przy E6 trzeba rozszerzyć purge
    o nowe tabele czatu/poczty** — dopisane do „Poza zakresem" jako zależność E6→E5.
  - **Ślad niepusty → ANONIMIZACJA.** Konto zostaje jako rekord, ale:
    dane osobowe wymazane (imię/nazwisko → oznaczenie techniczne, PESEL, IBAN, adres,
    telefon, `temp_password` → NULL), e-mail w `auth.users` zamieniony na adres techniczny,
    logowanie zablokowane (`ban`/`delete` sesji). **Księga i dokumenty finansowe nietknięte.**
    Godzi RODO z retencją księgową.
- Zabezpieczenia: gate `auth.isOwner`; `id === auth.id` → 400 (nie usuwasz siebie);
  `profile.role === 'owner'` → 400. **Dodatkowo wobec BBS: potwierdzenie przez przepisanie
  pełnej nazwy konta** w modalu (BBS ma tylko jeden klik — za słabo dla operacji nieodwracalnej).
- **Kolejność bezpieczna**: `auth.admin.deleteUser` PRZED usunięciem profilu, żeby nie zostawić
  konta logowania bez profilu; błąd „not found" tolerowany. Kod nie jest transakcyjny (Supabase
  REST), więc każdy krok musi być idempotentny i odporny na powtórzenie.
- **Audyt**: jawny wpis do `audit_log` z rozbiciem (co skasowane / co odpięte / tryb),
  aktorem jest owner (K3).
- UI: `AdminUsers` — czerwony przycisk widoczny tylko przy `is_owner` z `/api/me/permissions`,
  modal z podsumowaniem „co zniknie / co zostaje" + polem potwierdzenia.

**H — historia ekranów SPA (D3)**
- `lib/useHistoryView.ts`: `useRef` (nie state) + dwa efekty. Mount: nasłuch `popstate`,
  odczyt `e.state.ebsView`, flaga `fromPop` chroni przed podwójnym `pushState`.
  Pierwszy render: `replaceState` (bez nowego wpisu), kolejne zmiany: `pushState`.
  Spread `...(history.state || {})` — **zachowuje stan routera Next.js**, nadpisuje tylko klucz.
- Wpięcie po 2 linie w **4 panelach**: `AdminDashboardClient`, `EmployerDashboardClient`,
  `EmployeeDashboardClient`, `NetworkDashboardClient`.
- Weryfikacja: w EBS `DashboardAdminNew` trzyma wewnętrzny `tab` synchronizowany z propem
  `currentView` przez `useEffect` (`VIEW_TO_TAB`) — zmiana z `popstate` powinna kaskadować
  tą samą ścieżką. Do sprawdzenia testem ręcznym.

### E5f — Generator dokumentów (blok C)

**Kod (~50 LOC):**
- `lib/hr/docPlaceholders.ts` — trzy nowe znaczniki: `dzis_plus_miesiac`, `kontrakt_adres`,
  `miejsce_szkolenia` + logika w `buildDocData`.
- `app/api/hr/doc-generate/route.ts` — select kontraktu `contract:hr_contracts(id, name, address)`
  (dziś bez `address`; kolumna JUŻ ISTNIEJE w EBS, migracja 048).

**Szablony (D2 — z placeholderami):**
- Dwa nowe dokumenty, każdy w 4 wersjach dwujęzycznych (PL/EN, PL/ES, PL/RU, PL/HI):
  „Porozumienie o bezpłatnym szkoleniu wdrożeniowym" i „Oświadczenie — kontakt przez pełnomocnika".
- Treść trafia do tabeli `hr_doc_templates` (`content_html`) skryptem seed w `scripts/`
  — schemat tabeli w EBS jest identyczny (migracja 048), **zero migracji SQL**.
- **Dane podmiotu i pełnomocnika jako pola do uzupełnienia w panelu Szablony dokumentów**,
  NIE dane ALCES/QALITAS. Bez faksymile podpisu (K1).
- Kategoria `koscielne`: w BBS usunięta (specyficzne dla ich bazy). W EBS **zostawiamy** —
  usunięcie było operacją na danych BBS, nie zmianą produktową.

**Pułapka do udokumentowania w CLAUDE.md:** istniejący `scripts/import-bbs-doc-templates.mts`
przy ponownym uruchomieniu zassałby te szablony z bazy BBS **żywcem z danymi ALCES i z base64
faksymile podpisu**. Skrypt musi je wykluczać (filtr po `name`) albo zostać oznaczony jako
jednorazowy/archiwalny.

## 6. Obsługa błędów i degradacja

- **Brak kluczy AI** → zachowany wzorzec E2d: 200 `{ok:false, disabled:true, error}`, UI pokazuje
  „funkcja wyłączona". Zero 500, zero crashy. Dotyczy całego E5d.
- **Brak `work_status`** (gdyby migracja nie przeszła) → `workStatusDef()` ma fallback do
  pierwszego statusu, UI nie wybucha.
- **Purge**: każdy krok idempotentny; tryb wybierany PRZED jakąkolwiek destrukcją; podsumowanie
  GET pokazuje ślad finansowy zanim owner cokolwiek kliknie.
- **Raport PDF alertów**: brak danych → pusty raport z nagłówkiem, nie błąd.

## 7. Testy i weryfikacja

- `npx tsc --noEmit` — 0 błędów (uwaga: `next.config.ts` ma `ignoreBuildErrors: true`).
- **`npx next build`** po każdym etapie dotykającym `app/api/**` — łapie klasę błędu
  „route-type" (nie-route `export const` w `route.ts`), która ugryzła nas w E2b.
- Vitest dla czystych helperów: `workStatus` (fallback), `alerts` (progi, grupowanie, filtry),
  dedup po tokenach nazwiska, parsing MRZ.
- Smoke ręczny per etap: statusy i liczniki, filtry alarmów + pobranie PDF, import z Drive
  na paszporcie octet-stream, wstecz w 4 panelach, purge/anonimizacja na koncie testowym
  (**nigdy na koncie z danymi produkcyjnymi**).

## 8. Ryzyka

| Ryzyko | Mitygacja |
|---|---|
| E5d nie jest cherry-pickiem — import z Drive w EBS jest za stary | Jedno zadanie „napraw + nałóż poprawki", nie trzy osobne |
| Purge jest nieodwracalny, EBS ma dane finansowe pod FK RESTRICT | Tryb wybierany po sprawdzeniu śladu; anonimizacja zamiast kasowania; potwierdzenie przez przepisanie nazwy; audyt |
| `import-bbs-doc-templates.mts` może wciągnąć szablony ALCES + podpis | Filtr w skrypcie + wpis w CLAUDE.md |
| Pomylenie `work_status` z `status` | Komentarz w migracji i w `workStatus.ts`; `status` zostaje jedynym filtrem rozliczeń/payrolla |
| Brak transakcyjności przy purge | Kolejność od najmniej do najbardziej destrukcyjnej; idempotencja; audyt przed operacją |

## 9. Poza zakresem E5

- **Bloki A i B** (komunikator, poczta, wideo/TURN) → **E6**, osobny spec.
  **Zależność zwrotna E6→E5:** gdy E6 wprowadzi tabele czatu i poczty, endpoint purge
  z E5e musi zostać rozszerzony o kasowanie `mail_account_users`, `chat_push_subscriptions`,
  `chat_participants`, `chat_reactions` — inaczej zostaną sieroty po usuniętym koncie.
- Faksymile podpisu w dokumentach EBS (K1) — wymaga podpisu i zgody osoby reprezentującej podmiot.
- Uzupełnienie treści nowych szablonów danymi firmy — robi user w panelu (D2).
- Usunięcie kategorii `koscielne` — operacja na danych, nie na kodzie.

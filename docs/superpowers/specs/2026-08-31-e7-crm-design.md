# E7 — CRM (port z BBS-Unified)

**Data:** 2026-08-31
**Status:** projekt do zatwierdzenia
**Poprzednik:** handoff `session-logs/2026-08-31-crm-migracja-stratton.md`

## 1. Kontekst i dekompozycja

31.08.2026 user odwrócił decyzję z początku migracji („skopiuj wszystko z BBSa **bez CRMa**,
bo mamy osobny CRM Stratton Prime"). Przez pięć fal (E1–E5) CRM był świadomie wycinany —
m.in. E5 dostało własny renderer PDF (`lib/pdf/renderer.ts`) zamiast CRM-owego, a
`lib/supabaseAdmin.ts` istnieje wyłącznie jako proteza po usuniętym `lib/crm/visibility.admin()`.
Teraz CRM wchodzi do zakresu i docelowo ma **zastąpić** osobną aplikację Stratton CRM.

### Skala — zmierzona, nie szacowana

Handoff podawał „> 5 000 LOC". Faktyczny obrys w `Desktop/BBS-Unified` (BBS2 jest starszym,
uboższym wariantem — nie ma `components/crm/mail` ani `lib/crm/activities.ts`; **źródłem portu
jest BBS-Unified**):

| Katalog | LOC |
|---|---|
| `components/crm/` (calculator, pipeline, mail, sales) | 3 536 |
| `components/adminNew/crm/` (widoki panelu — **pominięte w szacunku handoffu**) | 2 686 |
| `app/api/crm/` (28 route'ów) | 1 685 |
| `lib/crm/` (activities, leaderboard, offer, tax-engine, visibility) | 1 823 |
| **Razem rdzeń CRM** | **9 734** |
| `components/adminNew/org/` (org-chart) | 474 |
| `components/notes/` + `app/api/notes/` (notatki głosowe) | 459 |
| **Razem z dodatkami** | **10 667** |

To dwa razy więcej niż zakładał handoff i więcej niż cała fala E5. Jedna fala tego nie udźwignie.

### Ile z tego jest ŻYWE (weryfikacja przed portem)

Część obrysu to martwa, nadpisana generacja w samym BBS. Zweryfikowane dwiema drogami —
grepem po importach i zapytaniem do żywej bazy bbs-unified:

| Martwy element | LOC | Dowód |
|---|---|---|
| `components/adminNew/crm/CrmPipeline` + 5 helperów `crmPipeline*` | 1 125 | zero importów; `DashboardAdminNew` ładuje `components/crm/pipeline/PipelineKanban` |
| `components/adminNew/crm/CrmKalkulator` | 523 | zero importów; używany jest `components/crm/calculator/CalculatorWizard` |
| `app/api/crm/activities/` (2 route'y) | 125 | stoi na tabeli `crm_client_activities`, **której nie ma w bazie BBS** |
| `app/api/crm/leads/[id]/notes` | 64 | tabela `lead_notes` **nie istnieje** |
| `app/api/crm/leads/[id]/qualify` | 30 | kolumna `leads.qualification_notes` **nie istnieje** |
| `app/api/crm/leads/[id]/convert` | 43 | `crm_client_profiles`, `leads.company_id`, `leads.converted_at` — **nic z tego nie istnieje** |
| **Razem martwe** | **1 910** | |

**Żywy obrys do portu: ~8 757 LOC.** Żywą ścieżką osi czasu jest `crm_activities` przez
`app/api/crm/leads/[id]/activities` + `lib/crm/activities.ts` — i tylko ona jest portowana.

### Dekompozycja

| Etap | Zakres | ~LOC |
|---|---|---|
| **E7a** | Fundament: migracja schematu, leady + Pipeline (kanban/lista/szczegóły), aktywności, widoczność, uprawnienia `crm.*`, sekcja „CRM" w menu | ~2 900 |
| **E7b** | Kontakty, zadania (`crm_tasks`), Kalendarz | ~1 100 |
| **E7c** | Kalkulator Ofertowy (wizard 6 kroków + `tax-engine`) i generator oferty PDF | ~2 800 |
| **E7d** | Leaderboard, Org-chart, prowizje | ~1 400 |
| **E7e** | Notatki głosowe — domyka zaślepkę z E2d | ~460 |
| — | **Poczta CRM** | → **E6d**, nie E7 (K4) |
| — | **Migracja danych ze Stratton CRM** | → **E8**, zablokowana (§9) |

## 2. Decyzje usera (31.08.2026)

| # | Decyzja |
|---|---|
| D1 | CRM wchodzi do EBS — odwrócenie pierwotnego wykluczenia |
| D2 | Kolejność: **najpierw moduł, potem dane** — nie ma dziś gdzie ich wgrać |
| D3 | Zakres migracji danych: **wszystko** — firmy, leady, szanse, kontakty, historia działań |
| D4 | W okresie przejściowym **źródłem prawdy jest Stratton CRM**; EBS dostaje kopię do odczytu |
| D5 | Docelowo EBS zastępuje Stratton CRM — dopiero po gotowości oprogramowania |
| D6 | **Bez dwukierunkowej synchronizacji** — przy dwóch bazach to stałe konflikty (odrzucone) |

## 3. Decyzje kontrolera

| # | Decyzja | Uzasadnienie |
|---|---|---|
| **K1** | **Widoczność wymaga `manager_id`** — migracja dodaje kolumnę; `visibility.ts` dostaje gałąź `owner` → pełna widoczność | `lib/crm/visibility.ts` w BBS filtruje leady po drzewie `user_profiles.manager_id` i rolach `partner`/`menedzer`/`dyrektor`/`leadowiec`. Zweryfikowane w żywej bazie EBS: **kolumny `manager_id` nie ma**, a w danych występują wyłącznie 4 role (`owner`, `pracodawca`, `pracownik`, `superadmin`). Port 1:1 dałby funkcję, która dla każdego poza superadminem zwraca `[callerId]` → pusty CRM. EBS ma za to rolę `owner`, której BBS nie zna — bez własnej gałęzi właściciel nie zobaczyłby nic (dokładnie ten sam błąd, który naprawiał commit `a3c2bcf`). |
| **K2** | **Kolumna `workspace` nie jest portowana** | Tabele CRM w bbs-unified mają `workspace:text` — znacznik wielonajemcy BBS. EBS jest jednonajemcowy; kolumna byłaby martwym polem, które trzeba wypełniać w każdym insercie. |
| **K3** | **`crm_invoices` tylko jako ewidencja — zero wystawiania** | E4 rozstrzygnęło: **Fakturownia jest jedynym fakturującym, bez własnego KSeF w EBS**. `crm_invoices` to faktury prowizyjne agentów (`invoice_number`, `provision_pct`, `provision_amount`). Port pełnej ścieżki wystawiania cofnąłby jawnie podjętą decyzję. Portujemy tabelę i widok w trybie odczytu/ewidencji. |
| **K4** | **Poczta wypada z E7** | `components/crm/mail/MailClient.tsx` + `app/api/crm/mail/*` to tylko CRM-owa część skrzynki; reszta (`app/api/mail/*`, `app/api/mail-accounts/*`, `lib/mail/{crypto,server}.ts`) jest już objęta **E6d**. Handoff wprost zakazuje portowania poczty dwa razy. Pozycja menu `crm-poczta` powstaje dopiero z E6d. |
| **K5** | **Migracja dostaje numer `054`** | `053` jest zarezerwowane przez spec E6a (`053_chat.sql`). **Przy okazji: w repo są dwie migracje `050_`** — zacommitowana `050_ksiegowosc_schema.sql` i nieśledzona `050_drop_permissive_voucher_accounts_insert.sql`. To powtórka historycznego konfliktu `020_`; do przenumerowania w E7a. |
| **K6** | **Nowa grupa uprawnień „CRM" (klucze `crm.*`)** | Spec E6a świadomie **nie** użył klucza `crm.poczta` (decyzja K2 tamtej fali), bo CRM był wykluczony i klucz byłby martwą zależnością. Teraz grupa realnie powstaje — E6d ma się podpiąć pod `crm.poczta` zamiast tworzyć własny klucz. |
| **K7** | **`app/api/companies/sync-crm/route.ts` do usunięcia w E7a** | Route zwraca **mockowe firmy zaszyte w kodzie** (`Omega Logistics`, `Pixel Art Studio`, `Green Energy S.A.`) i wstawia je do produkcyjnej tabeli `companies` z `origin='CRM_SYNC'`. Jest to atrapa sprzed decyzji o CRM; po wejściu prawdziwego modułu to już tylko generator śmieci w bazie klientów. |
| **K9** | **Martwy kod BBS nie jest portowany** | 1 910 LOC (tabela wyżej) odwołuje się do tabel i kolumn, których nie ma w żywej bazie BBS, albo nie jest nigdzie importowane. Przeniesienie tego wprowadziłoby do EBS route'y, które wywalają się na pierwszym wywołaniu, i drugą, martwą implementację pipeline'u obok tej używanej. |
| **K8** | **Prowizje MLM zostają poza E7** | Rozbicie prowizji (self 10% / L1 5% / L2 2% / agent 10%) siedzi dziś po stronie CRM, a EBS wysyła kwotę bazową (`companies.fee_percent`, 15–31%). To zmiana reguły rozliczeń, nie port UI — wymaga osobnej decyzji usera. E7d portuje wyłącznie **prezentację** prowizji z `crm_invoices`. |

## 4. Architektura E7a

### 4.1 Migracja `054_crm_schema.sql`

Sześć tabel z introspekcji żywej bazy bbs-unified, bez kolumny `workspace` (K2):

| Tabela | Kolumny | Rola |
|---|---|---|
| `leads` | 16 → 15 | lejek sprzedaży (`status`, `assigned_to`, `contacts jsonb`) |
| `crm_activities` | 8 | historia działań na leadzie (`is_system` = wpisy automatyczne) |
| `crm_contacts` | 14 → 13 | osoby kontaktowe, `company_id` → `companies` |
| `crm_tasks` | 12 | zadania (E7b, tabela zakładana od razu) |
| `crm_offers` | 15 → 14 | wygenerowane oferty + `snapshot jsonb` (E7c) |
| `crm_invoices` | 18 → 17 | ewidencja prowizji (K3) |

Dodatkowo w `user_profiles` (K1): `manager_id`, `hierarchical_id`, `leadowiec_opiekun_id`
i flaga `is_agent_authorized` — agent NIE jest rolą, tylko uprawnieniem nakładanym na rolę
(tak jest w BBS; wpisanie go jako roli rozjechałoby CHECK-a). CHECK ról EBS rozszerzony
o `leadowiec` — z zachowaniem `hr`, `szef_koordynatorow` i `owner`, których BBS nie zna,
więc **nie kopiujemy jego wersji CHECK-a, tylko rozszerzamy naszą**.
Prywatny bucket `crm-offers`. RLS deny-all zgodnie z konwencją repo (aplikacja na `service_role`).

### 4.2 Moduły

- `lib/crm/visibility.ts` — port z gałęzią `owner` i `superadmin` → `null` (bez filtra); `partner`
  → tylko swoje; `menedzer`/`dyrektor` → poddrzewo po `manager_id`. Funkcja `admin()`
  **nie** jest odtwarzana — `lib/supabaseAdmin.admin` już istnieje i jest tym samym klientem;
  proteza z E2b staje się docelowym rozwiązaniem.
- `lib/crm/activities.ts` — wpisy do historii leada.
- `app/api/crm/leads/route.ts`, `leads/[id]/route.ts`, `leads/[id]/activities/route.ts` —
  service-role za `can('crm.pipeline')` / `can('crm.delete')`, brak sesji → **403**
  (wzorzec BBS/EBS, nie 401). Pozostałe cztery route'y leadów z BBS są martwe (K9).

### 4.3 UI

- `components/crm/pipeline/*` (kanban, karta leada, lista, panel szczegółów, panel aktywności,
  formularz dodania) — port 1:1.
- `components/adminNew/crm/CrmPipeline.tsx` + helpery — widok panelu.
- `views/DashboardAdminNew.tsx`: nowa zakładka `crm-pipeline` (E7a), reszta dokładana w E7b–E7e.

### 4.4 Uprawnienia i menu

Nowa grupa „CRM" w `lib/permissions/registry.ts`:

| Klucz | Etap |
|---|---|
| `crm.pipeline` | E7a |
| `crm.kontakty`, `crm.kalendarz` | E7b |
| `crm.kalkulator` | E7c |
| `crm.leaderboard`, `crm.org-chart` | E7d |
| `crm.notatki` | E7e |
| `crm.poczta` | rezerwacja dla E6d (K6) |
| `crm.delete` (action) | E7a |

Sekcja `── CRM ──` w `components/Sidebar.tsx` (statycznie dla superadmina/ownera) oraz wpisy
w `PERMISSION_MENU` z `section: 'CRM'` — role własne dostają menu dynamicznie, jak agencja.

## 5. Obsługa błędów

- Brak `manager_id` u użytkownika (NULL) → traktowany jak liść drzewa: widzi tylko swoje.
- Pusta lista widocznych id → zapytanie zwraca zero wierszy zamiast całej tabeli
  (`applyVisibilityFilter` ma już ten bezpiecznik — port bez zmian).
- Lead bez `assigned_to` widoczny tylko dla `menedzer`/`dyrektor`/`owner`/`superadmin`
  (`includeUnassigned`), żeby nowe leady nie ginęły.

## 6. Testy i weryfikacja

1. `npx tsc --noEmit` → 0 błędów (build ma `ignoreBuildErrors: true`, więc typy pilnujemy ręcznie).
2. `npm run build`.
3. E2E na danych tymczasowych: lead utworzony → przesunięty na kanbanie → aktywność w historii
   → usunięty; sprzątanie po teście.
4. Weryfikacja widoczności na kontach o różnych rolach — **nie deklarować, że działa,
   bez zalogowania się na każde**.
5. Audyt RLS po migracji (`rls-auditor`) — baza zawiera dane osobowe.
6. Deploy `npx vercel --prod` i sprawdzenie na produkcji.

## 7. Ryzyka

| Ryzyko | Ograniczenie |
|---|---|
| Role sieciowe nie istnieją w danych EBS — CRM byłby pusty poza superadminem | K1: gałąź `owner` + `manager_id`; nadanie ról to osobna czynność administracyjna, nie kod |
| Dublowanie poczty z E6d | K4: poczta całkowicie poza E7 |
| Cofnięcie decyzji „bez fakturowania w EBS" | K3: `crm_invoices` bez ścieżki wystawiania |
| Kolizja numerów migracji | K5: `054`, plus naprawa istniejącego duplikatu `050_` |
| Mockowy `sync-crm` zaśmieca produkcyjne `companies` | K7: usunięcie route'u w E7a |
| Rozjazd schematów Stratton CRM ↔ BBS | Wyniesione do E8 (§9) — E7 nie zakłada niczego o źródle danych |

## 8. Poza zakresem E7

- Migracja danych ze Stratton CRM (E8) i jakakolwiek dwukierunkowa synchronizacja (D6).
- Skrzynka pocztowa (E6d), komunikator (E6a–c).
- Zmiana reguł prowizji MLM (K8).
- Wystawianie faktur i KSeF (K3, decyzja E4).

## 9. Blokada E8 i niezadane pytanie

E8 (migracja danych) stoi na braku dostępu do bazy Stratton CRM: Supabase MCP widzi wyłącznie
konto `tjuszkiewicz-dev` (EBS `ramedybmybcpqvelsmxd` aktywny, BBS i BBS2 nieaktywne,
bbs-unified aktywny). Stratton CRM stoi na koncie „stratton dev". Odblokowanie po stronie
usera: przełączenie autoryzacji MCP albo eksport danych do pliku. **Poświadczeń nie przyjmujemy
w czacie.**

Pytanie, które trzeba zadać przed E8: **portujemy KOD z BBS, ale dane mają przyjść ze Stratton
CRM — to dwa różne systemy o prawdopodobnie różnych schematach.** Docelowe tabele są znane
(wyżej); schemat źródła nie. Mapowanie może być nietrywialne i to ono, nie sam import,
jest właściwą treścią E8.

## 10. Nowe zależności

| Pakiet | Etap | Po co |
|---|---|---|
| `d3` + `@types/d3` | E7d | org-chart |
| `imapflow`, `mailparser`, `@types/mailparser` | **E6d, nie E7** | skrzynka pocztowa (K4) |

`puppeteer-core`, `@sparticuz/chromium` i `sharp` są już w EBS (E2c/E2d) — generator ofert
w E7c korzysta z istniejącego `lib/pdf/renderer.ts`, nie z CRM-owego `lib/crm/offer/pdfRenderer.ts`.

## 11. Odłożone znalezisko (spoza zakresu, do decyzji usera)

W EBS trzy osoby mają po dwa konta — starsze z sufiksem `+cf03ed36e` (id firmy Stratton Prime,
utworzone 10.05) i nowsze (08.06, należące do Anezy, z voucherami). Jedno stare konto ma
zapisane logowanie (25.05), więc nie są puste. Kandydaci do `purge`/anonimizacji przez
`app/api/users/[id]/purge` — wymaga decyzji właściciela, bo tryb wybiera się po śladzie finansowym.

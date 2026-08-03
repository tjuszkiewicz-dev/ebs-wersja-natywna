# E6 — Komunikator i poczta (port z BBS)

Data: 2026-08-03
Status: spec do akceptacji
Poprzednie fale: E1 (shell), E2a–E2e (agencja), E4 (księgowość), E5 (rozszerzenia)

## 1. Kontekst i dekompozycja

E5 domknęła rozszerzenia modułów już działających. E6 wprowadza **dwa nowe, niezależne podsystemy**
z BBS: komunikator firmowy (~3400 LOC) i skrzynkę pocztową w panelu (~1650 LOC). Razem ponad 5000 LOC
— czterokrotność E5, więc rozbite na cztery etapy z osobnymi planami wykonania.

| Etap | Zakres | Skala | Status |
|---|---|---|---|
| **E6a** | Czat tekstowy: rozmowy 1:1 i grupowe, odczyty, „pisze…", cytaty, edycja, usuwanie, reakcje, wzmianki, szukanie, załączniki, zarządzanie grupą | ~2400 LOC | **ten spec** |
| **E6b** | Powiadomienia push (Web Push + service worker) | ~150 LOC | zarys |
| **E6c** | Rozmowy audio i wideo (WebRTC mesh do 6 osób), nagrywanie, notatka AI | ~700 LOC | zarys |
| **E6d** | Skrzynka pocztowa (IMAP/SMTP, wiele skrzynek, przypisania) | ~1650 LOC | zarys |

Kolejność zatwierdzona przez usera: **E6a → E6b → E6c → E6d**. Każdy etap wdrażany osobno.

## 2. Decyzje usera (2026-08-03)

| # | Decyzja | Wybór |
|---|---|---|
| D1 | Serwer TURN do rozmów wideo | **OpenRelay (darmowy, publiczny) na start**, zmienne `NEXT_PUBLIC_TURN_*` gotowe do podmiany |
| D2 | Kolejność etapów | Czat tekstowy → wideo → poczta |
| D3 | Kto z kim może pisać | Personel wewnętrzny między sobą; **pracownik tymczasowy wyłącznie ze swoim koordynatorem**; pracodawca i pracownik benefitowy bez czatu |
| D4 | Klucze powiadomień push | Generowane automatycznie i trzymane w bazie (wzorzec BBS) |
| D5 | Zakres poczty | Pełna skrzynka w panelu (E6d) |

**Sprostowanie do D1:** BBS nie ma własnego ani wykupionego TURN — używa darmowego publicznego
OpenRelay (metered.ca) z poświadczeniami wpisanymi w kodzie klienta (publiczne dane testowe,
nie sekret). User zdecydował świadomie, znając konsekwencje: przy nieudanym połączeniu bezpośrednim
dźwięk i obraz przechodzą przez serwer obcej firmy, bez gwarancji dostępności. Podmiana na własny
lub wykupiony serwer to zmiana trzech zmiennych środowiskowych, bez ruszania kodu.

## 3. Decyzje kontrolera

| # | Decyzja | Uzasadnienie |
|---|---|---|
| K1 | Realtime przez **broadcast**, nie `postgres_changes` | Tabele czatu mają RLS deny-all (aplikacja chodzi na service_role). `postgres_changes` nic by nie zobaczył. Alternatywa — otwarcie tabel na odczyt z przeglądarki — osłabiłaby bezpieczeństwo. Wzorzec przeniesiony z BBS świadomie. |
| K2 | Nowa grupa uprawnień **„Komunikator"** | BBS wiąże dostęp z kluczem `crm.poczta`; CRM jest wykluczony z EBS. Kopiowanie tego klucza wprowadziłoby martwą zależność. |
| K3 | `chat_policy` **projektowana od nowa**, nie portowana | Role BBS (`pracownik`, `klient`, `platnik`) nie odpowiadają rolom EBS. Port 1:1 dałby błędne uprawnienia. |
| K4 | **Nie portujemy** `components/employee/dashboard/secure-messenger/*` | To niepowiązana funkcja (efemeryczne szyfrowane pokoje), już obecna w EBS. Nie mylić z komunikatorem firmowym. |
| K5 | Purge rozszerzony **w E6a**, nie odłożony | E5 zostawiła `// TODO E6:` w `lib/users/accountPurge.ts`. Tabele czatu powstają w E6a, więc zależność domykamy od razu — inaczej pierwsze usunięcie konta zostawi sieroty. |
| K6 | Limit 6 osób w rozmowie grupowej **zostaje** | To ograniczenie architektury każdy-z-każdym. Zniesienie wymaga serwera mieszającego (SFU) — osobny projekt, poza E6. Udokumentować w UI. |

## 4. Architektura E6a

### 4.1 Migracja `053_chat.sql`

Sześć tabel, odtworzonych z użycia w kodzie BBS (BBS nie ma migracji — schemat żyje tylko w bazie):

- `chat_conversations` — `id`, `type` (`direct` | `group`), `name`, `created_at`, `updated_at`
- `chat_messages` — `id`, `conversation_id`, `sender_id`, `kind` (`text` | `system` | `file`),
  `content`, `file_name`, `file_path`, `reply_to_id`, `edited_at`, `deleted_at`, `created_at`
- `chat_participants` — `conversation_id`, `user_id`, `last_read_at`, `muted`, `pinned`, `archived`
- `chat_reactions` — `message_id`, `user_id`, `emoji`
- `chat_policy` — `role_a`, `role_b`, `allowed` (para posortowana alfabetycznie; brak wpisu = dozwolone)
- `chat_push_subscriptions` — `user_id`, `endpoint`, `p256dh`, `auth` (tworzona w E6a, używana w E6b)

RLS deny-all na wszystkich (konwencja repo — aplikacja chodzi na service_role).
Bucket Storage `chat-files` (private) na załączniki.
Migracja idempotentna (`IF NOT EXISTS`), zgodnie z konwencją repo.

### 4.2 Macierz uprawnień do rozmów (D3)

Personel wewnętrzny: `owner`, `superadmin`, `koordynator`, `platnik`, `hr`, `szef_koordynatorow`.
Piszą ze sobą bez ograniczeń.

`pracownik_tymczasowy` — **wyłącznie ze swoim koordynatorem** (`hr_employees.coordinator_id`).
To ograniczenie sprawdzane po stronie serwera przy tworzeniu rozmowy i przy wysyłce, nie tylko w UI.

`pracodawca` i `pracownik` (portal bonowy) — **bez dostępu do komunikatora**. To użytkownicy
zewnętrzni; ich kanałem kontaktu pozostaje istniejący formularz zgłoszeń do BOK.

Role sprzedażowe (`dyrektor`, `menedzer`, `partner`) — bez dostępu (w produkcyjnej bazie nikt ich nie ma).

Zaimplementowane jako `lib/chat/policy.ts` — **czysta funkcja** `canConverse(roleA, roleB, ctx)`,
pokryta testami, plus zasilenie tabeli `chat_policy` wartościami domyślnymi w migracji.

### 4.3 Czas rzeczywisty (K1)

Serwer po zapisie woła REST `POST {SUPABASE_URL}/realtime/v1/api/broadcast` na temat `user:{userId}`
ze zdarzeniem `message` / `read` / `update`. Klient subskrybuje **wyłącznie swój temat** i po sygnale
dociąga dane zwykłym autoryzowanym zapytaniem.

**Broadcast jest best-effort:** błąd wysyłki sygnału NIE może wywrócić zapisu wiadomości.
Izolowany `try/catch`, log, kontynuacja.

Kanały: `user:{userId}` (wiadomości), `chat_typing:{conversationId}` („pisze…").
Kanały rozmów głosowych (`call:*`, `chat-calls`) przychodzą w E6c.

### 4.4 Moduły

| Plik | Odpowiedzialność |
|---|---|
| `lib/chat/policy.ts` + test | Kto z kim może rozmawiać — czysta funkcja |
| `lib/chat/server.ts` | Gate uczestnictwa, mapa profili, pomocnicze zapytania |
| `lib/chat/realtime.ts` | Broadcast po zapisie (best-effort) |
| `components/chat/ChatApp.tsx` | UI komunikatora |
| `components/chat/ChatButton.tsx` | Widget w nagłówku + minimalizacja |
| `app/api/chat/*` | ~12 endpointów (rozmowy, wiadomości, uczestnicy, katalog, szukanie, obecność, upload) |

**Uwaga do dekompozycji:** w BBS `ChatApp.tsx` ma 1458 linii i miesza UI tekstu, zarządzanie grupą
i wywołania rozmów. Przy porcie **rozbić na mniejsze komponenty** (lista rozmów, wątek, panel grupy,
okno wiadomości) — plik tej wielkości jest trudny w utrzymaniu i będzie rósł w E6c.

### 4.5 Rozszerzenie usuwania kont (K5)

`lib/users/accountPurge.ts` — do listy tabel kasowanych dopisać `chat_participants`,
`chat_reactions`, `chat_push_subscriptions`. `chat_messages.sender_id` **zostaje** (treść wiadomości
to historia firmy; znika powiązanie z osobą, nie treść) — analogicznie do BBS i do decyzji z E5
o kartotece kadrowej. Usunąć komentarz `// TODO E6:` i zaktualizować `RETAINED_PERSONAL_DATA`,
żeby podsumowanie przed usunięciem konta jawnie mówiło, że **treści wiadomości pozostają**.

To jest istotne dla RODO: właściciel musi wiedzieć, że wiadomości napisane przez usuwaną osobę
zostają w rozmowach innych osób.

## 5. Obsługa błędów

- **Broadcast nie dochodzi** → wiadomość i tak zapisana; klient zobaczy ją przy następnym odświeżeniu
  albo wejściu w rozmowę. Zero utraty danych.
- **Brak uprawnienia do rozmowy** → 403 po stronie serwera, niezależnie od tego, co pokazuje UI.
- **Załącznik przekracza limit** → czytelny komunikat, nie cichy błąd.
- **Brak sesji** w `app/api/chat/*` → **403** (konwencja repo dla modułów wewnętrznych).

## 6. Testy i weryfikacja

- `lib/chat/policy.ts` — testy jednostkowe: każda para ról, pracownik tymczasowy ze swoim i z cudzym
  koordynatorem, role bez dostępu.
- Rozszerzenie purge — test, że nowe tabele są w liście kasowanych i że `chat_messages` **nie jest**.
- `npx tsc --noEmit`, `npm test`, **`npx next build`** po każdym zadaniu dotykającym `app/api/**`.
- Smoke ręczny: rozmowa 1:1 między dwoma kontami, grupa, załącznik, edycja, usunięcie, reakcja.

## 7. Ryzyka

| Ryzyko | Mitygacja |
|---|---|
| Schemat odtwarzany z kodu, nie z migracji BBS | Weryfikacja przez introspekcję żywej bazy BBS (tylko odczyt) przed napisaniem migracji |
| `ChatApp.tsx` 1458 linii — trudny w utrzymaniu, urośnie w E6c | Rozbicie na mniejsze komponenty przy porcie (§4.4) |
| Macierz uprawnień projektowana od nowa — łatwo o dziurę | Czysta funkcja pokryta testami; sprawdzenie po stronie serwera, nie tylko w UI |
| Broadcast wywraca zapis wiadomości | Izolowany `try/catch`, best-effort (§4.3) |
| Pierwsze usunięcie konta zostawia sieroty | Purge rozszerzony w tym samym etapie (K5) |

## 8. Poza zakresem E6a

- Powiadomienia push (E6b), rozmowy audio i wideo (E6c), skrzynka pocztowa (E6d).
- Zniesienie limitu 6 osób w rozmowie grupowej (K6) — wymagałoby serwera mieszającego.
- Port `secure-messenger` (K4) — niepowiązana funkcja.
- **Poczta wnosi dwa problemy do rozstrzygnięcia w E6d, odnotowane tutaj, żeby nie umknęły:**
  BBS ma własny cron alertów wygasania, który dublowałby istniejący cron EBS z E5 (a plan Vercel
  dopuszcza dwa crony na dobę i jeden jest zajęty) — trzeba **scalić**, nie kopiować. Oraz kolizja
  nazw zmiennych (`MAIL_*` w BBS kontra `SMTP_*` w EBS) — zmapować na istniejące, nie dublować sekretów.

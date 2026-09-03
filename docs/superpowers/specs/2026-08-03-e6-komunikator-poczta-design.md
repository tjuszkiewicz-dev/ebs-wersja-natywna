# E6 — Komunikator i poczta (port z BBS)

Data: 2026-08-03 · **Rewizja: 2026-09-03** (po falach E7a–E7e i E8; po introspekcji żywej bazy BBS)
Status: **zaakceptowany** (D1–D5 z 03.08.2026, D6–D7 z 03.09.2026) — **E6a wdrożone na produkcję
03.09.2026** (commit `b889a89` + poprawki UI po smoke-teście); E6b–E6d otwarte
Poprzednie fale: E1 (shell), E2a–E2e (agencja), E4 (księgowość), E5 (rozszerzenia),
**E7a–E7e (CRM), E8 (migracja danych ze Stratton CRM)**

## 0. Rewizja 2026-09-03 — co się zmieniło względem wersji z 03.08 i dlaczego

Spec powstał miesiąc przed E7/E8 i część jego założeń przestała być prawdziwa. Sesja z 02.09
tego nie zauważyła (planowała pisać nowy spec od zera), więc poniżej dziennik korekt — każda
zweryfikowana w kodzie albo w żywej bazie, nie z pamięci.

| # | Było (03.08) | Jest (03.09) | Skutek dla E6 |
|---|---|---|---|
| R1 | K2: „CRM jest wykluczony z EBS, klucz `crm.poczta` wprowadziłby martwą zależność" | E7a **wprowadziło CRM do EBS** i zarezerwowało `crm.poczta` w `lib/permissions/registry.ts:69` | E6d **używa `crm.poczta`**, nie dubluje klucza. Komunikator dalej dostaje własną grupę — ale z innego powodu (K2 przepisane). |
| R2 | §4.2: role sprzedażowe „bez dostępu (w produkcyjnej bazie nikt ich nie ma)" | Po E8: `partner` 1, `dyrektor` 1, `leadowiec` 1 — **to zespół sprzedaży Strattona** | Macierz przepisana wg D6: cała firma ma komunikator, bez dostępu tylko `pracodawca` i `pracownik`. |
| R3 | §4.1: schemat „odtworzony z użycia w kodzie" | Introspekcja `bbs-unified` (`pcszyyjwrkkkgbbcpzhn`) wykazała **5 brakujących kolumn** i `kind` z **6** wartościami zamiast 3 | Migracja 053 pisana z introspekcji (§4.1). Bez tego E6c musiałoby robić `ALTER` na żywej tabeli wiadomości. |
| R4 | bucket `chat-files` | w kodzie BBS bucket nazywa się **`chat-media`** | Nazwa z kodu, żeby port route'ów nie wymagał przepisywania ścieżek. |
| R5 | `chat_policy` „zasilona wartościami domyślnymi" | W BBS tabela jest **pusta** (0 wierszy) — polityka nigdy tam nie zadziałała; cała logika siedzi w `NON_STAFF_ROLES` w kodzie | K3 potwierdzone: polityka to czysta funkcja; tabela zostaje jako mechanizm blokad par ról dla właściciela. |
| R6 | brak | EBS **nie ma `user_profiles.last_seen_at`** (wskaźnik „online" w katalogu) | Kolumna dochodzi w 053. |
| R7 | brak | `lib/crm/profiles.ts` (E7b) ma już `profilesMap`, wyjęty z BBS-owego `lib/chat/server` | `lib/chat/server.ts` **importuje**, nie dubluje (K13). |
| R8 | brak | BBS `transcribe` zapisuje do `meeting_notes` (8 kolumn) i `calendar_events`/`app_tasks` — te dwie ostatnie EBS ma od E7b, `calendar_events.conversation_id` czeka na FK do czatu (056) | FK domykane w 053; `meeting_notes` → E6c. |
| R9 | D3: pracownik tymczasowy tylko ze swoim koordynatorem — „zaimplementowane w policy" | Portal pracownika ma od E2e schowany panel „Komunikator" (`{false && <WorkerChat />}`) z obietnicą auto-tłumaczenia, a `hr_employees.language` istnieje | D7 (tłumaczenie w E6a) domyka tę pętlę: kanał pracownik↔koordynator wchodzi do E6a (§4.7). |
| R10 | brak | EBS nie ma `app_config` (BBS trzyma tam klucze VAPID), ani zależności `web-push`, `imapflow`, `mailparser` | Odnotowane w zarysach E6b/E6d (§8), żeby nie odkrywać tego w trakcie. |

## 1. Kontekst i dekompozycja

E5 domknęła rozszerzenia modułów już działających, E7 wniosło CRM, E8 dane. E6 wprowadza **dwa nowe,
niezależne podsystemy** z BBS: komunikator firmowy (~3000 LOC: 14 route'ów, 3 pliki `lib/chat`,
`ChatApp.tsx` 1458 linii, `VoiceCall.tsx` 342) i skrzynkę pocztową w panelu (~1425 LOC: 9 route'ów,
`lib/mail/server.ts` 502, `MailClient.tsx` 575). **Moduł w BBS jest żywy** (`ChatApp` 5 importów,
`MailClient` 2) — pułapka K9 z E7 tu nie zachodzi, sprawdzone grepem po importach.

| Etap | Zakres | Skala | Status |
|---|---|---|---|
| **E6a** | Czat tekstowy: rozmowy 1:1 i grupowe, katalog firmowy, odczyty ✓✓, „pisze…", cytaty, edycja, usuwanie, reakcje, wzmianki, szukanie w treści, załączniki i głosówki, zarządzanie grupą, **tłumaczenie wiadomości (D7)**, **kanał pracownik↔koordynator** | ~2600 LOC | **ten spec — w realizacji** |
| **E6b** | Powiadomienia push (Web Push + service worker) | ~150 LOC | zarys (§8) |
| **E6c** | Rozmowy audio i wideo (WebRTC mesh do 6 osób), nagrywanie, transkrypcja i notatka AI | ~800 LOC | zarys (§8) |
| **E6d** | Skrzynka pocztowa (IMAP/SMTP, wiele skrzynek, przypisania) pod kluczem `crm.poczta` | ~1425 LOC | zarys (§8) |

Kolejność zatwierdzona przez usera: **E6a → E6b → E6c → E6d**. Każdy etap wdrażany osobno.

## 2. Decyzje usera

| # | Data | Decyzja | Wybór |
|---|---|---|---|
| D1 | 03.08 | Serwer TURN do rozmów wideo | **OpenRelay (darmowy, publiczny) na start**, zmienne `NEXT_PUBLIC_TURN_*` gotowe do podmiany |
| D2 | 03.08 | Kolejność etapów | Czat tekstowy → push → wideo → poczta |
| D3 | 03.08 | Kto z kim może pisać | Personel wewnętrzny między sobą; **pracownik tymczasowy wyłącznie ze swoim koordynatorem**; pracodawca i pracownik benefitowy bez czatu |
| D4 | 03.08 | Klucze powiadomień push | Generowane automatycznie i trzymane w bazie (wzorzec BBS) |
| D5 | 03.08 | Zakres poczty | Pełna skrzynka w panelu (E6d) |
| **D6** | **03.09** | Role sprzedażowe w komunikatorze (partner/dyrektor/leadowiec — dziś 3 osoby) | **„Komunikator ma cały trzon handlowy, HR — cała nasza firma. Tylko obcy nie mają": bez dostępu wyłącznie `pracodawca` i `pracownik`.** Doprecyzowanie D3, nie jego zmiana. |
| **D7** | **03.09** | Tłumaczenie wiadomości (kolumny `translated_*` z bazy BBS, których spec nie znał) | **Pełne tłumaczenie już w E6a** — nie tylko kolumny. |

**Sprostowanie do D1:** BBS nie ma własnego ani wykupionego TURN — używa darmowego publicznego
OpenRelay (metered.ca) z poświadczeniami wpisanymi w kodzie klienta (publiczne dane testowe,
nie sekret). User zdecydował świadomie, znając konsekwencje: przy nieudanym połączeniu bezpośrednim
dźwięk i obraz przechodzą przez serwer obcej firmy, bez gwarancji dostępności. Podmiana na własny
lub wykupiony serwer to zmiana trzech zmiennych środowiskowych, bez ruszania kodu.

## 3. Decyzje kontrolera

| # | Decyzja | Uzasadnienie |
|---|---|---|
| K1 | Realtime przez **broadcast**, nie `postgres_changes` | Tabele czatu mają RLS deny-all (aplikacja chodzi na service_role). `postgres_changes` nic by nie zobaczył. Alternatywa — otwarcie tabel na odczyt z przeglądarki — osłabiłaby bezpieczeństwo. Wzorzec przeniesiony z BBS świadomie. |
| K2 *(przepisane 03.09)* | Nowa grupa uprawnień **„Komunikator"** z jednym kluczem `komunikator.czat`; **poczta (E6d) pod istniejącym `crm.poczta`** | Pierwotne uzasadnienie („CRM wykluczony") upadło — CRM jest w EBS od E7a. Grupa zostaje z innego powodu: komunikator wg D6 jest **ogólnofirmowy**, a nie sprzedażowy, więc wieszanie go pod `crm.*` dałoby błędne domyślne zestawy (klucze `crm.*` dostają tylko role sprzedażowe). BBS nie ma na czacie żadnej bramki poza zalogowaniem — w EBS każdy route czatu przechodzi przez `can(auth,'komunikator.czat')`. |
| K3 | `chat_policy` **projektowana od nowa**, nie portowana | W BBS tabela jest pusta, a logikę niesie tablica `NON_STAFF_ROLES` w kodzie (`pracownik`, `pracownik_tymczasowy`, `klient`, `platnik`). Role BBS nie odpowiadają rolom EBS (BBS wyklucza `platnik`, EBS wg D6 nie). Port 1:1 dałby błędne uprawnienia. |
| K4 | **Nie portujemy** `components/employee/dashboard/secure-messenger/*` | To niepowiązana funkcja (efemeryczne szyfrowane pokoje), już obecna w EBS. Nie mylić z komunikatorem firmowym. |
| K5 | Purge rozszerzony **w E6a**, nie odłożony | E5 zostawiła `// TODO E6:` w `lib/users/accountPurge.ts:99`. Tabele czatu powstają w E6a, więc zależność domykamy od razu — inaczej pierwsze usunięcie konta zostawi sieroty. `mail_account_users` → E6d. |
| K6 | Limit 6 osób w rozmowie grupowej **zostaje** | Ograniczenie architektury każdy-z-każdym (WebRTC mesh). Zniesienie wymaga serwera mieszającego (SFU) — osobny projekt, poza E6. Dotyczy E6c; udokumentować w UI. |
| **K7** | `chat_messages.sender_id` **nullowalny z FK `ON DELETE SET NULL`** (w BBS `NOT NULL`, bez FK) | Tryb PURGE z E5 fizycznie kasuje `user_profiles`. Przy `NOT NULL` bez FK zostałby wskaźnik-widmo; przy `NOT NULL` z FK PURGE by się wywalił. `SET NULL` realizuje §4.5: treść zostaje jako historia firmy, znika powiązanie z osobą (UI: „konto usunięte"). |
| **K8** | **FK do `user_profiles(id)` na każdej kolumnie użytkownika** (`chat_participants`, `chat_reactions`, `chat_push_subscriptions` → CASCADE; `created_by` → SET NULL) | Precedens E7b (`calendar_attendees`): BBS nie ma tych FK, więc usunięcie konta zostawia sieroty. Purge i tak kasuje jawnie (K5) — FK to siatka bezpieczeństwa, nie mechanizm. |
| **K9** | **Bez triggera audytu na `chat_messages` i `chat_reactions`**; triggery `fn_audit_log` tylko na `chat_conversations` i `chat_participants` | `fn_audit_log` kopiuje `to_jsonb(NEW)` — na wiadomościach skopiowałby **treść prywatnych rozmów** do `audit_log` przy każdym wpisie i edycji, a wolumen jest wysoki. To samo ustalenie, które w E7d wymusiło własną funkcję dla `user_profiles`. Zdarzenia, które BBS logował przez `logEvent` (utworzenie grupy, zmiana nazwy, dodanie/usunięcie uczestnika), pokrywają triggery na dwóch pozostałych tabelach. Usunięcie własnej wiadomości nie jest audytowane — to decyzja użytkownika o własnej treści. |
| **K10** | Bucket **`chat-media`** (private) | Nazwa z kodu route'ów BBS (R4). |
| **K11** | Dostęp = **uprawnienie `komunikator.czat`**, polityka = **czysta funkcja po wykluczeniu** | `EXTERNAL_ROLES = ['pracodawca','pracownik']` → brak dostępu; `pracownik_tymczasowy` → ograniczony (D3); **każda inna rola, w tym własne z `app_roles`** → personel wewnętrzny. Definicja „po wykluczeniu" jest wierna słowom usera („tylko obcy nie mają") i nie wymaga edycji przy każdej nowej roli własnej. `leadowiec` istnieje w `user_profiles`, ale **nie w `app_roles`** — definicja po wykluczeniu obejmuje go bez specjalnego wpisu. |
| **K12** | Brak sesji lub uprawnienia → **403**, nie 401 | Konwencja EBS dla modułów wewnętrznych (E2b, E7). BBS zwraca 401. |
| **K13** | `profilesMap` **importowany z `lib/crm/profiles`**, nie dublowany | R7. Różnica kontraktu: EBS-owy zwraca `ProfileLite` z polami nullowalnymi — port dokłada `?.full_name || '—'`. |
| **K14** | Tłumaczenie: **na żądanie** dla personelu, **automatyczne przy wysyłce** w rozmowach z pracownikiem tymczasowym; jedna pamięć podręczna w kolumnach `translated_content`/`translated_lang` | Szczegóły w §4.6. Silnik: istniejący `lib/hr/translateCore.translateWithClaude` (E2d), nie nowy prompt. Dzienny limit `consumeTranslator` **tylko dla `pracownik_tymczasowy`** — jak w E2d. |
| **K15** | Kanał pracownik↔koordynator = **cienka nakładka na te same tabele czatu** (`/api/me/worker/chat`), nie osobna tabela | Koordynator widzi rozmowę z pracownikiem w zwykłym komunikatorze; pracownik — w uproszczonym panelu portalu. Jedna historia, dwa widoki. Kontrakt endpointu narzuca istniejący stub `WorkerChat` w `TempWorkerDashboard.tsx` (`{messages, no_coordinator}` / `{content}`). |
| **K16** | Route `chat/policy` (GET/POST, tylko właściciel) portowany, **UI macierzy odłożone** | 47 linii, blokady par ról działają przez API i tabelę. Ekran „Ustawienia → Komunikator" z BBS nie ma w EBS gospodarza (panel ustawień ownera z E1 to inna struktura) — dojdzie, gdy właściciel pierwszy raz zechce coś zablokować. |
| **K17** | E6a **wycina** z portu: rozmowy głosowe/wideo, nagrywanie, transkrypcję, subskrypcję push. Schemat jest jednak **kompletny od razu** | Kod tych funkcji wraca w E6b/E6c bez `ALTER` na tabelach czatu (R3). Jedyna nowa tabela później to `meeting_notes` (E6c). |
| **K18** | `user_profiles.last_seen_at timestamptz` w 053 | R6 — obecność („online" = ślad z ostatnich 3 minut, heartbeat z otwartego komunikatora). |
| **K19** | Nazwy kanałów Realtime **z kodu**: `user:{userId}`, `typing:{conversationId}`; `chat-calls` zarezerwowany dla E6c | Spec z 03.08 podawał `chat_typing:*` — w kodzie jest `typing:*`. |

## 4. Architektura E6a

### 4.1 Migracja `053_chat.sql` — schemat z introspekcji żywej bazy BBS (R3)

Numer `053` czeka od E7a (dziura w numeracji między 052 a 054 jest zamierzona). Idempotentnie
(`IF NOT EXISTS`), RLS deny-all na wszystkich tabelach.

**`chat_conversations`** — `id uuid PK`, `type text NOT NULL DEFAULT 'direct' CHECK (direct|group)`,
`name text`, **`created_by uuid`** → `user_profiles(id) ON DELETE SET NULL`, `created_at`, `updated_at`.

**`chat_messages`** — `id uuid PK`, `conversation_id` → `chat_conversations(id) ON DELETE CASCADE`,
**`sender_id uuid NULL`** → `user_profiles(id) ON DELETE SET NULL` (K7),
`kind text NOT NULL DEFAULT 'text' CHECK (text|audio|file|image|system|recording)`, `content text`,
`file_path text`, `file_name text`, **`duration_sec numeric`**, **`translated_content text`**,
**`translated_lang text`**, `reply_to_id` → `chat_messages(id) ON DELETE SET NULL`,
`edited_at`, `deleted_at`, `created_at`.
Indeksy: `(conversation_id, created_at DESC)`, `(reply_to_id)`, **GIN `content gin_trgm_ops`**
(`pg_trgm` w EBS jest — zweryfikowane `pg_extension`).

**`chat_participants`** — `PK (conversation_id, user_id)`, `conversation_id` CASCADE,
`user_id` → `user_profiles(id) ON DELETE CASCADE` (K8), **`joined_at`**, `last_read_at NOT NULL DEFAULT now()`,
`muted`, `pinned`, `archived` (bool NOT NULL DEFAULT false). Indeks `(user_id)`.

**`chat_reactions`** — `PK (message_id, user_id, emoji)`, `message_id` CASCADE, `user_id` CASCADE, `created_at`.
Indeks `(message_id)`.

**`chat_policy`** — `id uuid PK`, `role_a`, `role_b` (text NOT NULL), `allowed bool NOT NULL DEFAULT true`,
`UNIQUE (role_a, role_b)`. Para posortowana alfabetycznie; brak wpisu = dozwolone. **Bez seedów** (K3).

**`chat_push_subscriptions`** — `endpoint text PK`, `user_id` → `user_profiles(id) ON DELETE CASCADE`,
`p256dh`, `auth` (text NOT NULL), `created_at`. Indeks `(user_id)`. Tworzona teraz, używana w E6b.

**Poza tabelami czatu:**
- `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz` (K18).
- `ALTER TABLE calendar_events ADD CONSTRAINT … FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE SET NULL` — obietnica z migracji 056 (R8).
- `INSERT INTO storage.buckets ('chat-media', private) ON CONFLICT DO NOTHING` (K10).
- Triggery `fn_audit_log` na `chat_conversations` i `chat_participants`; **na `chat_messages` i `chat_reactions` NIE** (K9).

### 4.2 Macierz uprawnień do rozmów (D3 + D6)

Dwie warstwy, obie po stronie serwera:

**Warstwa 1 — czy w ogóle masz komunikator:** `can(auth, 'komunikator.czat')` na każdym route'cie
`app/api/chat/*` i `me/worker/chat`. Domyślnie w `DEFAULT_ROLE_PERMS` dla **wszystkich ról poza
`pracodawca` i `pracownik`** (w tym `pracownik_tymczasowy` — jego ograniczenia niesie warstwa 2).
Superadmin i owner mają wszystko z definicji.

**Warstwa 2 — z kim wolno rozmawiać** (`lib/chat/policy.ts`, czysta funkcja, testy jednostkowe):

| Rola A ↔ Rola B | Wynik |
|---|---|
| personel ↔ personel | dozwolone (chyba że para zablokowana w `chat_policy`) |
| `pracownik_tymczasowy` ↔ jego koordynator (`hr_employees.coordinator_id`) | dozwolone |
| `pracownik_tymczasowy` ↔ ktokolwiek inny (także drugi pracownik tymczasowy) | **403** |
| `pracownik_tymczasowy` bez przypisanego koordynatora | brak rozmówcy — portal pokazuje komunikat „Nie masz jeszcze przypisanego koordynatora" (stub z E2e) |
| `pracodawca` / `pracownik` ↔ ktokolwiek | nie dochodzi do warstwy 2 — odcięci w warstwie 1 |
| `superadmin` / `owner` ↔ ktokolwiek | dozwolone (także z pracownikiem tymczasowym — do testów i interwencji) |

„Personel" = każda rola spoza `EXTERNAL_ROLES = ['pracodawca','pracownik']` i różna od
`pracownik_tymczasowy` (K11). Dzisiejszy personel w produkcji: `owner` 1, `superadmin` 3,
`dyrektor` 1, `partner` 1, `leadowiec` 1; role agencyjne (`koordynator`, `platnik`,
`szef_koordynatorow`, `hr`) mają definicje, ale jeszcze bez użytkowników.

Katalog firmowy (`GET /api/chat/directory`) pokazuje personel; pracownicy tymczasowi **nie są w
katalogu** — koordynator dociera do nich przez rozmowę założoną z portalu pracownika albo przez
własną listę (`GET /api/chat/directory?workers=1` zwraca *jego* pracowników z `hr_employees`, jeśli ma
`agencja.kontrakty`). Zapis sprawdzany przy tworzeniu rozmowy, dodawaniu uczestników **i przy każdej
wysyłce** — nie tylko w UI.

### 4.3 Czas rzeczywisty (K1, K19)

Serwer po zapisie woła REST `POST {SUPABASE_URL}/realtime/v1/api/broadcast` na temat `user:{userId}`
ze zdarzeniem `chat` i ładunkiem `{type: 'message'|'read'|'update', conversation_id, from}`. Klient
subskrybuje **wyłącznie swój temat** i po sygnale dociąga dane zwykłym autoryzowanym zapytaniem.
Odpytywanie zostaje jako zapas (lista 20 s, otwarta rozmowa 15 s, katalog 10 s — jak w BBS).

**Broadcast jest best-effort:** błąd wysyłki sygnału NIE może wywrócić zapisu wiadomości.
Izolowany `try/catch`, log, kontynuacja.

„Pisze…" idzie kanałem klient↔klient `typing:{conversationId}` (bez zapisu w bazie, maks. 1 sygnał/2 s,
znika po 4 s ciszy). Kanał `chat-calls` (sygnalizacja połączeń) przychodzi w E6c.

### 4.4 Moduły

| Plik | Odpowiedzialność | Źródło |
|---|---|---|
| `lib/chat/policy.ts` + `policy.test.ts` | `EXTERNAL_ROLES`, `isStaff`, `canConverse(a, b, ctx)` — czysta funkcja | od nowa (K3) |
| `lib/chat/server.ts` | `isParticipant`, `getBlockedPairs`, `pairKey`, `assertCanConverse` (ładuje role + koordynatora i woła `policy`) | port 35 linii, bez `profilesMap` (K13) |
| `lib/chat/realtime.ts` | `notifyChatUsers` — broadcast po zapisie (best-effort) | port 1:1 |
| `lib/chat/format.ts` | `tTime`, `tDay`, `fmtDur`, `initials`, `hue`, `previewOf(kind)` — dziś powielone w 3 miejscach `ChatApp.tsx` | wyjęte |
| `app/api/chat/{conversations, conversations/[id], …/messages, …/messages/[msgId], …/reactions, …/participants, …/participants/[userId], directory, policy, presence, search, upload, users}` | 13 route'ów | port + bramka `can()` + 403 (K12) + bez `logEvent`/`sendPushTo` |
| `app/api/chat/conversations/[id]/messages/[msgId]/translate` | **nowy** — tłumaczenie na żądanie (§4.6) | od nowa |
| `app/api/me/worker/chat` | **nowy** — kanał pracownika (§4.7) | od nowa, kontrakt ze stubu E2e |
| `components/chat/ChatButton.tsx` | przycisk w nagłówku z licznikiem nieprzeczytanych; w E6c dojdzie nasłuch połączeń | wydzielony z `ChatApp.tsx:1353` |
| `components/chat/ChatApp.tsx` | powłoka: stan rozmów/wiadomości, Realtime, obecność, minimalizacja | rdzeń `ChatApp.tsx:62` |
| `components/chat/ConversationList.tsx` (+ `ConvRow`) | lewy panel: grupy, wyniki szukania, archiwum, katalog | `ChatApp.tsx:666–781, 1231` |
| `components/chat/MessageThread.tsx` (+ `MessageBubble`) | prawy panel: nagłówek, lista, dymki, akcje, pasek pisania, głosówka | `ChatApp.tsx:784–1008, 823–929` |
| `components/chat/GroupPanel.tsx` | nazwa, uczestnicy, opuszczenie grupy | `ChatApp.tsx:1015–1052` |
| `components/chat/modals/{NewChatModal, AddPeopleModal}.tsx` | wybór osób | `ChatApp.tsx:1095, 1286` |
| `components/chat/Avatar.tsx` | inicjały / ikona grupy | `ChatApp.tsx:53` |
| `components/worker/WorkerChat.tsx` | panel „Komunikator" portalu pracownika | wyjęty ze stubu w `TempWorkerDashboard.tsx:19` |

**Dlaczego rozbicie, a nie port 1:1:** `ChatApp.tsx` w BBS ma 1458 linii i miesza UI tekstu,
zarządzanie grupą, sygnalizację połączeń i push. E6c dołoży do niego rozmowy głosowe — plik
dwutysięczny jest poza możliwością rozsądnej recenzji. Podział wg wierszy źródła podany wyżej,
żeby port dało się zweryfikować fragment po fragmencie.

**Stylistyka:** BBS ma kolory WhatsAppa zaszyte w stałej `WA` (`#008069`, `#efeae2`, `#d9fdd3`).
EBS zachowuje układ (dwa panele, dymki, ✓✓), ale bierze kolory z palety `primary-*` projektu —
komunikator ma wyglądać jak część EBS, nie jak wklejony cudzy produkt.

### 4.5 Rozszerzenie usuwania kont (K5, K7)

`lib/users/accountPurge.ts`:
- `OWNED_TABLES` += `chat_participants.user_id`, `chat_reactions.user_id`, `chat_push_subscriptions.user_id`
  (kasowane w obu trybach — uczestnictwo i reakcje martwego konta nie mają wartości, subskrypcja push
  to żywy kanał bez właściciela).
- `DETACH_TABLES` += `chat_messages.sender_id` (**`purgeOnly`**), `chat_conversations.created_by` (`purgeOnly`).
  Przy anonimizacji profil zostaje jako „Konto usunięte", więc wskaźnik nie jest sierotą i nazwa
  w dymku degraduje się sama.
- `RETAINED_PERSONAL_DATA` += `chat_messages`: „Treści wiadomości napisanych przez tę osobę **ZOSTAJĄ**
  w rozmowach innych osób (historia firmy); znika tylko powiązanie z kontem". Właściciel musi to
  zobaczyć przed potwierdzeniem — RODO.
- `IMPACT_COUNTS` += `chat_messages.sender_id` („wiadomości w komunikatorze — treść zostaje").
- Usunąć komentarz `// TODO E6:` w całości; `mail_account_users` dopisze E6d z własnym TODO.
- Test: nowe tabele są w listach, `chat_messages` **nie jest** w `OWNED_TABLES`.

### 4.6 Tłumaczenie wiadomości (D7, K14)

Silnik: `translateWithClaude(text, target)` z `lib/hr/translateCore` (E2d) — wykrywa język źródłowy,
zwraca tłumaczenie. Języki: słownik `LANGS` (26 kodów). Bez nowego promptu.

**Na żądanie (personel):** przycisk „Przetłumacz" na cudzej wiadomości tekstowej →
`POST …/messages/[msgId]/translate {target?}` (domyślnie `pl`) → serwer sprawdza uczestnictwo,
tłumaczy, zapisuje `translated_content` + `translated_lang`, oddaje tłumaczenie. Ponowne żądanie
w tym samym języku wraca z pamięci podręcznej bez wołania Claude; inny język — nadpisuje.
UI pokazuje tłumaczenie pod oryginałem z przełącznikiem „pokaż oryginał".

**Automatycznie (kanał pracownik↔koordynator):** gdy w rozmowie 1:1 jeden z uczestników jest
`pracownik_tymczasowy`, `POST …/messages` **tłumaczy synchronicznie przed odpowiedzią**:
pracownik → koordynator: cel `pl`; koordynator → pracownik: cel z `hr_employees.language`
(brak → bez tłumaczenia). Wiadomości są krótkie, uczestników dwóch — opóźnienie 1–3 s jest
akceptowalne, a obietnica ze stubu E2e („koordynator dostaje tłumaczenie po polsku, a Ty jego
odpowiedzi w swoim języku") jest spełniona natychmiast, nie „kiedyś po odświeżeniu".
Wersja asynchroniczna (`after()` z `next/server`) odrzucona: wymagałaby drugiego broadcastu
i obsługi stanu „tłumaczenie w toku" po obu stronach.

**Koszty i limity:** `consumeTranslator(auth, TEXT_COST_S)` wołany **tylko** gdy nadawcą jest
`pracownik_tymczasowy` (10 min/dzień z E2d; tłumaczenie tekstu = 15 s umownie). Personel bez limitu,
jak w Tłumaczu. Wyczerpany limit → wiadomość **idzie bez tłumaczenia** (429 tylko w Tłumaczu; w czacie
brak tłumaczenia nie może blokować komunikacji z koordynatorem).

**AI-guard (E2d):** brak `ANTHROPIC_API_KEY` → wiadomość zapisana bez tłumaczenia, endpoint
`translate` zwraca 200 `{ok:false, disabled:true}`, UI pokazuje „Tłumaczenie wyłączone". Zero crashy.

### 4.7 Kanał pracownik↔koordynator (K15)

`GET /api/me/worker/chat` — rola `pracownik_tymczasowy` + `can('komunikator.czat')`; znajduje
`hr_employees` po `user_id`, bierze `coordinator_id`; brak → `{messages: [], no_coordinator: true}`.
Inaczej: znajduje-lub-tworzy rozmowę `direct` z koordynatorem i zwraca ostatnie 100 wiadomości
w kształcie stubu: `{id, mine, content, translated, created_at}`.
`POST` `{content}` → jak zwykła wysyłka (przez tę samą logikę co `…/messages`, z auto-tłumaczeniem
§4.6), 403 gdy polityka odmówi.

Portal: `TempWorkerDashboard.tsx` — usunąć `{false &&}`, przywrócić zakładkę „Komunikator" w `TABS`,
`WorkerChat` przeniesiony do własnego pliku. Odpytywanie co 8 s zostaje (portal nie ma subskrypcji
Realtime i w E6a jej nie dostaje — pracownik ma jednego rozmówcę, nie potrzebuje natychmiastowości
kosztem kolejnego kanału).

Koordynator: rozmowa pojawia się u niego w zwykłym `ChatApp` z nazwą pracownika i etykietą roli;
katalog pracowników koordynatora (§4.2) pozwala mu zacząć rozmowę pierwszemu.

### 4.8 Montaż w layoutach

| Layout | Kto | Montaż |
|---|---|---|
| `AdminDashboardClient` | superadmin, owner, role agencyjne, role własne | `<ChatButton meId>` w nagłówku obok `NotificationCenter`, renderowany gdy `/api/me/permissions` zawiera `komunikator.czat` (jeden fetch już tam jest — rozszerzyć o `permissions`) |
| `NetworkDashboardClient` | `dyrektor`, `menedzer`, `partner` | layout **nie ma nagłówka** — `DashboardSales` renderuje własną treść. `ChatButton` w wariancie **pływającym** (prawy dolny róg), ta sama bramka |
| `TempWorkerDashboard` | `pracownik_tymczasowy` | zakładka „Komunikator" → `WorkerChat` (§4.7) |
| `EmployeeDashboardClient`, `EmployerDashboardClient` | `pracownik`, `pracodawca` | **nic** — role zewnętrzne (D6) |

`leadowiec` loguje się przez `postLoginRedirect` tam, gdzie kierują go jego appki — dostaje
`ChatButton` z layoutu, w którym wyląduje; bramka jest w uprawnieniu, nie w layoucie.

## 5. Obsługa błędów

- **Broadcast nie dochodzi** → wiadomość i tak zapisana; klient zobaczy ją przy następnym odpytaniu
  albo wejściu w rozmowę. Zero utraty danych.
- **Brak uprawnienia do rozmowy** → 403 po stronie serwera, niezależnie od tego, co pokazuje UI.
- **Załącznik przekracza limit (50 MB)** → czytelny komunikat, nie cichy błąd. Klucz w Storage
  transliterowany do ASCII (polskie znaki i spacje dają „Invalid key"), ładna nazwa zostaje w `file_name`.
- **Brak sesji lub uprawnienia** w `app/api/chat/*` → **403** (K12).
- **Tłumaczenie niedostępne** (brak klucza, limit, błąd Claude) → wiadomość bez tłumaczenia,
  UI mówi dlaczego; wysyłka nigdy nie jest blokowana przez tłumacza.
- **Pracownik bez koordynatora** → portal pokazuje instrukcję, nie pusty ekran.

## 6. Testy i weryfikacja

- `lib/chat/policy.test.ts` — każda para klas ról; pracownik tymczasowy ze swoim i z cudzym
  koordynatorem; dwóch pracowników tymczasowych; role zewnętrzne; rola własna spoza listy
  (musi być personelem); superadmin z pracownikiem tymczasowym; para zablokowana w `chat_policy`.
- `lib/permissions/registry.test.ts` — **zaktualizować asercje** o grupę „Komunikator" (lista grup
  i domyślne zestawy). Lekcja z 02.09: E7c–E7e dołożyły pozycje menu, testów nikt nie poprawił,
  suite był czerwony przez trzy fale.
- `lib/users/accountPurge.test.ts` — nowe tabele w listach, `chat_messages` poza `OWNED_TABLES`.
- `lib/chat/format.test.ts` — `previewOf`, `tDay` (dziś/wczoraj/data), `fmtDur`.
- `npx tsc --noEmit`, `npm test`, **`npx next build`** po każdym zadaniu dotykającym `app/api/**`.
- Migracja 053 na produkcji → `rls-auditor` (RLS włączony, deny-all, FK obecne, bucket prywatny).
- Smoke ręczny na produkcji, dwa konta: rozmowa 1:1, grupa, załącznik, głosówka, edycja, usunięcie,
  reakcja, cytat, wzmianka, tłumaczenie, archiwum. Dane testowe posprzątać.

## 7. Ryzyka

| Ryzyko | Mitygacja |
|---|---|
| ~~Schemat odtwarzany z kodu, nie z migracji BBS~~ | **Zrobione 03.09:** introspekcja `information_schema` + `pg_constraint` + `pg_indexes`; delty w R3–R6 |
| `ChatApp.tsx` 1458 linii — trudny w utrzymaniu, urośnie w E6c | Rozbicie wg wierszy źródła (§4.4) |
| Macierz uprawnień projektowana od nowa — łatwo o dziurę | Czysta funkcja pokryta testami; sprawdzenie po stronie serwera przy tworzeniu, dodawaniu **i wysyłce** |
| Broadcast wywraca zapis wiadomości | Izolowany `try/catch`, best-effort (§4.3) |
| Pierwsze usunięcie konta zostawia sieroty | Purge rozszerzony w tym samym etapie (K5) + FK jako siatka (K8) |
| Synchroniczne tłumaczenie spowalnia wysyłkę w kanale pracownika | Tylko rozmowy 1:1 z pracownikiem tymczasowym, `maxDuration = 60`; awaria tłumacza nie blokuje zapisu (§4.6) |
| Grupa uprawnień „Komunikator" rozjeżdża testy rejestru | Testy aktualizowane w tym samym zadaniu (§6) |
| Kolory WhatsAppa zaszyte w 40 miejscach | Stała `WA` zamieniona na tokeny `primary-*` w jednym pliku stylów komunikatora |

## 8. Poza zakresem E6a — zarysy kolejnych podfal (fakty zebrane 03.09)

**E6b — push.** Źródło: `lib/push/server.ts` (52 linie, `web-push`), `app/api/push` (GET klucz
publiczny / POST subskrypcja), `public/sw.js`, fragment `subscribePush` z `ChatApp.tsx:11–27`,
wywołania `sendPushTo` w `messages` i `upload` (wzmianki `@Imię` budzą mimo wyciszenia).
**Do rozstrzygnięcia:** BBS trzyma klucze VAPID w tabeli `app_config` — **EBS jej nie ma** (R10).
Wybór: założyć `app_config` (D4 mówi „w bazie") albo `VAPID_PUBLIC/PRIVATE` w env. Zależność
`web-push` do dołożenia. Kontakt VAPID: `SMTP_USER` EBS, nie `bok@balticbenefits.pl`.

**E6c — rozmowy i notatki.** Źródło: `components/chat/VoiceCall.tsx` (342), `lib/chat/ringtone.ts` (89),
`app/api/chat/transcribe` (150: Whisper → Claude → `meeting_notes` + `calendar_events` + `app_tasks`
+ wiadomość systemowa), fragmenty `ChatApp.tsx` (sygnalizacja `chat-calls`, `GroupCallModal:1163`,
popup przychodzącego `1430–1453`, mini-okienko rozmowy). Tabela **`meeting_notes`** (8 kolumn:
`id, conversation_id, message_id, transcript, summary, event_id, created_by, created_at`) — nowa
migracja. `calendar_events` i `app_tasks` EBS **ma** (E7b), `source='meeting'` mieści się w CHECK.
TURN wg D1. `transcribe` nie może używać limitu tłumacza (jak `notes/transcribe` z E7e).

**E6d — poczta.** Źródło: `lib/mail/server.ts` (502: `imapflow` + `mailparser` + `nodemailer`,
połączenia request-scoped pod serverless), `lib/mail/crypto.ts` (26: AES-GCM, hasła skrzynek
w `mail_accounts.password_enc`), 7 route'ów `crm/mail/*` + 2 `mail/*`, `MailClient.tsx` (575).
Tabele: `mail_accounts` (12 kolumn, `UNIQUE(email)`), `mail_account_users` (`PK(account_id,user_id)`).
Wiadomości **nie są w bazie** — czytane z IMAP na żywo. Klucz `crm.poczta` (R1).
`DetailsPanel` (E7a) woła `/api/crm/mail/by-contact` i degraduje się cicho — E6d domyka.
**Dwa problemy odnotowane 03.08, nadal aktualne:** BBS ma własny cron alertów, który dublowałby cron
EBS z E5 (Vercel Hobby: jeden cron dziennie, zajęty) — **scalić, nie kopiować**; kolizja nazw env
(`MAIL_*` w BBS kontra `SMTP_*` w EBS) — zmapować na istniejące, nie dublować sekretów.
Do tego klucz szyfrowania dla `crypto.ts` (nowy sekret w env) i zależności `imapflow`, `mailparser`.
`accountPurge`: `mail_account_users.user_id` do `OWNED_TABLES`.

**Poza E6 w ogóle:** zniesienie limitu 6 osób (K6, SFU); port `secure-messenger` (K4); ekran macierzy
`chat_policy` (K16 — dojdzie na życzenie właściciela).

## 9. Plan wykonania E6a (kolejność = kolejność wdrożeń)

Rdzeń idzie na produkcję pierwszy; kanał pracownika i tłumaczenie dochodzą po nim, żeby awaria
w tej części nie blokowała komunikatora personelu.

1. Migracja `053_chat.sql` → `apply_migration` na produkcji → `rls-auditor`.
2. Rejestr uprawnień: grupa „Komunikator", `komunikator.czat`, `DEFAULT_ROLE_PERMS`, testy.
3. `lib/chat/policy.ts` + testy · `lib/chat/server.ts` · `lib/chat/realtime.ts` · `lib/chat/format.ts`.
4. 13 route'ów `app/api/chat/*` (bramka, 403, bez `logEvent`/`sendPushTo`).
5. Komponenty (§4.4) + `ChatButton` w `AdminDashboardClient` i wariant pływający w `NetworkDashboardClient`.
6. `tsc` · `npm test` · `next build` · **deploy** · commit — rdzeń komunikatora na produkcji.
7. `translate` endpoint + UI (§4.6).
8. `me/worker/chat` + `WorkerChat` + zakładka w portalu (§4.7) + auto-tłumaczenie przy wysyłce.
9. `accountPurge` (§4.5) + testy.
10. `tsc` · `npm test` · `next build` · **deploy** · commit · smoke na dwóch kontach · `CLAUDE.md`
    (sekcja E6a, sprostowanie o `053`) · `/handoff`.

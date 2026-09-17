# Sklep benefitów v2 — portal pracownika (układ „Immich")

**Data:** 2026-09-15
**Status:** zatwierdzony przez właściciela (brainstorm 11.09 + pytania 15.09), do planu implementacji
**Poprzednik:** handoff `session-logs/2026-09-14-sklep-benefitow-immich.md`
**Wzorzec wizualny:** `https://21st.dev/community/apps?preview=%2Fcommunity%2Fapps%2Fimmich`
(lewy pasek kategorii, wyszukiwarka, siatka kafelków-obrazków z nagłówkami, jasny motyw)

## 1. Kontekst

Ekran wyboru benefitów w portalu pracownika (`views/DashboardEmployee.tsx`, zakładki Pulpit/Katalog)
to dziś sześć poziomych karuzel podzielonych **po partnerach** (Profitowi, Multipolisa, Goldman Sachs,
Wellbeing, Poradniki, E-booki) na ciemnym tle. Właściciel chce **sklepu** w układzie Immich: kategorie
**po potrzebach**, wyszukiwarka, siatka obrazkowa, jasny motyw. Dzisiejszy układ ma zostać
**wyłączony stałą, nie usunięty**.

### 1.1 Co ustalono z właścicielem

| # | Pytanie | Decyzja |
|---|---|---|
| S1 | Co po wyborze produktu za punkty | **Punkty schodzą od razu** — sklep, nie rezerwacja, nie wniosek do HR |
| S2 | Skąd katalog | **Zostaje w kodzie** (`INITIAL_SERVICES` w `services/mockData.ts`); baza i panel admina = przyszłe podejście B |
| S3 | Lewy pasek | **Po potrzebach**, nie po partnerach |
| S4 | Rytm | Sklep „kiedy chce", nie kafeteria na okres |
| S5 | Zakres | **Tylko sklep** — Pulpit (portfel), Historia, Twoje Aplikacje, Pomoc zostają jak dziś |
| S6 | Po zakupie u partnera | Potwierdzenie + kontakt: e-mail do pracownika, zgłoszenie do BOK |
| S7 | Produkty i ceny | Przenieść dzisiejsze; bez ceny = „Zapytaj o ofertę"; **dopisać Medicover** |
| Q1 | Kto realizuje zakup za punkty | **BOK ręcznie.** Zakup = zamówienie; e-mail do BOK i do pracownika; żadnych zmyślonych kodów QR |
| Q2 | Ceny w kodzie (7–200 pkt) | **Zostają jak są.** 1 pkt = 1 zł realnego vouchera; korekty kwot właściciel robi w pliku katalogu |
| Q3 | Kategorie | **6:** Zdrowie · Ubezpieczenia · Finanse · Rozwój · Rodzina · Codzienność (przypisanie w §4.2) |
| Q4 | „Zapytaj o ofertę" | **Jedno kliknięcie, bez formularza.** E-mail do BOK z danymi z profilu + potwierdzenie do pracownika; BOK przekazuje brokerowi |
| Q5 | Aplikacje Eliton w sklepie | **Tak, też w sklepie** (w swoich kategoriach); kupiona pokazuje „Otwórz" |

### 1.2 Fakty z żywej bazy (15.09.2026), które zmieniają zakres

1. **Zakup za punkty nigdy nie zadziałał na produkcji.** Księga `voucher_transactions` ma wpisy
   `emisja`=7, `przekazanie`=19, `odkup`=16 i **zero** `wykorzystanie`. Przyczyna: dystrybucja nadaje
   voucherom `status='distributed'` (migracje 019/035), `POST /api/vouchers/purchase` szuka
   `distributed`, ale funkcja `redeem_voucher` (001) przyjmuje wyłącznie `status='active'` → każdy
   zakup kończy się wyjątkiem, API zwraca 500, klient cofa saldo. Handoff z 14.09 uznał ten mechanizm
   za „gotowy do reużycia bez zmian" — nie był.
2. **Zgłoszenia do BOK w portalu (`SupportTicketSystem`) żyją tylko w `localStorage`**
   (`ebs_tickets_v1`); tabela `support_tickets` ma 0 wierszy i żaden route jej nie zapisuje.
   Jedyny działający kanał do BOK to e-mail na `bok@stratton-prime.pl` przez `lib/mailer.sendEmail`
   (`app/api/contact-bok`).
3. Wszystkie 24 700 voucherów ma status `expired` (ostatnie ważne do 10.09.2026), salda kont = 0.
   Smoke-test wymaga świeżej emisji.
4. Ekran „Zakup udany" w `RedemptionModal` pokazuje **zmyślony kod odbioru i QR z zewnętrznego
   serwisu** (`api.qrserver.com`) albo link `https://example.com/dummy-pdf.pdf`; modal przechodzi
   do „sukcesu" **nie czekając na wynik API** (stąd dzisiejsze „Zakup udany" + toast „Transakcja
   odrzucona" naraz).
5. `POST /api/vouchers/purchase` **ufa cenie z przeglądarki** (`amount` z body) — nie sprawdza jej
   z katalogiem. Pracownik z devtools mógłby kupić Spotify za 1 pkt.
6. Tabela `services` istnieje od migracji 001 (0 wierszy), żaden kod jej nie czyta — zgodnie z S2
   pozostaje nieużywana.

## 2. Zakres

**W zakresie:** nowy widok sklepu, rozszerzenie katalogu w kodzie, druga ścieżka „Zapytaj o ofertę",
naprawa mechanizmu zakupu (§6), e-maile potwierdzeń, wyłączenie starych karuzel stałą, menu boczne
pracownika, testy i smoke na produkcji.

**Świadomie poza zakresem:** katalog w bazie + panel admina do edycji (podejście B — „nie teraz",
A jest pod to przygotowane), ekran kolejki zgłoszeń dla BOK w panelu admina (BOK pracuje z maili),
ilość > 1 w jednym zakupie, zwroty punktów, kody weryfikowane przez partnera, adresy e-mail brokerów
w katalogu, zmiany w Historii/Portfelu/Pomocy, tłumaczenia (portal jest po polsku).

## 3. Architektura (przegląd)

```
DashboardEmployee (activeTab === 'CATALOG', STORE_LAYOUT === 'v2')
  └─ <BenefitStore>  (pełny ekran, jasny motyw, jak Wellbeing/Legal)
       ├─ StoreHeader      logo · wyszukiwarka · saldo · X (onExit → Pulpit)
       ├─ StoreSidebar     6 kategorii z licznikami + „Wszystkie" · karta salda (desktop)
       │  StoreChips       te same kategorie jako chipy (mobile)
       ├─ StoreGrid        siatka kafelków; przy „Wszystkie" pogrupowana nagłówkami kategorii
       │    └─ StoreTile   obrazek · nazwa · partner · plakietka stanu
       └─ StoreDetail      panel szczegółów: opis · partner · cena · JEDEN przycisk wg stanu
            ├─ 'buy'          → RedemptionModal (istniejący, poprawiony §6.3) → onPurchaseService
            ├─ 'inquire'      → POST /api/benefits/inquiry → komunikat „Zgłoszone"
            ├─ 'open'         → onOpenApp(tab)  (kupiona aplikacja Eliton)
            └─ 'insufficient' → przycisk nieaktywny „Brakuje N pkt"
lib/benefits/catalog.ts   czyste funkcje: kategorie, grupowanie, filtr+szukanie, wybór akcji, lookup
lib/benefits/mails.ts     czyste buildery HTML czterech e-maili
lib/benefits/inquiry.ts   czysta logika okna deduplikacji
app/api/benefits/inquiry  route zgłoszeń (nowy)
app/api/vouchers/purchase route zakupu (naprawiony: walidacja ceny, atomowa RPC, e-maile)
supabase/migrations/061_sklep_benefitow.sql   funkcje bazy + tabela benefit_inquiries
```

Zasady: sklep to komponent prezentacyjny — dane (`services`, `transactions`, saldo) i akcje
(`onPurchaseService`, `onOpenApp`, `onExit`) dostaje przez propsy z `DashboardEmployee`; nic nie
czyta z kontekstu bezpośrednio. Cała logika decyzyjna (co pokazać, jaką akcję) siedzi w
`lib/benefits/catalog.ts` bez Reacta, żeby dało się ją przetestować.

## 4. Katalog

### 4.1 Model (`types/system.ts`, `types/enums.ts`)

```ts
export enum BenefitCategory {
  ZDROWIE = 'ZDROWIE', UBEZPIECZENIA = 'UBEZPIECZENIA', FINANSE = 'FINANSE',
  ROZWOJ = 'ROZWOJ', RODZINA = 'RODZINA', CODZIENNOSC = 'CODZIENNOSC',
}
export type BenefitFulfillment = 'auto' | 'bok';   // auto = aplikacja Eliton odblokowuje się sama

export interface ServiceItem {
  id: string; name: string; description: string; price: number; type: ServiceType;
  icon: string; image?: string; isActive: boolean;
  category: BenefitCategory;        // NOWE, wymagane
  partner?: string;                 // NOWE — nazwa partnera/brokera na kafelku i w mailu
  fulfillment?: BenefitFulfillment; // NOWE — domyślnie 'bok'
}
```

Etykiety i kolejność kategorii (`lib/benefits/catalog.ts`, `BENEFIT_CATEGORIES`):
Zdrowie · Ubezpieczenia · Finanse · Rozwój · Rodzina · Codzienność — każda z ikoną `lucide` i
jednozdaniowym opisem pod nagłówkiem sekcji.

### 4.2 Treść `INITIAL_SERVICES` po zmianie

Istniejące 31 pozycji dostają kategorię (ceny **bez zmian**):

| Kategoria | Pozycje |
|---|---|
| Zdrowie | `SRV-MENTAL-01` Wellbeing Premium (100, `auto`), `SRV-MH-01…05` (9–44) |
| Ubezpieczenia | — (tylko nowe, niżej) |
| Finanse | `SRV-FIN-01` Inwestowanie (28), `SRV-FIN-02` Psychologia zakupów (7), `SRV-FIN-05` Emerytura 2.0 (36) |
| Rozwój | `SRV-AI-01…05` (12–49), `SRV-FIN-03` Negocjacje podwyżki (42), `SRV-FIN-04` Personal branding (19), `SRV-LIFE-05` Komunikacja między pokoleniami (39) |
| Rodzina | `SRV-LIFE-01` Bajka (11), `SRV-LIFE-02` Kuchnia w 15 min (24), `SRV-ORANGE-LOVE` (89) |
| Codzienność | `SRV-01` Spotify (20), `SRV-02` Audioteka (35), `SRV-03` Porada prawna — człowiek (200), `SRV-04` Multikino (25), `SRV-LEGAL-01` AI Legal Assistant (150, `auto`), `SRV-LEGAL-SINGLE` Analiza umowy (50), `SRV-ORANGE-FIBER` (59), `SRV-ORANGE-GSM` (45), `SRV-LIFE-03` Hobby (17), `SRV-LIFE-04` Podróże (48) |

Dochodzą (nowe `id`, cena **0** = „Zapytaj o ofertę", chyba że podano):

| id | Nazwa | Kategoria | Partner | Cena |
|---|---|---|---|---|
| `SRV-P-LUXMED` | Luxmed — Pakiet Optyka i Rehabilitacja | Zdrowie | Profitowi | 0 |
| `SRV-P-TUZDROWIE` | TU Zdrowie — Pakiet badań profilaktycznych | Zdrowie | Multipolisa.pl | 0 |
| `SRV-P-MEDICOVER` | Medicover — Pakiet opieki medycznej | Zdrowie | Medicover | 0 |
| `SRV-P-PZU` | PZU — Ubezpieczenie NNW pracownicze | Ubezpieczenia | Profitowi | 0 |
| `SRV-P-UNIQA` | UNIQA — Ubezpieczenie na życie | Ubezpieczenia | Profitowi | 0 |
| `SRV-P-LOYDS` | Loyds — Ubezpieczenie od utraty dochodu | Ubezpieczenia | Profitowi | 0 |
| `SRV-P-ERGO` | Ergo Hestia — Pakiet Bezpieczny Dom | Ubezpieczenia | Multipolisa.pl | 0 |
| `SRV-P-WARTA` | Warta — Ubezpieczenie turystyczne | Ubezpieczenia | Multipolisa.pl | 0 |
| `SRV-P-LEADENHALL` | Leadenhall — OC w życiu prywatnym | Ubezpieczenia | Multipolisa.pl | 0 |
| `SRV-P-IKE` | IKE — Indywidualne Konto Emerytalne | Finanse | Goldman Sachs | 0 |
| `SRV-P-IKZE` | IKZE — Indywidualne Konto Zabezpieczenia Emerytalnego | Finanse | Goldman Sachs | 0 |
| `SRV-SECURE-01` | Secure Messenger | Codzienność | Eliton | 200, `auto` |
| `SRV-VAULT-01` | Digital Vault | Codzienność | Eliton | 50, `auto` |

Nazwy, opisy i obrazki partnerskie przenoszone 1:1 z dzisiejszych kafelków JSX
(`DashboardEmployee.tsx`, sekcje Profitowi/Multipolisa/Goldman). Pisownia „Uniga" z kodu
poprawiona na **UNIQA** (id `SRV-P-UNIQA`; decyzja właściciela 17.09.2026 — w bazie nie było
ani jednego wiersza ze starym id). `SRV-SECURE-01`/`SRV-VAULT-01` dziś istnieją
tylko jako obiekty zapasowe w `DashboardEmployee` — wchodzą do katalogu, żeby sklep i „Twoje
Aplikacje" czytały jedno źródło. Filtr ukrywający `SRV-ORANGE-*` w `displayServices` przestaje
obowiązywać w v2 (Orange wraca do widoku zgodnie z przypisaniem zatwierdzonym w Q3).

Klucz `usePersistedState` katalogu: **`ebs_services_v15` → `ebs_services_v16`** — stara kopia
w przeglądarce nie ma pola `category` i inaczej zostałaby użyta bez kategorii. Heurystyki
odświeżania w `StrattonContext` (sprawdzanie obrazków/nieznanych usług) zostają.

### 4.3 Reguła ceny (pogodzenie S1 z S7)

`price > 0` → produkt sprzedaje się za punkty natychmiast (S1). `price === 0` → „Zapytaj o ofertę".
Nic nie schodzi z konta, dopóki właściciel nie wpisze ceny > 0 w katalogu. Cena w katalogu to
**realny koszt** (1 pkt = 1 zł vouchera), nie atrapa.

## 5. Zachowanie sklepu

### 5.1 Wejścia

- Dolny pasek (mobile) i `FloatingTabBar`: zakładka **Katalog** → `activeTab = 'CATALOG'`.
- Menu boczne pracownika (`Sidebar`, `Role.EMPLOYEE`): pozycje `emp-profitowi`, `emp-multipolisa`,
  `emp-goldman`, `emp-wellbeing`, `emp-poradniki`, `emp-ebooki` **zastąpione jedną** `emp-catalog`
  „Sklep benefitów" (ikona `ShoppingBag`). Zostają: `emp-twoje-aplikacje`, `emp-history`,
  `emp-support`, `emp-active-services`. Istniejący `useEffect` w `DashboardEmployee` mapuje
  `emp-catalog` → `CATALOG`.
- Pulpit v2: kafelek **„Przeglądaj benefity →"** (pełna szerokość, pod „Twoje Aplikacje") →
  `CATALOG`. Szybkie akcje otwierają sklep w kategorii: Opieka medyczna → Zdrowie, Ubezpieczenia →
  Ubezpieczenia, Telekomunikacja → Codzienność, Wellbeing → Zdrowie (`openStore(category)` ustawia
  `storeInitialCategory` + `CATALOG`).
- Przyciski „Przeglądaj Katalog" w „Aktywne usługi" → `CATALOG` (bez zmian w zachowaniu).

### 5.2 Układ

Pełnoekranowa nakładka (`fixed inset-0 z-[100]`, wzorzec Secure Messenger/Digital Vault), jasny
motyw wewnątrz (`bg-slate-50`, karty białe), ciemna powłoka portalu pod spodem zostaje.

- **Nagłówek:** logo EBS + „Sklep benefitów" · pole „Szukaj benefitu…" (filtruje nazwę, opis,
  partnera; bez rozróżniania wielkości liter i diakrytyków — porównanie po NFD bez znaków
  łączących) · plakietka salda „{n} pkt" · X → `onExit` (Pulpit).
- **Desktop (≥ md):** lewy pasek 240 px, `sticky`: „Wszystkie ({n})" + 6 kategorii z licznikami
  aktywnych pozycji; na dole karta salda (kwota + „1 pkt = 1 zł"). Prawa część: siatka
  `grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`; przy „Wszystkie" sekcje z nagłówkiem kategorii
  (ikona, nazwa, opis, licznik) w kolejności z §4.1; wybrana kategoria → jedna sekcja.
- **Mobile (< md):** brak paska; pod nagłówkiem poziomo przewijane chipy kategorii (z licznikami);
  siatka 2 kolumny; panel szczegółów jako arkusz od dołu.
- **Kafelek:** obrazek 4:3 (`object-cover`, `loading="lazy"`, tło zastępcze z ikoną gdy brak
  `image` lub błąd ładowania), nazwa (2 linie, `line-clamp`), partner drobnym drukiem, plakietka
  stanu w rogu obrazka: `25 pkt` / `Zapytaj o ofertę` / `Otwórz` (zielona) / `Brakuje 12 pkt`
  (szara). Kolejność w sekcji: pozycje z ceną > 0 rosnąco po cenie, potem pozycje z ceną 0, w
  obrębie równych — alfabetycznie; deterministyczna, testowana.
- **Pusty wynik szukania:** „Nic nie znaleźliśmy dla „{fraza}"" + przycisk „Wyczyść".
- Ruch: wejście/wyjście nakładki i panelu szczegółów przez `motion` (już w projekcie); reduce-motion
  respektowane. Tokeny kolorów z `primary-*` EBS; brak nowych zależności UI.

### 5.3 Stan kafelka i akcja (`resolveAction` w `lib/benefits/catalog.ts`)

```
wejście: item, ownedServiceIds (z transactions.serviceId), balance
'open'          gdy item.fulfillment === 'auto' && owned          (kupiona aplikacja)
'inquire'       gdy item.price === 0
'insufficient'  gdy item.price > balance
'buy'           w pozostałych przypadkach
```

`onOpenApp` mapuje: `SRV-MENTAL-01` → `WELLBEING`, `SRV-LEGAL-01` → `LEGAL`, `SRV-SECURE-01` →
`SECURE_MESSENGER`, `SRV-VAULT-01` → `DIGITAL_VAULT` (mapa w `lib/benefits/catalog.ts`, używana
też przez Pulpit — jedno źródło zamiast czterech `if`-ów).

### 5.4 Ścieżka A — zakup za punkty

1. `StoreDetail` (`'buy'`) → przycisk „Kup za {price} pkt" → `RedemptionModal` z pozycją.
2. Suwak → `onConfirm()` → `handleServicePurchase(item)` (hook) → `POST /api/vouchers/purchase`
   `{serviceId, serviceName, amount}` — **kontrakt body bez zmian**, serwer waliduje (§6.2).
3. Sukces → modal krok `SUCCESS` w wariancie:
   - `fulfillment === 'bok'`: „Zamówienie przyjęte" · „Pobraliśmy {price} pkt. BOK prześle
     kod/aktywację na **{email}** w ciągu **2 dni roboczych**." · przycisk „Wróć do sklepu".
   - `fulfillment === 'auto'`: „Aplikacja aktywna" · przycisk „Otwórz" (→ `onOpenApp`) + „Wróć do
     sklepu". Istniejące auto-przekierowanie po zakupie Wellbeing/Legal (timeout 1 s w
     `DashboardEmployee`) **zastąpione** tym przyciskiem — bez skoków ekranu.
4. Błąd (za mało środków, brak voucherów, awaria) → modal zostaje w kroku `ERROR` z treścią błędu
   z API i przyciskiem „Zamknij"; saldo cofnięte przez hook jak dziś; **żadnego „Zakup udany"**.
5. E-maile (serwer, po udanej realizacji): do BOK — „[EBS Sklep] Zamówienie: {partner}: {nazwa}"
   (produkt, partner, cena w pkt, pracownik, e-mail, firma, id transakcji z księgi, data); do
   pracownika — „Potwierdzenie zamówienia — {nazwa}" (co, ile punktów, co dalej, kontakt do BOK).
   Dla `auto` tylko e-mail do pracownika („Aplikacja aktywna").
6. Historia (`/api/vouchers/transactions`): **jeden wpis na zakup** z `amount = price`, nie N wpisów
   po 1 pkt (§6.1).

### 5.5 Ścieżka B — „Zapytaj o ofertę"

1. `StoreDetail` (`'inquire'`) → przycisk „Zapytaj o ofertę" → `POST /api/benefits/inquiry`
   `{serviceId}`.
2. Serwer: pozycja musi istnieć w katalogu i mieć `price === 0` i `isActive` (inaczej 400);
   rola `pracownik` (inaczej 403 — spójnie z zakupem); **deduplikacja**: istniejące zgłoszenie tego
   użytkownika na ten `serviceId` z `created_at` młodszym niż 7 dni → **409**
   `{error:'already_reported', reportedAt}`; inaczej `INSERT benefit_inquiries` + e-maile:
   do BOK — „[EBS Sklep] Zapytanie o ofertę: {partner}: {nazwa}" (produkt, partner, pracownik,
   e-mail, firma, data; `replyTo` = pracownik, jak w `contact-bok`); do pracownika —
   „Przyjęliśmy zapytanie — {nazwa}" („BOK skontaktuje się w ciągu 2 dni roboczych").
3. Klient: 200 → w panelu szczegółów zielony stan „Zgłoszone ✓ — BOK odezwie się w ciągu 2 dni
   roboczych"; 409 → ten sam stan z datą z odpowiedzi („Zgłoszone {data}"); inne → czerwony
   komunikat i możliwość ponowienia. Stan „Zgłoszone" trzymany w pamięci sesji sklepu (po
   przeładowaniu strony serwer i tak odpowie 409, więc pracownik nie wyśle dubla).
4. Brak SMTP (`sendEmail` → `skipped`): zgłoszenie **zostaje zapisane** (wiersz w tabeli), route
   loguje ostrzeżenie i zwraca 200 z `mailSkipped: true`; UI nie rozróżnia.

### 5.6 Pulpit v2 i stała `STORE_LAYOUT`

`lib/benefits/storeLayout.ts`: `export const STORE_LAYOUT: 'v1' | 'v2' = 'v2';` — czytają ją
`DashboardEmployee` **i** `Sidebar` (przełącznik w jednym miejscu).

- `'v2'` (domyślnie): `renderWallet()` renderuje hero (karta salda + 4 statystyki), banner
  wygaśnięć, szybkie akcje (→ sklep w kategorii), separator „Katalog usług" → **zastąpiony**
  kafelkiem „Przeglądaj benefity →", sekcję **Twoje Aplikacje** (bez zmian), ostatnie transakcje
  (mobile). Karuzele Profitowi/Multipolisa/Goldman/Wellbeing/Poradniki/E-booki **nie renderują się**.
  `activeTab === 'CATALOG'` → `<BenefitStore>` zamiast `renderWallet()`. Stary licznik „Partnerzy: 14"
  w statystykach → liczony z katalogu (unikalni `partner` ≠ Eliton).
- `'v1'`: dokładnie dzisiejsze zachowanie (CATALOG = Pulpit ze scrollem do sekcji, stare menu
  boczne). Kod karuzel i `handlePartnerRequest` zostają w pliku nietknięte — to wyraźne życzenie
  właściciela („wyłączyć, nie zastąpić").
- Scroll-spy (`useEffect` nasłuchujący sekcji `sec-emp-*`) w v2 nie ma czego obserwować —
  wyłączony warunkiem, żeby nie wołał `onViewChange` z nieistniejącymi widokami.

## 6. Naprawa mechanizmu zakupu (migracja `061_sklep_benefitow.sql` + route)

### 6.1 Baza

1. `redeem_voucher(...)`: warunek `status = 'active'` → `status IN ('active','distributed')`
   (funkcja zostaje dla zgodności; nowy route jej nie woła).
2. Nowa funkcja **`redeem_vouchers_for_service(p_user_id uuid, p_amount int, p_service_id text,
   p_service_name text) RETURNS jsonb`** — jedna transakcja:
   - blokuje `p_amount` voucherów użytkownika `status IN ('active','distributed') AND valid_until >=
     CURRENT_DATE` w kolejności `valid_until ASC, serial_number ASC` (`FOR UPDATE SKIP LOCKED`);
   - jeśli znaleziono mniej niż `p_amount` → `RAISE EXCEPTION 'INSUFFICIENT_VOUCHERS'` — **nic nie
     schodzi**;
   - oznacza je `consumed` (+ `redeemed_at`, `redeemed_by_user_id`), zmniejsza `voucher_accounts.balance`
     o `p_amount` (warunek `balance >= p_amount`, inaczej wyjątek `INSUFFICIENT_BALANCE`);
   - wstawia **jeden** wiersz do `voucher_transactions` (`type='wykorzystanie'`, `amount=p_amount`,
     `service_id`, `service_name`, `metadata = {"voucher_ids":[...], "serials":[...]}`);
   - zwraca `{transaction_id, redeemed, serials}`.
   `SECURITY DEFINER`, `SET search_path = public, pg_temp`, `REVOKE ALL ... FROM anon, authenticated`
   (wołana wyłącznie z service_role, wzorzec z 045/053).
3. Tabela **`benefit_inquiries`**: `id uuid pk default gen_random_uuid()`, `user_id uuid not null
   references user_profiles(id) on delete cascade`, `service_id text not null`, `service_name text not
   null`, `partner text`, `status text not null default 'new' check (status in
   ('new','in_progress','done'))`, `created_at timestamptz default now()`; indeks
   `(user_id, service_id, created_at desc)`; RLS włączone bez polityk (deny-all, dostęp przez
   service_role — konwencja repo); audyt triggerem `fn_audit_log` (brak danych wrażliwych w wierszu).
   `lib/users/accountPurge.ts` dostaje wpis dla tej tabeli w `OWNED_TABLES` — **wiersze kasowane w OBU trybach**
   (także przy ANONIMIZACJI: zapytanie martwego konta nie ma wartości; korekta specu po recenzji końcowej 16.09).
4. `types/database.ts` **nie jest rozszerzane** — zapytania do `benefit_inquiries` idą przez
   `(supabase as any)`, jak `document_templates` i tabele `hr_*` (konwencja repo).

### 6.2 `POST /api/vouchers/purchase` (kontrakt body bez zmian)

1. Auth + rola `pracownik` (jak dziś).
2. **Walidacja katalogowa:** jeśli `serviceId` zaczyna się od `SRV-` → pozycja musi istnieć w
   `INITIAL_SERVICES` (`findCatalogItem`), być `isActive`, mieć `price > 0` i `amount === price`;
   inaczej 400 `{error:'price_mismatch' | 'unknown_service' | 'not_purchasable'}`. `serviceId`
   `INTERNAL-*` (wydatki wewnątrz aplikacji — AI Coach, biblioteka premium, Prawnik) → bez walidacji
   katalogowej, jak dziś. Wszystko inne (np. stare `PARTNER-*`) → 400.
   `services/mockData.ts` importuje tylko typy, więc jest bezpieczny po stronie serwera; plan ma to
   potwierdzić buildem.
3. Jedno wywołanie `redeem_vouchers_for_service`. Wyjątek `INSUFFICIENT_*` → 400 z czytelnym
   komunikatem (saldo/wymagane); inne → 500.
4. Po sukcesie: e-maile z §5.4 przez `lib/benefits/mails.ts` + `sendEmail` w `try/catch` —
   **błąd poczty nie cofa zakupu** (vouchery już umorzone), tylko loguje.
5. Odpowiedź: `{redeemed, serviceName, transactionId}` (klient używa `transactionId` w nowym wpisie
   historii zamiast `TRX-${Date.now()}`).

### 6.3 Klient (`useVoucherLogic.handleServicePurchase`, `RedemptionModal`)

- `handleServicePurchase` zwraca **`Promise<{ok: boolean; error?: string}>`**; optymistyczne saldo
  i rollback jak dziś; komunikat błędu z API przekazywany dalej, nie tylko toast.
- `RedemptionModal.onConfirm: () => Promise<{ok: boolean; error?: string}>`; kroki `REVIEW` →
  `PROCESSING` → `SUCCESS` | `ERROR`. Usunięte: generowanie kodu, QR z `api.qrserver.com`, link
  `example.com`, heurystyka `isDigitalContent`. Treść `SUCCESS` wg `fulfillment` (§5.4).
  Wywołania modala poza sklepem (kafelki „Twoje Aplikacje" na Pulpicie) dostają ten sam kontrakt —
  jedno miejsce prawdy.
- `handleManualSpend` (Wellbeing/Prawnik `onSpend`) opakowuje nowy wynik do `Promise<boolean>`,
  którego oczekują te aplikacje.

## 7. E-maile (`lib/benefits/mails.ts`)

Cztery czyste funkcje `(input) → {subject, html, text}`; szablon spójny z `contact-bok`
(nagłówek zielony `#30df6a`, tabela pól, stopka „Wygenerowano automatycznie przez EBS"):
`bokOrderMail`, `employeeOrderMail`, `bokInquiryMail`, `employeeInquiryMail`. Adres BOK:
`process.env.BOK_EMAIL ?? 'bok@stratton-prime.pl'` (stała w `lib/benefits/constants.ts`, z której
korzysta też — po refaktorze jednej linii — `contact-bok`). Termin „2 dni roboczych" = stała
`BOK_SLA_TEXT` w tym samym pliku. Nadawca: skrzynka SMTP (`SMTP_FROM`), `replyTo` = pracownik w
mailach do BOK. Dane osobowe w mailu: imię i nazwisko, e-mail, firma — nic więcej (RODO: minimum
potrzebne do realizacji). Wartości z katalogu i profilu są escapowane przed wstawieniem do HTML.

## 8. Testy i weryfikacja

**Jednostkowe (vitest):**
- `lib/benefits/catalog.test.ts`: każda pozycja katalogu ma kategorię z enumu i unikalne `id`;
  `groupByCategory` zachowuje kolejność §4.1 i pomija puste; `filterCatalog` szuka po nazwie/opisie/
  partnerze bez wielkości liter i diakrytyków („ubezp" znajduje PZU, „luxmed" znajduje pozycję
  Profitowi); sortowanie w sekcji deterministyczne; `resolveAction` — 4 stany + przypadki brzegowe
  (saldo = cena → `buy`; `auto` niekupiona → `buy`; cena 0 zawsze `inquire`); `findCatalogItem`
  nie zna `SRV-NIEMA`.
- `lib/benefits/inquiry.test.ts`: `isWithinDedupWindow(lastCreatedAt, now)` — 7 dni, granice.
- `lib/benefits/mails.test.ts`: tematy i obecność pól; brak surowego HTML z danych wejściowych
  (escape nazwy produktu/pracownika).
- Istniejące testy bez zmian; `npm test` musi zostać zielony (341 dziś).

**Statyczne:** `npx tsc --noEmit` = 0 błędów; `next build` exit 0.

**Smoke na produkcji (po deployu, przed „zrobione"):**
1. Migracja 061 przez Supabase MCP (`apply_migration`), następnie agent `rls-auditor` — nowa
   tabela i funkcja `SECURITY DEFINER`.
2. Konto testowe: **tymczasowy pracownik w firmie testowej** (założenie z 15.09 — właściciel nie
   wskazał prawdziwego pracownika), emisja i dystrybucja **30 voucherów** ścieżką administratora
   (jak realny klient: zamówienie → aktywacja → dystrybucja).
3. Scenariusze: zakup „Multikino (25 pkt)" → saldo 5, jeden wpis `wykorzystanie` z `amount=25` i
   25 voucherów `consumed`, e-mail do BOK i do pracownika (sprawdzenie skrzynki lub logu SMTP);
   próba zakupu „Audioteka (35)" → „Brakuje 30 pkt" bez wywołania API; „Zapytaj o ofertę" na
   PZU → 200 + wiersz w `benefit_inquiries` + 2 e-maile; drugi klik → 409 i stan „Zgłoszone";
   zakup Wellbeing (100) przy saldzie 5 → `ERROR` w modalu, saldo bez zmian, księga bez wpisu.
4. Sprzątanie: konto testowe → **anonimizacja** przez `accountPurge` (PURGE niemożliwy — księga
   niezmienna), firma testowa usunięta, wiersz w `benefit_inquiries` usunięty ręcznie, `audit_log`
   zostaje. Zapis w handoffie, co zostało.
5. Przeglądarka: Playwright MCP / Claude Browser — desktop 1400 px i mobile 390 px; `/impeccable
   audit` + `/design-review` na widoku sklepu przed oddaniem (reguła nadrzędna); MotionSites/21st.dev
   bez OAuth — odnotować w raporcie, nie blokować.

## 9. Ryzyka i pułapki

- **Deploy migracji przed kodem:** nowa funkcja bazy musi istnieć zanim wejdzie route; kolejność:
  migracja → `vercel --prod`.
- **`ebs_services_v16`:** użytkownik z otwartą kartą sprzed deployu ma stary katalog do przeładowania
  strony — akceptowalne.
- **Obrazki z Unsplash** (zewnętrzne, jak dziś): kafelek ma tło zastępcze; nie dokładamy CDN-u.
- **`voucher_transactions` pod triggerem niezmienności** — nowa funkcja tylko wstawia; żadnych
  `UPDATE/DELETE`.
- **Rola `superadmin` w portalu (tryb podglądu od 15.09):** zakup i zapytanie zwracają 403 — sklep
  pokazuje dla niej kafelki normalnie, a przycisk w szczegółach jest nieaktywny z podpisem „Tylko
  dla pracowników" (`resolveAction` nie zna roli — obsługa w `StoreDetail` po `user.role`).
- **`AGENTS.md`** — nieaktualne od 02.09, nie jest źródłem prawdy.

## 10. Decyzje właściciela po wdrożeniu (17.09.2026) — ROZSTRZYGNIĘTE

1. **Wydatki wewnątrz aplikacji Eliton (`INTERNAL-*`: Prawnik AI, biblioteka premium) schodzą
   z kont** — potwierdzone; gałąź `internal` w `lib/benefits/purchaseValidation.ts` zostaje.
   (Do 15.09 padały na 500, od naprawy `redeem_voucher` działają naprawdę.)
2. **Pozycje partnerskie zostają na „Zapytaj o ofertę" (cena 0)**, bez realnych cen. Pracownik
   ma dodatkowo dostać **numer telefonu do BOK** — właściciel poda go 18.09.2026. Slot gotowy:
   `BOK_PHONE` (`NEXT_PUBLIC_BOK_PHONE`, `lib/benefits/constants.ts`) + `bokContactText()`;
   pusty = niewidoczny, wpisany = pojawia się w mailach do pracownika i w stanie „Zgłoszone"
   w `StoreDetail`.
3. **UNIQA** (patrz §4.2).
4. **BOK dostaje ekran kolejki zgłoszeń w panelu admina** — §11.

## 11. Kolejka zgłoszeń BOK (panel admina, 17.09.2026)

**Cel:** BOK dostaje te same zgłoszenia e-mailem, ale mail nie mówi, co jest jeszcze do zrobienia
ani kto się tym zajął. Ekran `Zgłoszenia BOK` (Sidebar ── Benefity ──, zakładka `admin-zgloszenia`,
komponent `components/adminNew/AdminZgloszenia.tsx`) to kolejka pracy: dwa rodzaje, statusy,
podpis obsługującego, notatka, „po terminie".

**Dwa rodzaje zgłoszeń:**
- **Zamówienia** = zakupy za punkty. Księga (`voucher_transactions`, `type='wykorzystanie'`) jest
  niezmienna (`trg_ledger_no_update/no_delete`), więc stan obsługi żyje obok niej w
  `benefit_order_fulfillments` (1:1 po `transaction_id`, migracja 062). **Kolejka jest pochodną
  księgi:** każdy odczyt listy woła najpierw `bok_sync_order_queue(p_auto_service_ids)`, która
  dopisuje brakujące wpisy — nie da się zgubić zamówienia. Aplikacje Eliton (`fulfillment: 'auto'`)
  i `INTERNAL-*` wchodzą od razu jako `done` z etykietą „automatyczna" (BOK nic nie robi, ale widzi
  historię zakupów); reszta jako `new` z etykietą „realizuje BOK". Partner dokładany z katalogu przy
  odczycie (księga go nie zna).
- **Zapytania o ofertę** = `benefit_inquiries` (miała `status` od 061); 062 dokłada `handled_by`,
  `handled_at`, `note`, `updated_at`.

**Statusy i reguła obsługi (`lib/benefits/bokQueue.ts`, testy):** `new` → `in_progress` → `done`,
zmiana dowolna (BOK może cofnąć). Przejście na „w toku"/„zamknięte" podpisuje `handled_by`/`handled_at`
zalogowanym; powrót na „nowe" zdejmuje podpis. Sama notatka (≤ 500 znaków) nie zmienia statusu ani
podpisu. Filtry: **Otwarte** (domyślny: nowe + w toku) / Nowe / W toku / Zamknięte / Wszystkie.
**„Po terminie"** = otwarte zgłoszenie starsze niż 2 dni robocze (`isOverdue`, liczone w UTC, soboty
i niedziele pomijane, święta świadomie nie) — pokazane tekstem z ikoną, nie samym kolorem.

**API (`lib/benefits/bokQueueServer.ts`):** `GET /api/admin/bok/{orders|inquiries}?status=&limit=&offset=`
(lista + liczniki per status), `PATCH /api/admin/bok/{kind}/{id}` `{status?, note?}`,
`GET /api/admin/bok/summary` (liczniki obu kolejek). Bramka: **`can(auth, 'benefity.zgloszenia')`**
(nowy klucz w grupie „Benefity" + pozycja w `PERMISSION_MENU`), żeby osobę z BOK dało się wpuścić
rolą własną bez superadmina; brak sesji → 401, brak klucza → 403. Dane pracownika do kontaktu (imię
i nazwisko, e-mail logowania z `auth.users` przez `listUsers` — konwencja `/api/users`, telefon,
firma) dokładane przy odczycie; nic nie jest kopiowane do tabel kolejki.

**E-maile:** maile do BOK (zamówienie, zapytanie) dostają linijkę „Status obsługi: {BOK_QUEUE_URL}"
(`https://ebs.elitonbenefits.pl/dashboard/admin?view=admin-zgloszenia` — mechanizm `?view=`). Maile do
pracownika linku nie dostają.

**Usuwanie kont:** `handled_by` w obu tabelach odpinane tylko przy PURGE (`DETACH_TABLES`,
`purgeOnly`), przy anonimizacji profil zostaje jako „Konto usunięte". `benefit_order_fulfillments.user_id`
idzie z księgą (wpis `wykorzystanie` i tak wymusza anonimizację). Audyt: trigger `fn_audit_log`
na nowej tabeli (bez danych wrażliwych; notatka BOK to treść operacyjna).

**Świadomie odłożone:** plakietka z liczbą nowych zgłoszeń w menu bocznym (endpoint `summary` już
jest), KPI na Pulpicie admina, akcje zbiorcze, filtrowanie po firmie/pracowniku.

## 12. Sklep jako ekran startowy pracownika (17.09.2026)

**Decyzja właściciela** po obejrzeniu Pulpitu v2 na produkcji („jest stary ekran z usługami"):
*zostawić starą wersję w kodzie, żeby dało się do niej wrócić w każdej chwili, a na jej miejsce
podpiąć nowy layout, czyli sklep*. Unieważnia S5 w części dotyczącej Pulpitu: sekcja „Twoje
Aplikacje" i karta salda ze statystykami nie są już pierwszym ekranem po zalogowaniu.

**Przełącznik:** `lib/benefits/storeLayout.ts` — `EMPLOYEE_HOME: 'store' | 'wallet'` (obok
`STORE_LAYOUT`) i flaga `STORE_IS_HOME = STORE_LAYOUT === 'v2' && EMPLOYEE_HOME === 'store'`.
Powrót do dawnego Pulpitu = `'wallet'`. Test `storeLayout.test.ts` pilnuje, żeby `'store'` nie szło
w parze z `'v1'` (sklep nie istnieje w v1). Kod Pulpitu v2 (`renderWallet`) i v1 (karuzele) zostaje.

**Jak wygląda (STORE_IS_HOME):**
- `BenefitStore variant="page"` renderuje się **w miejscu treści Pulpitu, wewnątrz ramki portalu**
  — czarny nagłówek (saldo, wygasanie, powiadomienia, ustawienia, wylogowanie) i menu boczne zostają.
  Nakładka pełnoekranowa (`variant="overlay"`, portal do body, logo + X) zostaje dla trybu `'wallet'`.
  Powód: nakładka jako ekran startowy odcięłaby pracownika od Historii, Pomocy, Aktywnych usług
  i ustawień, a na mobile — od dolnego paska.
- Sekcja z jasnym tłem idzie „od krawędzi do krawędzi" `<main>` (ujemne marginesy kasują
  `p-4 md:p-6`), poza siatką banerów 240 px (na laptopach 1440 px ścisnęłaby siatkę do 3–4 kart
  po ~115 px). Pasek narzędzi sklepu: tytuł + szukajka (bez logo i X); saldo w pasku tylko poniżej
  `md` (od `md` pokazuje je karta „Twoje saldo" w kolumnie kategorii).
- **Panel szczegółów i modal zakupu nadal przez `createPortal(…, document.body)`** — prawa kolumna
  `EmployeeDashboardClient` ma własny kontekst warstwowania (`relative z-10`), w którym pasek boczny
  (`z-50`) przykrywałby tło panelu (pułapka z 16.09, commit `2ac45ac`).
- Start: `activeTab = 'CATALOG'`, `currentView = 'emp-catalog'` (menu boczne podświetla sklep od
  pierwszego renderu, wpis historii SPA wskazuje sklep). Wyjście z aplikacji pełnoekranowych
  (Wellbeing/Prawnik/Messenger/Vault) wraca do sklepu (`goHome`), nie do portfela. `'emp-dashboard'`
  (Ctrl+K, etykieta „Sklep benefitów") mapuje się na sklep.
- Menu boczne pracownika: **bez „Twoje Aplikacje"** (sekcja nie istnieje; aplikacje Eliton są w sklepie
  w swoich kategoriach — Q5 — a kupione w „Aktywne usługi"). Dolny pasek mobile: Sklep · Moje ·
  Historia · Pomoc (bez „Pulpit").

**Świadomie odłożone:** filtr „Aplikacje Eliton" w kolumnie kategorii (namiastka dawnej sekcji „Twoje
Aplikacje"); karta salda/statystyki jako element sklepu (dziś saldo jest w nagłówku, kolumnie kategorii
i pasku mobile); brak salda na mobile w wariancie `overlay` (stan sprzed tej zmiany).

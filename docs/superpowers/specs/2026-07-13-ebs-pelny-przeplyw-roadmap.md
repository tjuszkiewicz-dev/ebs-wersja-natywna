# EBS — pełny przepływ operacyjny: roadmap (7 pod-projektów)

**Data:** 2026-07-13
**Autor:** Tomasz Juszkiewicz (we współpracy z Claude Code)
**Status:** Master-spec do akceptacji. Każdy pod-projekt (SP) dostanie własny spec → plan → wdrożenie.

## 1. Cel

Domknąć docelowy przepływ operacyjny EBS (9 kroków biznesowych) — od założenia firmy, przez comiesięczne zamówienie i dystrybucję voucherów, po wygaśnięcie, odkup i rozliczenie przelewami. Poniżej mapa stanu obecnego i dekompozycja na 7 niezależnie wdrażalnych pod-projektów.

## 2. Docelowy przepływ (9 kroków — słowa użytkownika)

1. Zakładamy konto firmy korzystającej z benefitów.
2. Ustawiamy parametry firmy, w tym **dedykowany nr konta** pojawiający się na nocie księgowej.
3. Zakładane jest konto HR.
4. HR co miesiąc składa zamówienie przez formularz; dane pracowników ładowane z Excela (nowi → do kartoteki; brak w Excelu ≠ usunięcie z kartoteki, tylko brak zamówienia w danym miesiącu); edycja wszystkich danych w kartotece istniejącego pracownika (w tym IBAN).
5. Z zamówienia: nota księgowa + faktura VAT. Po oznaczeniu **noty** jako opłaconej → vouchery na konta pracowników; pracownicy kupują benefity (ubezpieczenia, pakiety medyczne, Orange, e-booki, poradniki).
6. Po dacie wygaśnięcia (ustawionej w panelu firmy) vouchery **automatycznie wygasają**; pracownik może je odnowić przyciskiem. **1 dzień przed** wygaśnięciem → e-mail (na adres z kartoteki) + powiadomienie in-app.
7. Jeśli termin minie bez odnowienia → generowana **umowa odkupu voucherów** (wzór dostarczony). Admin edytuje treść umowy **bez dłubania w kodzie**.
8. Po wysłaniu do każdego pracownika maila z informacją o odkupie **+ załączoną umową** (uzupełnioną jego danymi) → generowana **paczka przelewów** (dane wszystkich pracowników z anulowaniem) do pobrania i wgrania w banku.
9. Ze zdarzenia generowany jest **log** (tylko do systemu); powstaje **strona logów + pozycja w sidebarze**.

## 3. Mapa stanu obecnego (z audytu kodu)

| # | Krok | Stan | Dowód |
|---|---|---|---|
| 1 | Konto firmy | ✅ | `app/api/companies/route.ts`, `components/adminNew/CompanyFormModal.tsx` |
| 2 | Rachunek na nocie | ❌ | `companies` bez kolumny konta; nota drukuje zahardkodowany `ISSUER.bank` (`lib/documentService.ts:224`, `lib/documents/pdfUtils.ts`) |
| 3 | Konto HR | ✅ | `app/api/companies/[id]/contacts/[contact_id]/create-hr-account/route.ts` |
| 4 | Zamówienie+Excel+kartoteka+IBAN | ⚠️ | `views/DashboardNewHR.tsx`, `utils/excelHr.ts`; brak usuwania nieobecnych (OK). IBAN: serwer `/finance` bez mod-97, import bez walidacji IBAN, `iban_verified` niespójne, martwy `EmployeeEditModal` |
| 5 | Nota+faktura+vouchery po opłacie | ✅ | `lib/documentService.ts`, `orders/[id]/pay`, `invoices/[id]/pay`, `lib/fakturownia/*` |
| 6 | Wygaśnięcie/odnowienie/mail/in-app | ⚠️ | cron `expire-vouchers` + `expire_vouchers_and_create_buybacks` + odnowienie `vouchers/activate`,`extend` + in-app *w momencie* wygaśnięcia. **Brak: przypomnienie 1-dzień-przed + jakikolwiek e-mail** |
| 7 | Umowa odkupu | ⚠️ | `buyback_agreements` (mig. 001) + `BuybackAgreementTemplate.tsx` (klient). **Brak: edycji w panelu + serwerowego PDF** |
| 8 | Elixir-0 | ❌ | `companies/[id]/buyback-batches` generuje CSV (ing/pko/mbank/santander/standard). **Brak Elixir-0 i Millennium** |
| 9 | Logi | ⚠️ | `audit_log` + `fn_audit_log` **piszą się**. **Brak UI i pozycji w menu** |
| — | E-mail | ⚠️ | `resend` zainstalowany, użyty tylko w `contact-bok`. Reszta wysyłki do zbudowania |

## 4. Decyzje (zablokowane w wywiadzie)

1. **Rachunek na nocie (krok 2)** = subkonto konta głównego Millennium **per pracodawca** (rozdzielenie środków różnych firm). Pole na firmie; nota drukuje konto firmy (fallback `ISSUER.bank`).
2. **Elixir (krok 8)** = generujemy **dwa** formaty: **Elixir-0 (KIR)** oraz **Millennium CSV** (na przyszłość).
3. **Umowa odkupu (krok 7)** = szablon HTML z **polami-zmiennymi** trzymany w bazie, edytowalny w panelu admina.
4. **E-mail** = **Resend** (już w projekcie), domena nadawcy **@stratton-prime.pl** (do potwierdzenia w panelu Resend).
5. **Wyzwalanie odkupu (krok 8)** = **automatycznie po wygaśnięciu** (bezpieczne: plik przelewów i tak wgrywany do banku ręcznie — żadne środki nie ruszają się same).
6. **Kolejność** = **SP1→SP6 sekwencyjnie**, każdy pod-projekt własny spec → plan → wdrożenie.
7. **IBAN (krok 4)** = naprawiamy znalezione problemy (bez dodatkowego objawu).

## 5. Dekompozycja — 7 pod-projektów

### Fundament · `lib/mailer.ts`
Jeden moduł wysyłki na Resend: `sendEmail({to, subject, html, attachments?})`, `FROM_EMAIL` z env (domena @stratton-prime.pl). Graceful gdy brak `RESEND_API_KEY` (log, nie wywala flow). Używany przez SP4 i SP5. *(Powstaje razem z pierwszym SP, który go potrzebuje — SP4.)*

### SP1 · Dedykowany rachunek firmy na nocie
- Migracja: `companies.bank_account TEXT`, `companies.bank_account_desc TEXT` (opcjonalny opis/nazwa banku).
- `buildPolishInvoiceHtml` (nota): drukuj `company.bank_account ?? ISSUER.bank`; to samo w QR płatności. Przekazać konto firmy do kontekstu dokumentu (rozszerzyć `DocumentContext` + miejsca tworzące notę: `createOrderDocuments`, `financials/[doc_id]/pdf`, skrypty regen).
- `CompanyFormModal` + POST/PATCH `companies`: pole „Nr rachunku na nocie" (walidacja IBAN mod-97, opcjonalne — brak = fallback).
- Test: nota z kontem firmy vs fallback.

### SP2 · Kartoteka: utwardzenie IBAN
- `app/api/users/[id]/finance`: dodać walidację **mod-97** (dziś tylko długość 15–34).
- Import Excel (`utils/excelHr.ts`): walidować IBAN mod-97, wiersze z błędnym IBAN oznaczać (nie wpuszczać cicho do DB).
- Ujednolicić `iban_verified`: **każdy nowo wprowadzony/zmieniony IBAN = `false`** we wszystkich ścieżkach (dziś `bulk-import` ustawia `true`). Weryfikacja pozostaje osobnym krokiem (superadmin / `iban_change_requests`).
- Usunąć martwy `components/hr/modals/EmployeeEditModal.tsx` (0 importów, źródło pomyłek) — żywa edycja jest inline w `DashboardNewHR`.
- Wspólny walidator IBAN w `lib/iban.ts` (dziś dwie kopie: `DashboardNewHR:948`, `payrollService:53`).
- Test: mod-97 (poprawny/niepoprawny), spójność `iban_verified`.

### SP3 · Umowa odkupu: edytowalny szablon + serwerowy PDF
- Migracja: tabela `document_templates(key, html, updated_by, updated_at)`; seed `buyback_agreement` treścią z dostarczonego wzoru (Umowa Zbycia Voucherów).
- Placeholdery: `{{imie_nazwisko}}`, `{{pesel_nip}}`, `{{adres}}`, `{{nr_ilustracji}}`, `{{liczba_voucherow}}`, `{{wartosc_pln}}`, `{{iban_zbywajacego}}`, `{{email_zbywajacego}}`, `{{data}}`.
- Panel admina: Ustawienia → „Szablony dokumentów" → edytor treści `buyback_agreement` (textarea/rich-text z listą dostępnych pól) + podgląd; zapis `PATCH /api/admin/document-templates/[key]` (superadmin).
- `lib/documents/buybackAgreementService.ts`: pobiera szablon, podstawia dane z `buyback_agreements.snapshot`, generuje PDF (Puppeteer → Storage), zwraca URL. Wzór PDF (nagłówek/stopka) jak `umowaService`.
- Test: podstawienie placeholderów, brak nietkniętych `{{...}}` w wyniku.

### SP4 · Wygaśnięcie: przypomnienie 1-dzień-przed (mail + in-app)
- Codzienny przegląd voucherów z `valid_until` w oknie „jutro" → dla każdego pracownika: e-mail (Resend) „Twoje vouchery wygasają jutro — odnów" + powiadomienie in-app z linkiem do odnowienia.
- **Ograniczenie Vercel Hobby (crony ≤ raz/dobę, limit liczby):** przypomnienie **doklejone do istniejącego dziennego crona** (nowy `GET /api/cron/daily-maintenance` łączący: przypomnienia-jutro + wygaszanie-dziś, chroniony `CRON_SECRET`), albo rozszerzenie `expire-vouchers`. Bez dodawania 3. crona.
- Idempotencja: nie wysyłać dwa razy tego samego dnia (znacznik „reminder_sent_at" na voucherze/koncie lub dedup po dacie).
- Test: wybór voucherów wygasających jutro, dedup wysyłki.

### SP5 · Odkup: mail do pracownika + paczka przelewów (Elixir-0 + Millennium)
- Po wygaśnięciu bez odnowienia (rozszerzenie ścieżki, która tworzy `buyback_agreements`): dla każdego pracownika **auto** → generacja PDF umowy (SP3) → e-mail z **załączoną umową** (dane pracownika) → dopisanie do paczki.
- `lib/bank/elixir0.ts` (format KIR Elixir-0: rekordy 110, kwoty w groszach, Windows-1250) + `lib/bank/millenniumCsv.ts` (natywny CSV Millennium). Obciążenie: główne konto Stratton; uznanie: IBAN pracownika; kwota = liczba odkupionych voucherów × 1 zł; tytuł: „Odkup voucherów EBS {nr umowy}".
- Paczki zapisywane w `buyback_batches` (istnieje, ma `file_csv`,`format`) + do pobrania w `AdminBuyback`. Rozszerzyć endpoint `companies/[id]/buyback-batches` o formaty `elixir0` i `millennium`.
- **Bezpieczeństwo:** żaden przelew nie jest wykonywany przez system — generujemy tylko pliki do ręcznego wgrania w banku.
- Idempotencja: jeden mail/jedna pozycja w paczce na umowę odkupu.
- Test: poprawność rekordów Elixir-0 (suma kontrolna/długości pól) i CSV Millennium; mail z załącznikiem.

### SP6 · Logi systemowe: strona + sidebar
- `GET /api/admin/logs` (superadmin): odczyt `audit_log` z filtrami (encja, typ, data) i paginacją.
- Widok `components/adminNew/AdminLogi.tsx` (tabela zdarzeń) + pozycja sidebara `admin-logi` „Logi systemowe" + wpięcie w `VIEW_TO_TAB`/`GlobalSearch`.
- Zdarzenia odkupu/wysyłki maili/generacji paczki (SP5) zapisywane jako log aplikacyjny (uzupełnienie automatycznych triggerów `fn_audit_log`).
- Test: filtrowanie/paginacja; widoczność tylko dla superadmina.

## 6. Kolejność i zależności
`SP1` → `SP2` → `SP3`(+mailer) → `SP4` → `SP5`(zależy od SP2 IBAN, SP3 PDF, mailer) → `SP6`. Każdy zamykany osobnym spec+plan i osobnym wdrożeniem/deploy.

## 7. Poza zakresem (na teraz)
- Realne wykonywanie przelewów / integracja z API banku (generujemy tylko pliki).
- Auto-aktualizacja statusu „opłacone" z banku (krok 5, „w przyszłości") — osobny projekt.
- Podpisy elektroniczne umowy odkupu (Autenti) — osobny projekt.
- E-podpis / KSeF dla umowy odkupu (nota/faktura mają swój tor).

## 8. Ryzyka / uwagi
- **Crony Hobby**: nie dodajemy 3. crona — łączymy w „daily-maintenance" (SP4).
- **Millennium subkonta (krok 2)**: to numery, które zakładasz w banku; EBS tylko je przechowuje i drukuje — bez integracji bankowej.
- **Elixir-0**: kodowanie Windows-1250 i długości pól są krytyczne — testy jednostkowe na wzorcach.
- **Auto-odkup (SP5)**: bezpieczne, bo pliki wgrywane ręcznie; mimo to logujemy każde wysłanie maila i generację paczki.

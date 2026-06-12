# Integracja EBS ↔ Fakturownia (faktury + noty + płatności + KSeF)

**Data:** 2026-06-12
**Status:** Spec zaakceptowany przez użytkownika — gotowy do planu wdrożenia
**Projekt:** EBS (ebs-wersja-natywna)

---

## 1. Cel

Faktury VAT i noty księgowe wystawiane w EBS mają **automatycznie trafiać do Fakturowni**
(konto `stratton-prime.fakturownia.pl`), gdzie:
- nadawany jest numer i generowany PDF (Fakturownia = źródło prawdy),
- faktura VAT jest wysyłana do **KSeF** (automatycznie po stronie konta Fakturowni),
- klient może **opłacić online** klikając link bramki płatniczej,
- status opłacenia **wraca do EBS** i domyka płatność zamówienia.

## 2. Decyzje (ustalone z użytkownikiem)

| Temat | Decyzja |
|---|---|
| Źródło prawdy faktur | **Fakturownia.** EBS przestaje generować własne PDFy faktur/not; tworzy dokument przez API i pobiera numer + PDF + link płatności. |
| Zakres dokumentów | **Faktura VAT + nota księgowa.** Faktura `kind: "vat"`, nota `kind: "accounting_note"`. |
| Moment wystawienia | Przy **`hr-confirm`** zamówienia (gdzie dziś EBS liczy `valid_until` i generuje dokumenty). |
| Dane nabywcy | Firmy mają komplet (`nip` UNIQUE + `address_*`). Mapowanie firma→klient FA po NIP, cache `fakturownia_client_id`. |
| Struktura płatności | **Dwa osobne dokumenty, dwa linki** (nota za vouchery bez VAT, faktura za fee z VAT). |
| Link płatności | Publiczny link faktury FA (`/invoice/{token}`); przycisk „Zapłać" wymaga **bramki** podpiętej na koncie FA. |
| Sync statusu | **Webhook + cron co 30 min** (reconcyliacja). |
| KSeF | **Automatycznie po stronie Fakturowni** — brak kodu KSeF w EBS. |
| Migracja | **Tylko nowe** dokumenty (od wdrożenia). Bez backfillu. |

## 3. Założenia wstępne (do potwierdzenia na koncie Fakturowni)

1. **Bramka płatnicza** (PayU/Przelewy24/Autopay) jest podpięta na koncie FA — inaczej link nie ma przycisku „Zapłać online", zostaje tylko przelew tradycyjny.
2. **Auto-KSeF** jest włączony w ustawieniach konta FA (faktury `vat` lecą do KSeF same).
3. Dostępny **token API** (`Ustawienia → Integracja → Kod autoryzacyjny API`).

## 4. Fakty o API Fakturowni (zweryfikowane)

- Base URL: `https://stratton-prime.fakturownia.pl/`, auth: `api_token` w body/query.
- `POST /invoices.json` — `kind: "vat"` (faktura VAT) / `kind: "accounting_note"` (nota księgowa).
- Klient: `GET /clients.json?tax_no={NIP}` (wyszukanie), `POST /clients.json` (utworzenie, wymagane `name`), w fakturze `client_id`.
- Odpowiedź faktury: `id`, `number`, `token`, `status`. **Brak osobnego `payment_url`** — link publiczny: `https://{domena}/invoice/{token}`, PDF: `.../invoice/{token}.pdf`.
- Status płatności: `GET /invoices/{id}.json` → `status ∈ {issued, sent, paid, partial, rejected}`.
- Termin płatności: `payment_to_kind` (dni / `off`), `payment_to` (data), `payment_type` (`transfer`, `payu`...).
- Webhooki: dostępne (sekcja „Webhooki") — do potwierdzenia format payloadu przy implementacji.

## 5. Architektura

```
hr-confirm  ──►  invoiceService  ──►  fakturowniaClient  ──►  Fakturownia API ──► KSeF (auto)
(trigger)        (mapowanie EBS→FA)   (czysty wrapper HTTP)        │
                       │                                           ▼
                       └──► financial_documents (id/token/link/status)
                                           ▲
        webhook /api/webhooks/fakturownia ─┤  (płatność → 'paid')
        cron  /api/cron/sync-fakturownia  ─┘  (reconcyliacja co 30 min)
```

### 5.1 `lib/fakturownia/client.ts` — czysty wrapper HTTP
Bez wiedzy o domenie EBS. Token + domena z env. Metody:
- `findClientByNip(nip): Promise<FaClient | null>`
- `createClient(data): Promise<FaClient>`
- `createInvoice(payload): Promise<FaInvoice>`
- `getInvoice(id): Promise<FaInvoice>`
Zależności: tylko `fetch` + env. **Testowalne w izolacji** (mock fetch).

### 5.2 `lib/fakturownia/invoiceService.ts` — mapowanie EBS → FA
- `ensureClient(company): Promise<number>` — zwraca `fakturownia_client_id`; wyszukuje po NIP, tworzy gdy brak, cache'uje na `companies`.
- `issueDocumentsForOrder(order, company): Promise<void>` — tworzy notę + fakturę, zapisuje wyniki do `financial_documents`. Idempotentne.
- `mapNota(order)` / `mapFaktura(order)` — budują payloady (pozycje, kwoty, VAT 23%, `payment_to_kind` z `custom_payment_terms_days`).

### 5.3 Trigger — `app/api/orders/[id]/hr-confirm/route.ts`
Po obecnej logice (valid_until): zamiast lokalnej generacji PDF → `invoiceService.issueDocumentsForOrder`.
**Odporność na awarię FA:** gdy wywołanie padnie, `hr-confirm` i tak kończy się sukcesem (zamówienie potwierdzone), a dokument dostaje `fakturownia_sync_status='failed'`; w panelu pojawia się przycisk „Ponów wysyłkę".

### 5.4 Webhook — `app/api/webhooks/fakturownia/route.ts`
POST od Fakturowni przy zmianie statusu → znajdź dokument po `fakturownia_invoice_id` → przy `paid` ustaw `status='paid'`, `payment_confirmed_at=now()`, domknij płatność zamówienia. Weryfikacja źródła (sekret w URL/nagłówku — do potwierdzenia z formatem FA).

### 5.5 Cron — `app/api/cron/sync-fakturownia-payments/route.ts`
Co 30 min (`vercel.json` crons): pobierz `financial_documents` z `fakturownia_invoice_id` i `status='pending'`, odpytaj `GET /invoices/{id}.json`, zaktualizuj opłacone. Łapie zdarzenia zgubione przez webhook.

## 6. Zmiany w bazie (jedna migracja, np. `037_fakturownia.sql`)

```sql
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS fakturownia_client_id INTEGER;

ALTER TABLE financial_documents
  ADD COLUMN IF NOT EXISTS fakturownia_invoice_id INTEGER,
  ADD COLUMN IF NOT EXISTS fakturownia_token      TEXT,
  ADD COLUMN IF NOT EXISTS payment_url            TEXT,
  ADD COLUMN IF NOT EXISTS fakturownia_sync_status TEXT
      CHECK (fakturownia_sync_status IN ('pending','synced','failed'));

CREATE INDEX IF NOT EXISTS idx_findocs_fakturownia
  ON financial_documents(fakturownia_invoice_id);
```

**Reużycie istniejących kolumn** (schemat był pod to projektowany):
- `pdf_url` → link PDF z Fakturowni
- `external_payment_ref` → numer faktury FA
- `status` / `payment_confirmed_at` → stan opłacenia
- `payment_due_date` → termin płatności

Aktualizacja `types/database.ts` (ręcznie utrzymywany) o nowe kolumny.

## 7. UI (minimalne zmiany)

- `components/adminNew/AdminPlatnosci.tsx` i widoki `financials`:
  - badge statusu FA (`issued/sent/paid/partial`),
  - przycisk **„Zapłać"** → `payment_url`,
  - przycisk **„Pobierz PDF"** → `pdf_url` (FA),
  - numer faktury z FA,
  - przy `sync_status='failed'` → przycisk **„Ponów wysyłkę"** (`POST` do endpointu ponawiania).

## 8. Konfiguracja (env)

```
FAKTUROWNIA_API_TOKEN=<sekret — ustawia użytkownik w .env.local i Vercel env>
FAKTUROWNIA_DOMAIN=stratton-prime
FAKTUROWNIA_WEBHOOK_SECRET=<sekret do weryfikacji webhooka>
```
Sekrety nie trafiają do repo ani do czatu.

## 9. Obsługa błędów i przypadki brzegowe

- **Idempotencja:** przed wysłką sprawdzamy `fakturownia_invoice_id` + istniejący unique index `(linked_order_id, type)` → brak duplikatów przy ponowieniu `hr-confirm`.
- **Awaria FA przy wystawianiu:** nie blokuje operacji; `sync_status='failed'` + retry z panelu.
- **Brak danych firmy:** walidacja NIP/adresu przed wysłką; czytelny błąd zamiast 500.
- **Webhook zgubiony:** cron reconcyliacyjny domyka stan.
- **Częściowa płatność (`partial`):** mapujemy na `status='pending'` (niepełna) — opłacone dopiero przy `paid`.
- **Rollback źródła prawdy:** stara lokalna generacja PDF pozostaje w kodzie jako martwa do czasu potwierdzenia, że FA działa w produkcji (usunięcie w osobnym kroku po stabilizacji).

## 10. Testy

- `lib/fakturownia/client.ts` — testy jednostkowe z mockiem `fetch` (mapowanie żądań/odpowiedzi, błędy HTTP).
- `invoiceService` — mapowanie kwot (nota bez VAT, faktura 23%), idempotencja, ensureClient (hit/miss).
- Webhook — payload `paid` → poprawna aktualizacja; nieznany invoice_id → 200 bez efektu.
- POC manualny: jedna faktura testowa wysłana na konto FA potwierdzająca token/konto przed pełnym wdrożeniem.

## 11. Poza zakresem (świadomie)

- Backfill istniejących dokumentów do FA.
- Korekty/storna faktur (`kind: correction`) — osobny temat.
- Usunięcie starej lokalnej generacji PDF (osobny krok po stabilizacji).
- Konfiguracja bramki i KSeF na koncie FA (to ustawienia konta, nie kod EBS).

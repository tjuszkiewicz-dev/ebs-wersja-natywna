-- =============================================================================
-- EBS — Eliton Benefits System
-- Migracja 001: Pełny schemat produkcyjny
-- Wklej bezpośrednio do Supabase SQL Editor i wykonaj jednorazowo.
--
-- Zasady nienaruszalne:
--   • Saldo tylko przez transakcje — nigdy bezpośredni UPDATE na balance
--   • voucher_transactions: tylko INSERT — tabela immutable ledger
--   • Prowizje zawsze w PLN — nigdy w voucherach
--   • Voucher = MPV (art. 8b Ustawy o VAT, Dyrektywa UE 2016/1065)
--   • Wszędzie "voucher" — nigdy "token"
-- =============================================================================


-- =============================================================================
-- 0. ROZSZERZENIA
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- wyszukiwanie pełnotekstowe


-- =============================================================================
-- 1. TABELE (kolejność FK-safe)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1.1 user_profiles — rozszerza auth.users o rolę i dane biznesowe
-- ON DELETE CASCADE: usunięcie konta auth usuwa profil (RODO: prawo do zapomnienia)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
  id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL
                              CHECK (role IN ('superadmin','pracodawca','pracownik','partner','menedzer','dyrektor')),
  full_name       TEXT,
  company_name    TEXT,
  pesel           TEXT,                         -- zaszyfrowane w warstwie app (RODO)
  phone_number    TEXT,
  iban            TEXT,                         -- zweryfikowane konto do wypłat
  iban_verified   BOOLEAN     DEFAULT FALSE,
  iban_verified_at TIMESTAMPTZ,
  department      TEXT,
  position        TEXT,
  hire_date       DATE,
  contract_type   TEXT        CHECK (contract_type IN ('UOP','UZ')),
  status          TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','inactive','anonymized')),
  terms_accepted  BOOLEAN     DEFAULT FALSE,
  terms_accepted_at TIMESTAMPTZ,
  anonymized_at   TIMESTAMPTZ,
  two_fa_enabled  BOOLEAN     DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE user_profiles IS 'Profil użytkownika — rozszerza auth.users. Jeden profil na użytkownika.';

-- ---------------------------------------------------------------------------
-- 1.2 companies — firmy klientów (pracodawcy) i struktura sprzedaży
-- ON DELETE RESTRICT: nie można usunąć firmy mającej zamówienia/pracowników
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        TEXT        NOT NULL,
  nip                         TEXT        NOT NULL UNIQUE,
  address_street              TEXT,
  address_city                TEXT,
  address_zip                 TEXT,
  balance_pending             INTEGER     NOT NULL DEFAULT 0 CHECK (balance_pending >= 0),
  balance_active              INTEGER     NOT NULL DEFAULT 0 CHECK (balance_active >= 0),
  -- Struktura sprzedaży
  advisor_id                  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  manager_id                  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  director_id                 UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Konfiguracja
  custom_voucher_validity_days INTEGER,
  custom_payment_terms_days    INTEGER,
  -- CRM
  origin                      TEXT        DEFAULT 'NATIVE' CHECK (origin IN ('NATIVE','CRM_SYNC')),
  external_crm_id             TEXT,
  is_sync_managed             BOOLEAN     DEFAULT FALSE,
  created_at                  TIMESTAMPTZ DEFAULT now(),
  updated_at                  TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE companies IS 'Firmy klientów. Saldo przechowywane jako liczba całkowita (1 voucher = 1 PLN).';

-- ---------------------------------------------------------------------------
-- 1.3 voucher_accounts — portfel voucherowy każdego użytkownika
-- Saldo aktualizowane WYŁĄCZNIE przez funkcję transfer_vouchers() — nigdy ręcznie.
-- ON DELETE CASCADE: usunięcie użytkownika usuwa jego konto voucherowe
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voucher_accounts (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance     INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at  TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE voucher_accounts IS
  'Portfel voucherowy. Saldo nigdy nie jest modyfikowane bezpośrednio — '
  'tylko przez funkcję transfer_vouchers() która jednocześnie zapisuje ledger.';

-- ---------------------------------------------------------------------------
-- 1.4 voucher_orders — zamówienia voucherów składane przez pracodawców
-- ON DELETE RESTRICT: zamówienie powiązane z voucherami nie może być usunięte
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voucher_orders (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID           NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  hr_user_id          UUID           REFERENCES auth.users(id) ON DELETE SET NULL,
  amount_pln          NUMERIC(10,2)  NOT NULL CHECK (amount_pln > 0),
  amount_vouchers     INTEGER        NOT NULL CHECK (amount_vouchers > 0),
  fee_pln             NUMERIC(10,2)  NOT NULL DEFAULT 0,
  total_pln           NUMERIC(10,2)  NOT NULL,    -- amount_pln + fee_pln
  status              TEXT           NOT NULL DEFAULT 'pending'
                                     CHECK (status IN ('pending','approved','paid','rejected','cancelled')),
  is_first_invoice    BOOLEAN        DEFAULT FALSE,
  -- Dokumenty (numery do faktur/not debetowych)
  doc_voucher_id      TEXT,
  doc_fee_id          TEXT,
  -- Payroll snapshot (JSON)
  payroll_snapshots   JSONB,
  distribution_plan   JSONB,
  created_at          TIMESTAMPTZ    DEFAULT now(),
  updated_at          TIMESTAMPTZ    DEFAULT now()
);
COMMENT ON TABLE voucher_orders IS 'Zamówienia voucherów. Status: pending→approved→paid (lub rejected/cancelled).';

-- ---------------------------------------------------------------------------
-- 1.5 vouchers — fizyczne instancje voucherów (instrument MPV)
-- Każdy voucher to odrębny instrument prepaid zgodny z Dyrektywą UE 2016/1065
-- ON DELETE RESTRICT: voucher powiązany z zamówieniem nie może być usunięty
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vouchers (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number         TEXT          NOT NULL UNIQUE,
  face_value_pln        NUMERIC(10,2) NOT NULL DEFAULT 1.00 CHECK (face_value_pln = 1.00),
  order_id              UUID          NOT NULL REFERENCES voucher_orders(id) ON DELETE RESTRICT,
  company_id            UUID          NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  current_owner_id      UUID          NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status                TEXT          NOT NULL DEFAULT 'created'
                                      CHECK (status IN (
                                        'created','reserved','active','distributed',
                                        'consumed','expired','buyback_pending','buyback_complete'
                                      )),
  -- Dane emitenta (MPV — muszą być utrwalone na voucherze)
  issuer_name           TEXT          NOT NULL DEFAULT 'Nazwa Spółki Sp. z o.o.',
  issuer_nip            TEXT          NOT NULL DEFAULT '0000000000',
  issuer_address        TEXT          NOT NULL DEFAULT 'ul. Przykładowa 1, 00-000 Warszawa',
  redemption_scope      TEXT          NOT NULL DEFAULT 'Usługi szkoleniowe i rozwojowe',
  legal_basis           TEXT          NOT NULL DEFAULT
    'Dyrektywa UE 2016/1065; art. 8b Ustawy o VAT; voucher wielofunkcyjny MPV — VAT rozliczany w momencie realizacji',
  -- Daty
  issued_at             TIMESTAMPTZ   DEFAULT now(),
  valid_until           DATE          NOT NULL,
  redeemed_at           TIMESTAMPTZ,
  redeemed_by_user_id   UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_order_id     UUID,
  -- Powiązanie z odkupem
  buyback_agreement_id  UUID,        -- FK dodane po stworzeniu tabeli buyback_agreements
  metadata              JSONB,
  created_at            TIMESTAMPTZ   DEFAULT now()
);
COMMENT ON TABLE vouchers IS
  'Fizyczne instancje voucherów. Każdy voucher = 1 PLN (MPV). '
  'Numer seryjny generowany wyłącznie przez generate_voucher_serial(). '
  'VAT nie jest naliczany przy emisji — dopiero przy realizacji.';

-- ---------------------------------------------------------------------------
-- 1.6 voucher_transactions — IMMUTABLE LEDGER
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- TA TABELA JEST APPEND-ONLY. ŻADEN UPDATE ANI DELETE NIE JEST DOZWOLONY.
-- RLS i trigger enforce_ledger_immutability pilnują tej zasady.
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- ON DELETE RESTRICT: historia transakcji musi być zachowana (retencja księgowa)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voucher_transactions (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id  UUID    REFERENCES auth.users(id) ON DELETE RESTRICT,  -- NULL = emisja systemowa
  to_user_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  amount        INTEGER NOT NULL CHECK (amount > 0),
  type          TEXT    NOT NULL
                        CHECK (type IN ('zakup','przekazanie','wykorzystanie','zwrot','emisja','odkup')),
  status        TEXT    NOT NULL DEFAULT 'completed'
                        CHECK (status IN ('completed','pending','failed')),
  order_id      UUID    REFERENCES voucher_orders(id) ON DELETE RESTRICT,
  service_id    TEXT,   -- ID usługi z katalogu (przy 'wykorzystanie')
  service_name  TEXT,   -- Snapshot nazwy usługi
  metadata      JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
  -- BRAK updated_at — tabela immutable, rekord się nie zmienia po INSERT
);
COMMENT ON TABLE voucher_transactions IS
  '!! IMMUTABLE LEDGER — TYLKO INSERT !! '
  'Każda operacja na saldzie musi być tutaj odnotowana. '
  'UPDATE i DELETE zablokowane przez RLS i trigger enforce_ledger_immutability.';

-- ---------------------------------------------------------------------------
-- 1.7 employee_vouchers — przypisanie pracowników do kont voucherowych
-- ON DELETE CASCADE: usunięcie użytkownika usuwa przypisanie
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employee_vouchers (
  employee_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voucher_account_id  UUID NOT NULL REFERENCES voucher_accounts(id) ON DELETE CASCADE,
  company_id          UUID REFERENCES companies(id) ON DELETE SET NULL,
  assigned_at         TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (employee_id, voucher_account_id)
);
COMMENT ON TABLE employee_vouchers IS 'Mapowanie pracownik ↔ konto voucherowe (przez firmę pracodawcę).';

-- ---------------------------------------------------------------------------
-- 1.8 commissions — prowizje ZAWSZE w PLN, nigdy w voucherach
-- ON DELETE RESTRICT: historia prowizji musi być zachowana
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commissions (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID          NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  agent_name        TEXT          NOT NULL,   -- snapshot (nazwa może się zmienić)
  agent_role        TEXT          NOT NULL CHECK (agent_role IN ('partner','menedzer','dyrektor')),
  commission_type   TEXT          NOT NULL CHECK (commission_type IN ('acquisition','recurring','renewal')),
  order_id          UUID          REFERENCES voucher_orders(id) ON DELETE RESTRICT,
  amount_pln        NUMERIC(10,2) NOT NULL CHECK (amount_pln > 0),
  rate              TEXT          NOT NULL,   -- np. "10%", "2%" — snapshot dla audytu
  quarter           TEXT,                     -- np. "2025-Q1"
  is_paid           BOOLEAN       NOT NULL DEFAULT FALSE,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   DEFAULT now()
);
COMMENT ON TABLE commissions IS 'Prowizje sprzedażowe. Zawsze w PLN — nigdy w voucherach. Append-only w praktyce.';

-- ---------------------------------------------------------------------------
-- 1.9 distribution_batches — protokoły zbiorczej dystrybucji voucherów
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS distribution_batches (
  id            TEXT          PRIMARY KEY,   -- format: PROTOCOL-YYYY-MM-DD-XXX
  company_id    UUID          NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  hr_user_id    UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  hr_name       TEXT          NOT NULL,      -- snapshot
  total_amount  INTEGER       NOT NULL CHECK (total_amount > 0),
  status        TEXT          NOT NULL DEFAULT 'completed' CHECK (status = 'completed'),
  order_id      UUID          REFERENCES voucher_orders(id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS distribution_batch_items (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id    TEXT    NOT NULL REFERENCES distribution_batches(id) ON DELETE CASCADE,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  user_name   TEXT    NOT NULL,    -- snapshot
  amount      INTEGER NOT NULL CHECK (amount > 0),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 1.10 buyback_agreements — umowy odkupu wygasłych voucherów
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS buyback_agreements (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID          NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  voucher_count     INTEGER       NOT NULL CHECK (voucher_count > 0),
  total_value_pln   NUMERIC(10,2) NOT NULL CHECK (total_value_pln > 0),
  status            TEXT          NOT NULL DEFAULT 'pending_approval'
                                  CHECK (status IN ('pending_approval','approved','paid')),
  -- JSON snapshot danych w momencie podpisania umowy (RODO: dane mogą być usunięte)
  snapshot          JSONB         NOT NULL,
  date_generated    TIMESTAMPTZ   DEFAULT now(),
  approved_at       TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   DEFAULT now()
);

-- Teraz możemy dodać FK z vouchers do buyback_agreements
ALTER TABLE vouchers
  ADD CONSTRAINT fk_vouchers_buyback
  FOREIGN KEY (buyback_agreement_id) REFERENCES buyback_agreements(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 1.11 support_tickets — helpdesk
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_tickets (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  subject             TEXT    NOT NULL,
  category            TEXT    NOT NULL CHECK (category IN ('TECHNICAL','FINANCIAL','VOUCHER','OTHER')),
  priority            TEXT    NOT NULL DEFAULT 'NORMAL'
                              CHECK (priority IN ('LOW','NORMAL','HIGH','CRITICAL')),
  status              TEXT    NOT NULL DEFAULT 'OPEN'
                              CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')),
  creator_id          UUID    NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  creator_name        TEXT    NOT NULL,    -- snapshot
  company_id          UUID    REFERENCES companies(id) ON DELETE SET NULL,
  related_entity_id   TEXT,
  related_entity_type TEXT    CHECK (related_entity_type IN ('ORDER','USER','BUYBACK','COMPANY','SYSTEM','TICKET')),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     UUID    NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  sender_name   TEXT    NOT NULL,    -- snapshot
  sender_role   TEXT    NOT NULL,
  message       TEXT    NOT NULL,
  is_internal   BOOLEAN DEFAULT FALSE,   -- notatka wewnętrzna admina
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 1.12 notifications — powiadomienia in-app
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message             TEXT    NOT NULL,
  type                TEXT    NOT NULL CHECK (type IN ('INFO','WARNING','SUCCESS','ERROR')),
  priority            TEXT    DEFAULT 'NORMAL' CHECK (priority IN ('CRITICAL','HIGH','NORMAL','LOW')),
  is_read             BOOLEAN DEFAULT FALSE,
  action_type         TEXT,
  action_target_id    TEXT,
  action_label        TEXT,
  target_entity_id    TEXT,
  target_entity_type  TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 1.13 services — katalog usług dostępnych dla pracowników
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS services (
  id          TEXT    PRIMARY KEY,    -- np. 'SRV-MENTAL-01'
  name        TEXT    NOT NULL,
  description TEXT    NOT NULL,
  price       INTEGER NOT NULL CHECK (price > 0),    -- w voucherach (= PLN)
  type        TEXT    NOT NULL CHECK (type IN ('SUBSCRIPTION','ONE_TIME')),
  icon        TEXT    NOT NULL DEFAULT 'star',
  image_url   TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 1.14 import_history — historia importów pracowników przez HR
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS import_history (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID    NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  hr_user_id        UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  hr_name           TEXT    NOT NULL,    -- snapshot
  total_processed   INTEGER NOT NULL DEFAULT 0,
  status            TEXT    NOT NULL DEFAULT 'SUCCESS'
                            CHECK (status IN ('SUCCESS','PARTIAL','ERROR')),
  report_data       JSONB,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 1.15 system_config — globalna konfiguracja platformy (jedna wiersz)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_config (
  id                              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  default_voucher_validity_days   INTEGER       NOT NULL DEFAULT 365,
  payment_terms_days              INTEGER       NOT NULL DEFAULT 14,
  platform_currency               TEXT          NOT NULL DEFAULT 'PLN',
  min_password_length             INTEGER       NOT NULL DEFAULT 8,
  session_timeout_minutes         INTEGER       NOT NULL DEFAULT 15,
  audit_log_retention_days        INTEGER       NOT NULL DEFAULT 365,
  pdf_auto_scaling                BOOLEAN       DEFAULT TRUE,
  updated_at                      TIMESTAMPTZ   DEFAULT now()
);
-- Seed: jeden wiersz konfiguracji
INSERT INTO system_config DEFAULT VALUES ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 1.16 audit_log — IMMUTABLE audit trail
-- Trigery dopisują tu automatycznie. Ręczny INSERT dozwolony tylko dla service role.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name    TEXT    NOT NULL,
  operation     TEXT    NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  row_id        TEXT    NOT NULL,
  changed_by    UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  old_data      JSONB,
  new_data      JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE audit_log IS 'Immutable audit trail. Wypełniany przez triggery — nie modyfikować ręcznie.';


-- =============================================================================
-- 2. INDEKSY WYDAJNOŚCIOWE
-- =============================================================================

-- user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_role    ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status  ON user_profiles(status);

-- companies
CREATE INDEX IF NOT EXISTS idx_companies_advisor  ON companies(advisor_id);
CREATE INDEX IF NOT EXISTS idx_companies_manager  ON companies(manager_id);
CREATE INDEX IF NOT EXISTS idx_companies_director ON companies(director_id);
CREATE INDEX IF NOT EXISTS idx_companies_nip      ON companies(nip);

-- voucher_accounts
CREATE INDEX IF NOT EXISTS idx_voucher_accounts_user ON voucher_accounts(user_id);

-- voucher_orders
CREATE INDEX IF NOT EXISTS idx_voucher_orders_company ON voucher_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_voucher_orders_status  ON voucher_orders(status);
CREATE INDEX IF NOT EXISTS idx_voucher_orders_created ON voucher_orders(created_at DESC);

-- vouchers
CREATE INDEX IF NOT EXISTS idx_vouchers_serial    ON vouchers(serial_number);
CREATE INDEX IF NOT EXISTS idx_vouchers_owner     ON vouchers(current_owner_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_status    ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_order     ON vouchers(order_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_company   ON vouchers(company_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_valid     ON vouchers(valid_until);

-- voucher_transactions (często filtrowane po userze i dacie)
CREATE INDEX IF NOT EXISTS idx_vtx_from_user  ON voucher_transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_vtx_to_user    ON voucher_transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_vtx_created    ON voucher_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vtx_type       ON voucher_transactions(type);
CREATE INDEX IF NOT EXISTS idx_vtx_order      ON voucher_transactions(order_id);

-- commissions
CREATE INDEX IF NOT EXISTS idx_commissions_agent   ON commissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_commissions_order   ON commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_commissions_quarter ON commissions(quarter);
CREATE INDEX IF NOT EXISTS idx_commissions_paid    ON commissions(is_paid);

-- distribution_batch_items
CREATE INDEX IF NOT EXISTS idx_dbi_batch    ON distribution_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_dbi_user     ON distribution_batch_items(user_id);

-- support_tickets
CREATE INDEX IF NOT EXISTS idx_tickets_creator ON support_tickets(creator_id);
CREATE INDEX IF NOT EXISTS idx_tickets_company ON support_tickets(company_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status  ON support_tickets(status);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE is_read = FALSE;

-- employee_vouchers
CREATE INDEX IF NOT EXISTS idx_ev_employee ON employee_vouchers(employee_id);
CREATE INDEX IF NOT EXISTS idx_ev_account  ON employee_vouchers(voucher_account_id);

-- audit_log
CREATE INDEX IF NOT EXISTS idx_audit_table    ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_row      ON audit_log(row_id);
CREATE INDEX IF NOT EXISTS idx_audit_changed  ON audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_created  ON audit_log(created_at DESC);


-- =============================================================================
-- 3. FUNKCJE DOMENOWE
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 3.1 generate_voucher_serial() — unikalny numer seryjny VCH-YYYYMMDD-XXXXXXXX
-- Alfabet: bez mylących znaków (0/O, 1/I/L) — tylko czytelne znaki
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_voucher_serial()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  serial  TEXT;
  prefix  TEXT := 'VCH-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-';
  chars   TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i       INTEGER;
BEGIN
  LOOP
    serial := prefix;
    FOR i IN 1..8 LOOP
      serial := serial || SUBSTR(chars, FLOOR(RANDOM() * LENGTH(chars) + 1)::INT, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM vouchers WHERE serial_number = serial);
  END LOOP;
  RETURN serial;
END;
$$;
COMMENT ON FUNCTION generate_voucher_serial IS
  'Generuje unikalny numer seryjny VCH-YYYYMMDD-XXXXXXXX. '
  'Jedyna dozwolona metoda tworzenia numerów seryjnych — nigdy ręcznie.';

-- ---------------------------------------------------------------------------
-- 3.2 mint_vouchers() — masowa emisja voucherów po opłaceniu zamówienia
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mint_vouchers(
  p_order_id      UUID,
  p_company_id    UUID,
  p_owner_id      UUID,
  p_quantity      INTEGER,
  p_valid_months  INTEGER DEFAULT 12
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  i             INTEGER;
  v_issuer_name TEXT;
  v_issuer_nip  TEXT;
BEGIN
  -- Pobierz dane emitenta z firmy (dla zgodności z MPV)
  SELECT name, nip INTO v_issuer_name, v_issuer_nip
  FROM companies WHERE id = p_company_id;

  FOR i IN 1..p_quantity LOOP
    INSERT INTO vouchers (
      serial_number,
      face_value_pln,
      order_id,
      company_id,
      current_owner_id,
      status,
      issuer_name,
      issuer_nip,
      valid_until,
      issued_at
    ) VALUES (
      generate_voucher_serial(),
      1.00,
      p_order_id,
      p_company_id,
      p_owner_id,
      'active',
      COALESCE(v_issuer_name, 'Platforma EBS'),
      COALESCE(v_issuer_nip, '0000000000'),
      (NOW() + (p_valid_months || ' months')::INTERVAL)::DATE,
      NOW()
    );
  END LOOP;

  -- Zasilenie konta voucherowego właściciela
  INSERT INTO voucher_accounts (user_id, balance)
  VALUES (p_owner_id, p_quantity)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = voucher_accounts.balance + p_quantity;

  -- Wpis do ledgera
  INSERT INTO voucher_transactions (from_user_id, to_user_id, amount, type, order_id)
  VALUES (NULL, p_owner_id, p_quantity, 'emisja', p_order_id);
END;
$$;
COMMENT ON FUNCTION mint_vouchers IS
  'Emituje vouchery po opłaceniu zamówienia. '
  'Aktualizuje saldo konta i zapisuje wpis do ledgera (typ: emisja).';

-- ---------------------------------------------------------------------------
-- 3.3 transfer_vouchers() — atomiczny transfer voucherów między użytkownikami
-- Zmniejsza saldo nadawcy i zwiększa saldo odbiorcy w jednej transakcji DB.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION transfer_vouchers(
  p_from_user_id  UUID,
  p_to_user_id    UUID,
  p_amount        INTEGER,
  p_type          TEXT,
  p_order_id      UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Sprawdź i zmniejsz saldo nadawcy
  UPDATE voucher_accounts
  SET balance = balance - p_amount
  WHERE user_id = p_from_user_id AND balance >= p_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Niewystarczające saldo voucherów (user_id: %)', p_from_user_id;
  END IF;

  -- Zwiększ saldo odbiorcy (upsert — konto może nie istnieć)
  INSERT INTO voucher_accounts (user_id, balance)
  VALUES (p_to_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = voucher_accounts.balance + p_amount;

  -- Zapisz w ledgerze — ZAWSZE
  INSERT INTO voucher_transactions (from_user_id, to_user_id, amount, type, order_id)
  VALUES (p_from_user_id, p_to_user_id, p_amount, p_type, p_order_id);
END;
$$;
COMMENT ON FUNCTION transfer_vouchers IS
  'Atomiczny transfer voucherów. Zmniejsza saldo nadawcy i zwiększa saldo odbiorcy. '
  'Rzuca wyjątek przy niewystarczającym saldzie. Zawsze tworzy wpis w ledgerze.';

-- ---------------------------------------------------------------------------
-- 3.4 redeem_voucher() — realizacja pojedynczego vouchera przez pracownika
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION redeem_voucher(
  p_serial_number   TEXT,
  p_user_id         UUID,
  p_service_id      TEXT DEFAULT NULL,
  p_service_name    TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_voucher_id UUID;
BEGIN
  -- Sprawdź i zablokuj voucher (FOR UPDATE zapobiega równoległym realizacjom)
  SELECT id INTO v_voucher_id
  FROM vouchers
  WHERE serial_number = p_serial_number
    AND current_owner_id = p_user_id
    AND status = 'active'
    AND valid_until >= CURRENT_DATE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voucher niedostępny lub nieważny (serial: %)', p_serial_number;
  END IF;

  -- Oznacz voucher jako wykorzystany
  UPDATE vouchers
  SET status = 'consumed',
      redeemed_at = NOW(),
      redeemed_by_user_id = p_user_id
  WHERE id = v_voucher_id;

  -- Zmniejsz saldo (transfer do NULL = system)
  UPDATE voucher_accounts
  SET balance = balance - 1
  WHERE user_id = p_user_id AND balance >= 1;

  -- Wpis w ledgerze
  INSERT INTO voucher_transactions (from_user_id, to_user_id, amount, type, service_id, service_name)
  VALUES (p_user_id, p_user_id, 1, 'wykorzystanie', p_service_id, p_service_name);

  RETURN v_voucher_id;
END;
$$;
COMMENT ON FUNCTION redeem_voucher IS
  'Realizacja vouchera. Sprawdza własność, ważność i status. '
  'Atomicznie: oznacza voucher consumed + zmniejsza saldo + zapisuje w ledgerze.';


-- =============================================================================
-- 4. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE user_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies             ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_vouchers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribution_batches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribution_batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyback_agreements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE services              ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_history        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log             ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- user_profiles
-- ---------------------------------------------------------------------------
CREATE POLICY "Własny profil — odczyt"    ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Własny profil — zapis"     ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Superadmin — pełny dostęp" ON user_profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'superadmin'));

-- ---------------------------------------------------------------------------
-- voucher_accounts
-- ---------------------------------------------------------------------------
CREATE POLICY "Własne konto voucherowe"   ON voucher_accounts FOR SELECT USING (auth.uid() = user_id);
-- BRAK polityki UPDATE — saldo tylko przez transfer_vouchers() jako SECURITY DEFINER

-- ---------------------------------------------------------------------------
-- voucher_transactions — APPEND-ONLY: brak UPDATE i DELETE
-- ---------------------------------------------------------------------------
CREATE POLICY "Własne transakcje — odczyt" ON voucher_transactions FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "Brak UPDATE na transakcjach" ON voucher_transactions FOR UPDATE USING (FALSE);
CREATE POLICY "Brak DELETE na transakcjach" ON voucher_transactions FOR DELETE USING (FALSE);

-- ---------------------------------------------------------------------------
-- vouchers
-- ---------------------------------------------------------------------------
CREATE POLICY "Własne vouchery — odczyt"  ON vouchers FOR SELECT USING (auth.uid() = current_owner_id);

-- ---------------------------------------------------------------------------
-- voucher_orders
-- ---------------------------------------------------------------------------
CREATE POLICY "Zamówienia firmy — HR"     ON voucher_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN companies c ON c.id = voucher_orders.company_id
      WHERE up.id = auth.uid() AND up.role = 'pracodawca'
        AND up.company_name = c.name   -- uproszczone; w docelowej wersji przez companies.id
    )
  );
CREATE POLICY "Superadmin — zamówienia"   ON voucher_orders FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'superadmin'));

-- ---------------------------------------------------------------------------
-- commissions — agenci widzą własne
-- ---------------------------------------------------------------------------
CREATE POLICY "Własne prowizje"           ON commissions FOR SELECT USING (auth.uid() = agent_id);
CREATE POLICY "Superadmin — prowizje"     ON commissions FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'superadmin'));

-- ---------------------------------------------------------------------------
-- notifications — własne powiadomienia
-- ---------------------------------------------------------------------------
CREATE POLICY "Własne powiadomienia"      ON notifications FOR ALL USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- support_tickets
-- ---------------------------------------------------------------------------
CREATE POLICY "Własne zgłoszenia"         ON support_tickets FOR SELECT USING (auth.uid() = creator_id);
CREATE POLICY "Superadmin — zgłoszenia"   ON support_tickets FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'superadmin'));

-- ---------------------------------------------------------------------------
-- ticket_messages
-- ---------------------------------------------------------------------------
CREATE POLICY "Wiadomości w własnych zgłoszeniach" ON ticket_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM support_tickets t WHERE t.id = ticket_messages.ticket_id AND t.creator_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- services — publiczny odczyt dla zalogowanych
-- ---------------------------------------------------------------------------
CREATE POLICY "Usługi — odczyt publiczny" ON services FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Superadmin — usługi"       ON services FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'superadmin'));

-- ---------------------------------------------------------------------------
-- audit_log — tylko superadmin
-- ---------------------------------------------------------------------------
CREATE POLICY "Superadmin — audit log"    ON audit_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'superadmin'));
CREATE POLICY "Brak UPDATE na audit log"  ON audit_log FOR UPDATE USING (FALSE);
CREATE POLICY "Brak DELETE na audit log"  ON audit_log FOR DELETE USING (FALSE);

-- ---------------------------------------------------------------------------
-- employee_vouchers
-- ---------------------------------------------------------------------------
CREATE POLICY "Własne przypisania"        ON employee_vouchers FOR SELECT USING (auth.uid() = employee_id);

-- ---------------------------------------------------------------------------
-- distribution_batches / items
-- ---------------------------------------------------------------------------
CREATE POLICY "Superadmin — batches"      ON distribution_batches FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('superadmin','pracodawca')));
CREATE POLICY "Superadmin — batch items"  ON distribution_batch_items FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('superadmin','pracodawca')));

-- ---------------------------------------------------------------------------
-- buyback_agreements
-- ---------------------------------------------------------------------------
CREATE POLICY "Własne umowy odkupu"       ON buyback_agreements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Superadmin — odkupy"       ON buyback_agreements FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'superadmin'));

-- ---------------------------------------------------------------------------
-- import_history
-- ---------------------------------------------------------------------------
CREATE POLICY "Superadmin — import"       ON import_history FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('superadmin','pracodawca')));


-- =============================================================================
-- 5. TRIGGERY
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 5.1 auto_create_voucher_account — tworzy konto voucherowe przy rejestracji
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_auto_create_voucher_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO voucher_accounts (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_auto_create_voucher_account
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_auto_create_voucher_account();

-- ---------------------------------------------------------------------------
-- 5.2 enforce_ledger_immutability — blokuje UPDATE/DELETE na ledgerze
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_enforce_ledger_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'NARUSZENIE ZASAD SYSTEMU: Tabela voucher_transactions jest immutable. '
    'UPDATE i DELETE są zabronione. Operacja: %, tabela: %',
    TG_OP, TG_TABLE_NAME;
END;
$$;

CREATE OR REPLACE TRIGGER trg_ledger_no_update
  BEFORE UPDATE ON voucher_transactions
  FOR EACH ROW EXECUTE FUNCTION fn_enforce_ledger_immutability();

CREATE OR REPLACE TRIGGER trg_ledger_no_delete
  BEFORE DELETE ON voucher_transactions
  FOR EACH ROW EXECUTE FUNCTION fn_enforce_ledger_immutability();

-- ---------------------------------------------------------------------------
-- 5.3 updated_at — automatyczna aktualizacja pola updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE OR REPLACE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE OR REPLACE TRIGGER trg_voucher_orders_updated_at
  BEFORE UPDATE ON voucher_orders
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE OR REPLACE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- 5.4 audit triggers — zapisują zmiany do audit_log
-- Attach do: voucher_accounts, voucher_orders, voucher_transactions, commissions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO audit_log (table_name, operation, row_id, changed_by, old_data, new_data)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    CASE TG_OP
      WHEN 'DELETE' THEN OLD.id::TEXT
      ELSE NEW.id::TEXT
    END,
    auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE TRIGGER trg_audit_voucher_accounts
  AFTER INSERT OR UPDATE ON voucher_accounts
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE OR REPLACE TRIGGER trg_audit_voucher_orders
  AFTER INSERT OR UPDATE OR DELETE ON voucher_orders
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE OR REPLACE TRIGGER trg_audit_voucher_transactions
  AFTER INSERT ON voucher_transactions    -- tylko INSERT — UPDATE/DELETE zablokowane
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE OR REPLACE TRIGGER trg_audit_commissions
  AFTER INSERT OR UPDATE ON commissions
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE OR REPLACE TRIGGER trg_audit_buyback_agreements
  AFTER INSERT OR UPDATE ON buyback_agreements
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();


-- =============================================================================
-- 6. WERYFIKACJA — sprawdź czy wszystko zostało poprawnie utworzone
-- =============================================================================
DO $$
DECLARE
  tbl TEXT;
  missing TEXT := '';
  tables TEXT[] := ARRAY[
    'user_profiles','companies','voucher_accounts','voucher_orders','vouchers',
    'voucher_transactions','employee_vouchers','commissions',
    'distribution_batches','distribution_batch_items','buyback_agreements',
    'support_tickets','ticket_messages','notifications','services',
    'import_history','system_config','audit_log'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      missing := missing || tbl || ', ';
    END IF;
  END LOOP;

  IF missing <> '' THEN
    RAISE WARNING 'BRAKUJĄCE TABELE: %', missing;
  ELSE
    RAISE NOTICE '✓ Wszystkie % tabele utworzone pomyślnie.', array_length(tables, 1);
  END IF;
END;
$$;

-- =============================================================================
-- KONIEC MIGRACJI 001
-- =============================================================================

-- =============================================================================
-- EBS — Czyszczenie danych testowych
-- Uruchom w: Supabase Dashboard → SQL Editor
-- Zachowuje: konta pracodawca/superadmin, firmy, całą strukturę bazy
-- Usuwa: pracownicy, zamówienia, vouchery, transakcje, prowizje
-- =============================================================================

-- TRUNCATE omija trigger FOR EACH ROW (trg_ledger_no_delete).
-- Kolejność: najpierw zależne tabele (FK-safe).

-- 1. Tabele pomocnicze zależne od transakcji i zamówień
TRUNCATE TABLE commissions            RESTART IDENTITY CASCADE;
TRUNCATE TABLE employee_purchases     RESTART IDENTITY CASCADE;
DELETE FROM employee_vouchers;

-- 2. Vouchery i konta
DELETE FROM vouchers;
DELETE FROM voucher_accounts;

-- 3. Ledger — TRUNCATE omija trigger immutability (FOR EACH ROW nie odpala dla TRUNCATE)
TRUNCATE TABLE voucher_transactions   RESTART IDENTITY CASCADE;

-- 4. Zamówienia (teraz bez FK od voucher_transactions)
DELETE FROM voucher_orders;

-- 5. Usuń pracowników z user_profiles
--    (auth.users usuniemy osobno przez skrypt — teraz FK jest wolne)
DELETE FROM user_profiles WHERE role = 'pracownik';

-- =============================================================================
-- WERYFIKACJA
-- =============================================================================
SELECT
  (SELECT COUNT(*) FROM user_profiles)         AS profiles_total,
  (SELECT COUNT(*) FROM user_profiles WHERE role = 'pracownik') AS pracownicy,
  (SELECT COUNT(*) FROM voucher_orders)         AS zamowienia,
  (SELECT COUNT(*) FROM vouchers)               AS vouchery,
  (SELECT COUNT(*) FROM voucher_accounts)       AS konta,
  (SELECT COUNT(*) FROM voucher_transactions)   AS transakcje;

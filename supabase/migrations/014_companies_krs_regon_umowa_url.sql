-- =============================================================================
-- Migracja 014: Dodaj krs + regon do companies; dodaj umowa_pdf_url do orders
-- =============================================================================

-- 1. Pola rejestrowe firmy (potrzebne do Umowy Zlecenia Nabycia Voucherów)
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS krs   TEXT,
  ADD COLUMN IF NOT EXISTS regon TEXT;

-- 2. URL do wygenerowanego PDF Umowy Zlecenia Nabycia Voucherów
ALTER TABLE voucher_orders
  ADD COLUMN IF NOT EXISTS umowa_pdf_url TEXT;

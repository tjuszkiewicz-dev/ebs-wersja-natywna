-- =============================================================================
-- Migracja 013: Rozszerzenie financial_documents o pdf_url + storage bucket
-- =============================================================================

-- 1. Dodaj pdf_url do financial_documents
ALTER TABLE financial_documents
  ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- 2. Dodaj payment_due_date (termin płatności - opcjonalny)
ALTER TABLE financial_documents
  ADD COLUMN IF NOT EXISTS payment_due_date DATE;

-- 3. Utwórz bucket Supabase Storage na PDFy dokumentów księgowych
--    (wykonaj raz; jeśli bucket istnieje - ignoruj)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'financial-documents',
  'financial-documents',
  FALSE,          -- prywatny bucket (wymagany token do pobrania)
  10485760,       -- 10 MB max per file
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- 4. RLS: pracodawca widzi tylko dokumenty swojej firmy
-- (policy do Supabase Storage — do dodania w Supabase Dashboard jeśli potrzebne)

-- 5. Indeks na status (do szybkiego zliczania unpaid dla badge)
CREATE INDEX IF NOT EXISTS idx_financial_docs_status
  ON financial_documents(company_id, status);

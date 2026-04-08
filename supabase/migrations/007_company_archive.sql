-- =============================================================================
-- EBS — Migracja 007: Archiwum firm
-- Dodaje kolumnę archived_at do tabeli companies.
-- NULL = firma aktywna, data = firma zarchiwizowana.
-- Wklej do Supabase Studio → SQL Editor i wykonaj.
-- =============================================================================

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN companies.archived_at IS
  'NULL = firma aktywna. Jeśli ustawione — firma jest w archiwum (soft delete). '
  'Ustawiane przez PATCH /api/companies/[id] { action: "archive" }.';

-- Indeks do szybkiego filtrowania aktywnych/zarchiwizowanych firm
CREATE INDEX IF NOT EXISTS idx_companies_archived_at ON companies(archived_at);

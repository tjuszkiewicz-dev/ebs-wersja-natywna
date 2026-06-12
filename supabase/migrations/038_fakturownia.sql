-- Migracja 038: Integracja Fakturownia — kolumny pomocnicze.
-- (037 zajęte przez per_company_employee_records — patrz fix_migration_conflict.)
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS fakturownia_client_id INTEGER;

ALTER TABLE financial_documents
  ADD COLUMN IF NOT EXISTS fakturownia_invoice_id  INTEGER,
  ADD COLUMN IF NOT EXISTS fakturownia_token       TEXT,
  ADD COLUMN IF NOT EXISTS payment_url             TEXT,
  ADD COLUMN IF NOT EXISTS fakturownia_sync_status TEXT
      CHECK (fakturownia_sync_status IN ('pending','synced','failed'));

CREATE INDEX IF NOT EXISTS idx_findocs_fakturownia
  ON financial_documents(fakturownia_invoice_id);

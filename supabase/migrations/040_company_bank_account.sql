-- SP1: dedykowany rachunek firmy drukowany na nocie księgowej (subkonto Millennium per pracodawca).
-- Puste = nota drukuje fallback ISSUER.bank (konto główne Stratton).
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS bank_account      TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_desc TEXT;

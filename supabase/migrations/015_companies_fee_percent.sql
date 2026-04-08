-- Migration 015: Add fee_percent to companies
-- Per-company configurable service fee (15–31%), default 20%

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS fee_percent NUMERIC(5,2) NOT NULL DEFAULT 20.00
    CONSTRAINT companies_fee_percent_range CHECK (fee_percent >= 15 AND fee_percent <= 31);

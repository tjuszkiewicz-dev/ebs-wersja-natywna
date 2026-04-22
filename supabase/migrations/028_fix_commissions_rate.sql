-- =============================================================================
-- Migracja 028: commissions.rate z TEXT na NUMERIC
-- =============================================================================
-- M3: rate jako "10%" TEXT uniemożliwia SUM/AVG w raportach.
-- Konwertujemy do NUMERIC(5,2) — wartość procentowa (10 = 10%, nie 0.10).
-- Backfill: strip znaku '%' i ewentualnych spacji.
-- =============================================================================

DO $$
DECLARE
  v_type TEXT;
BEGIN
  SELECT data_type INTO v_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'commissions' AND column_name = 'rate';

  IF v_type = 'text' THEN
    ALTER TABLE commissions
      ALTER COLUMN rate TYPE NUMERIC(5,2)
      USING NULLIF(REGEXP_REPLACE(rate, '[^0-9.,]', '', 'g'), '')::NUMERIC;

    ALTER TABLE commissions
      ADD CONSTRAINT commissions_rate_range CHECK (rate >= 0 AND rate <= 100);
  END IF;
END $$;

COMMENT ON COLUMN commissions.rate IS
  'Stawka prowizji jako liczba procentowa: 10 = 10%. Snapshot dla audytu.';

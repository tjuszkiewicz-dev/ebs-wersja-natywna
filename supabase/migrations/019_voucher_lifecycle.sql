-- Migration 019: Proper voucher individual-record lifecycle
-- ─────────────────────────────────────────────────────────────────────────────
-- Problem: transfer_vouchers() only moves balance accounting; individual voucher
-- records stay assigned to the HR user (current_owner_id) with status='active'.
-- Consequence: per-employee expired-voucher counts can't be derived from records.
--
-- This migration:
--   1. Changes vouchers.valid_until from DATE to TIMESTAMPTZ (hour:minute precision)
--   2. Adds compute_voucher_valid_until() — next occurrence of company expiry date
--   3. Rewrites mint_vouchers() to use company's expiry settings
--   4. Adds distribute_to_employee() — moves physical records to employee + accounting
--   5. Adds expire_overdue_vouchers() — marks distributed vouchers past valid_until
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Change valid_until to TIMESTAMPTZ for hour:minute precision
ALTER TABLE vouchers
  ALTER COLUMN valid_until TYPE TIMESTAMPTZ
  USING valid_until::TIMESTAMPTZ;

COMMENT ON COLUMN vouchers.valid_until IS
  'Dokładna data/czas wygaśnięcia vouchera (TIMESTAMPTZ). '
  'Ustawiana przy emisji i dystrybucji na podstawie voucher_expiry_day/hour/minute firmy.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. compute_voucher_valid_until() — next occurrence of company expiry setting
-- Returns the next future occurrence of (day, hour, minute) in the monthly cycle.
-- If the configured day has already passed this month, returns next month's date.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION compute_voucher_valid_until(
  p_expiry_day    INTEGER,   -- 1–31
  p_expiry_hour   INTEGER DEFAULT 0,
  p_expiry_minute INTEGER DEFAULT 5
) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
AS $$
DECLARE
  v_now_waw   TIMESTAMP  := NOW() AT TIME ZONE 'Europe/Warsaw';
  v_now       TIMESTAMPTZ := NOW();
  v_day_this  INTEGER;
  v_day_next  INTEGER;
  v_target    TIMESTAMPTZ;
BEGIN
  -- Clamp day to last day of current month (in Warsaw local time)
  v_day_this := LEAST(
    p_expiry_day,
    EXTRACT(day FROM (DATE_TRUNC('month', v_now_waw) + INTERVAL '1 month' - INTERVAL '1 day'))::INTEGER
  );

  -- Build target as Warsaw local time, then convert to TIMESTAMPTZ
  -- p_expiry_hour / p_expiry_minute are interpreted as Europe/Warsaw local hours
  v_target := (
    DATE_TRUNC('month', v_now_waw)
    + make_interval(days => v_day_this - 1)
    + make_interval(hours => p_expiry_hour, mins => p_expiry_minute)
  ) AT TIME ZONE 'Europe/Warsaw';

  -- If that moment is in the past, move to next month
  IF v_target <= v_now THEN
    v_day_next := LEAST(
      p_expiry_day,
      EXTRACT(day FROM (DATE_TRUNC('month', v_now_waw + INTERVAL '1 month') + INTERVAL '1 month' - INTERVAL '1 day'))::INTEGER
    );
    v_target := (
      DATE_TRUNC('month', v_now_waw + INTERVAL '1 month')
      + make_interval(days => v_day_next - 1)
      + make_interval(hours => p_expiry_hour, mins => p_expiry_minute)
    ) AT TIME ZONE 'Europe/Warsaw';
  END IF;

  RETURN v_target;
END;
$$;
COMMENT ON FUNCTION compute_voucher_valid_until IS
  'Zwraca następne wystąpienie skonfigurowanego dnia/godziny/minuty wygaśnięcia. '
  'Godzina i minuta są interpretowane jako czas lokalny Europe/Warsaw (nie UTC). '
  'Jeśli termin w bieżącym miesiącu już minął, zwraca odpowiadający dzień następnego miesiąca.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Rewrite mint_vouchers() — use company expiry settings for valid_until
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mint_vouchers(
  p_order_id      UUID,
  p_company_id    UUID,
  p_owner_id      UUID,
  p_quantity      INTEGER,
  p_valid_months  INTEGER DEFAULT 12   -- fallback when company has no expiry_day set
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  i              INTEGER;
  v_issuer_name  TEXT;
  v_issuer_nip   TEXT;
  v_expiry_day   INTEGER;
  v_expiry_hour  INTEGER;
  v_expiry_min   INTEGER;
  v_valid_until  TIMESTAMPTZ;
BEGIN
  -- Fetch company metadata + expiry settings
  SELECT name, nip, voucher_expiry_day, voucher_expiry_hour, voucher_expiry_minute
  INTO v_issuer_name, v_issuer_nip, v_expiry_day, v_expiry_hour, v_expiry_min
  FROM companies WHERE id = p_company_id;

  -- Compute valid_until: use company schedule if configured, else fallback months
  IF v_expiry_day IS NOT NULL THEN
    v_valid_until := compute_voucher_valid_until(
      v_expiry_day,
      COALESCE(v_expiry_hour, 0),
      COALESCE(v_expiry_min,  5)
    );
  ELSE
    v_valid_until := NOW() + (p_valid_months || ' months')::INTERVAL;
  END IF;

  FOR i IN 1..p_quantity LOOP
    INSERT INTO vouchers (
      serial_number, face_value_pln, order_id, company_id,
      current_owner_id, status, issuer_name, issuer_nip,
      valid_until, issued_at
    ) VALUES (
      generate_voucher_serial(),
      1.00,
      p_order_id,
      p_company_id,
      p_owner_id,
      'active',
      COALESCE(v_issuer_name, 'Platforma EBS'),
      COALESCE(v_issuer_nip, '0000000000'),
      v_valid_until,
      NOW()
    );
  END LOOP;

  -- Credit company/HR balance
  INSERT INTO voucher_accounts (user_id, balance)
  VALUES (p_owner_id, p_quantity)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = voucher_accounts.balance + p_quantity;

  -- Immutable ledger entry
  INSERT INTO voucher_transactions (from_user_id, to_user_id, amount, type, order_id)
  VALUES (NULL, p_owner_id, p_quantity, 'emisja', p_order_id);
END;
$$;
COMMENT ON FUNCTION mint_vouchers IS
  'Emituje vouchery. valid_until obliczane z ustawień firmy (voucher_expiry_day/hour/minute) '
  'lub jako fallback: NOW() + p_valid_months miesięcy.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. distribute_to_employee() — moves physical voucher records to employee
-- Selects N active vouchers from HR/company pool, assigns them to employee,
-- sets status='distributed' and valid_until from company expiry settings,
-- and handles balance accounting atomically.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION distribute_to_employee(
  p_company_id    UUID,
  p_from_user_id  UUID,   -- HR user (current owner of vouchers)
  p_to_user_id    UUID,   -- Employee
  p_amount        INTEGER,
  p_order_id      UUID DEFAULT NULL
)
RETURNS INTEGER   -- actual count of vouchers moved
LANGUAGE plpgsql
AS $$
DECLARE
  v_expiry_day    INTEGER;
  v_expiry_hour   INTEGER;
  v_expiry_minute INTEGER;
  v_valid_until   TIMESTAMPTZ;
  v_distributed   INTEGER := 0;
BEGIN
  -- Fetch company expiry settings
  SELECT voucher_expiry_day, voucher_expiry_hour, voucher_expiry_minute
  INTO v_expiry_day, v_expiry_hour, v_expiry_minute
  FROM companies WHERE id = p_company_id;

  -- Compute expiry for this distribution
  IF v_expiry_day IS NOT NULL THEN
    v_valid_until := compute_voucher_valid_until(
      v_expiry_day,
      COALESCE(v_expiry_hour, 0),
      COALESCE(v_expiry_minute, 5)
    );
  ELSE
    v_valid_until := NOW() + INTERVAL '1 month';
  END IF;

  -- Move physical voucher records: HR → employee
  WITH moved AS (
    UPDATE vouchers
    SET current_owner_id = p_to_user_id,
        status           = 'distributed',
        valid_until      = v_valid_until
    WHERE id IN (
      SELECT id FROM vouchers
      WHERE company_id       = p_company_id
        AND current_owner_id = p_from_user_id
        AND status           IN ('active', 'created')
      ORDER BY issued_at ASC
      LIMIT p_amount
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_distributed FROM moved;

  -- Balance accounting (debit HR, credit employee)
  IF v_distributed > 0 THEN
    UPDATE voucher_accounts
    SET balance = balance - v_distributed
    WHERE user_id = p_from_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Niewystarczające saldo voucherów (user_id: %)', p_from_user_id;
    END IF;

    INSERT INTO voucher_accounts (user_id, balance)
    VALUES (p_to_user_id, v_distributed)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = voucher_accounts.balance + v_distributed;

    -- Immutable ledger entry
    INSERT INTO voucher_transactions (from_user_id, to_user_id, amount, type, order_id)
    VALUES (p_from_user_id, p_to_user_id, v_distributed, 'przekazanie', p_order_id);
  END IF;

  RETURN v_distributed;
END;
$$;
COMMENT ON FUNCTION distribute_to_employee IS
  'Przesuwa fizyczne rekordy voucherów z HR do pracownika. '
  'Ustawia status=distributed i valid_until z harmonogramu firmy. '
  'Atomicznie aktualizuje salda i zapisuje ledger.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. expire_overdue_vouchers() — mark distributed/active vouchers past their valid_until
-- Called by API on page load or on demand. Safe to call repeatedly.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION expire_overdue_vouchers(
  p_company_id UUID DEFAULT NULL   -- NULL = all companies
)
RETURNS INTEGER   -- count of vouchers just expired
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE vouchers
  SET status = 'expired'
  WHERE status    IN ('distributed', 'active')
    AND valid_until < NOW()
    AND (p_company_id IS NULL OR company_id = p_company_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
COMMENT ON FUNCTION expire_overdue_vouchers IS
  'Oznacza status=expired dla wszystkich voucherów (active i distributed) po terminie. '
  'Bezpieczna do wielokrotnego wywoływania (idempotentna).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Retroactive fix for existing data
-- Existing vouchers still on HR user with status='active': if the company has
-- passed its expiry deadline, also mark employees' balances through the pattern
-- (handled by expire_overdue_vouchers and distribute via balance, not records).
-- Note: retroactive per-employee mapping is not possible without original records.
-- ─────────────────────────────────────────────────────────────────────────────
-- (No data migration needed — the frontend uses employee.voucherBalance as fallback
--  when company deadline has passed and no per-employee records exist.)

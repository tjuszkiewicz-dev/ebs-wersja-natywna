-- Migration 020: Fix voucher valid_until timing bug + auto-expire cron support
-- ─────────────────────────────────────────────────────────────────────────────
-- Problem (root cause):
--   distribute_to_employee() calls compute_voucher_valid_until() at PAYMENT time.
--   If payment occurs after the configured expiry moment (e.g., paid on Apr 22
--   for an order confirmed on Apr 21 before 23:50), compute_voucher_valid_until()
--   correctly sees Apr 21 as past and returns May 21 — WRONG month.
--
-- Fix:
--   1. Add voucher_valid_until TIMESTAMPTZ to voucher_orders — stored at hr-confirm time.
--   2. Add optional p_valid_until param to mint_vouchers + distribute_to_employee.
--      When p_valid_until IS NOT NULL, skip compute_voucher_valid_until() entirely.
--   3. Add expire_vouchers_and_create_buybacks() — called by Vercel Cron daily.
--      Expires overdue vouchers and auto-creates buyback_agreements per employee.
-- ─────────────────────────────────────────────────────────────────────────────

-- 0. Drop old function signatures (different arity → ambiguous overloads)
DROP FUNCTION IF EXISTS mint_vouchers(UUID, UUID, UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS distribute_to_employee(UUID, UUID, UUID, INTEGER, UUID);

-- 1. Store intended valid_until in the order at hr-confirm time
ALTER TABLE voucher_orders
  ADD COLUMN IF NOT EXISTS voucher_valid_until TIMESTAMPTZ;

COMMENT ON COLUMN voucher_orders.voucher_valid_until IS
  'Data/czas wygaśnięcia voucherów obliczona przy potwierdzeniu zamówienia (hr-confirm). '
  'Przekazywana do mint_vouchers i distribute_to_employee, żeby uniknąć obliczania w chwili płatności.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2a. Patch mint_vouchers — accept optional p_valid_until
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mint_vouchers(
  p_order_id      UUID,
  p_company_id    UUID,
  p_owner_id      UUID,
  p_quantity      INTEGER,
  p_valid_months  INTEGER      DEFAULT 12,
  p_valid_until   TIMESTAMPTZ  DEFAULT NULL   -- NEW: if provided, skip compute
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
  SELECT name, nip, voucher_expiry_day, voucher_expiry_hour, voucher_expiry_minute
  INTO v_issuer_name, v_issuer_nip, v_expiry_day, v_expiry_hour, v_expiry_min
  FROM companies WHERE id = p_company_id;

  -- Use provided valid_until if given; otherwise compute from company settings
  IF p_valid_until IS NOT NULL THEN
    v_valid_until := p_valid_until;
  ELSIF v_expiry_day IS NOT NULL THEN
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

  INSERT INTO voucher_accounts (user_id, balance)
  VALUES (p_owner_id, p_quantity)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = voucher_accounts.balance + p_quantity;

  INSERT INTO voucher_transactions (from_user_id, to_user_id, amount, type, order_id)
  VALUES (NULL, p_owner_id, p_quantity, 'emisja', p_order_id);
END;
$$;
COMMENT ON FUNCTION mint_vouchers IS
  'Emituje vouchery. valid_until: (1) p_valid_until jeśli podane, '
  '(2) compute_voucher_valid_until z ustawień firmy, (3) fallback: NOW()+p_valid_months.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2b. Patch distribute_to_employee — accept optional p_valid_until
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION distribute_to_employee(
  p_company_id    UUID,
  p_from_user_id  UUID,
  p_to_user_id    UUID,
  p_amount        INTEGER,
  p_order_id      UUID         DEFAULT NULL,
  p_valid_until   TIMESTAMPTZ  DEFAULT NULL   -- NEW: if provided, skip compute
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_expiry_day    INTEGER;
  v_expiry_hour   INTEGER;
  v_expiry_minute INTEGER;
  v_valid_until   TIMESTAMPTZ;
  v_distributed   INTEGER := 0;
BEGIN
  IF p_valid_until IS NOT NULL THEN
    v_valid_until := p_valid_until;
  ELSE
    SELECT voucher_expiry_day, voucher_expiry_hour, voucher_expiry_minute
    INTO v_expiry_day, v_expiry_hour, v_expiry_minute
    FROM companies WHERE id = p_company_id;

    IF v_expiry_day IS NOT NULL THEN
      v_valid_until := compute_voucher_valid_until(
        v_expiry_day,
        COALESCE(v_expiry_hour, 0),
        COALESCE(v_expiry_minute, 5)
      );
    ELSE
      v_valid_until := NOW() + INTERVAL '1 month';
    END IF;
  END IF;

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

    INSERT INTO voucher_transactions (from_user_id, to_user_id, amount, type, order_id)
    VALUES (p_from_user_id, p_to_user_id, v_distributed, 'przekazanie', p_order_id);
  END IF;

  RETURN v_distributed;
END;
$$;
COMMENT ON FUNCTION distribute_to_employee IS
  'Przesuwa fizyczne rekordy voucherów z HR do pracownika. '
  'valid_until: (1) p_valid_until jeśli podane (naprawia błąd pomiaru czasu), '
  '(2) compute_voucher_valid_until z harmonogramu firmy, (3) NOW()+1 miesiąc.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. expire_vouchers_and_create_buybacks() — called by Vercel Cron
--    Steps:
--      a) expire_overdue_vouchers() — marks expired
--      b) For each employee with newly expired vouchers:
--         - create buyback_agreement row
--         - debit employee's voucher_accounts balance
--         - credit company balance
--         - write ledger entry
--      c) Returns count of expired vouchers
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION expire_vouchers_and_create_buybacks(
  p_company_id UUID DEFAULT NULL
)
RETURNS TABLE(expired_count INTEGER, buyback_count INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_expired       INTEGER;
  v_buybacks      INTEGER := 0;
  r_emp           RECORD;
  v_ba_id         UUID;
  v_emp_count     INTEGER;
BEGIN
  -- Step 1: mark overdue vouchers as expired
  UPDATE vouchers
  SET status = 'expired'
  WHERE status    IN ('distributed', 'active')
    AND valid_until < NOW()
    AND (p_company_id IS NULL OR company_id = p_company_id);

  GET DIAGNOSTICS v_expired = ROW_COUNT;

  -- Step 2: for each employee who now has expired vouchers without a buyback, create one
  FOR r_emp IN
    SELECT
      v.current_owner_id AS user_id,
      v.company_id,
      COUNT(*)           AS voucher_count,
      SUM(v.face_value_pln) AS total_face_value,
      MAX(v.valid_until)    AS expired_at
    FROM vouchers v
    WHERE v.status = 'expired'
      AND (p_company_id IS NULL OR v.company_id = p_company_id)
      AND v.buyback_agreement_id IS NULL
      AND v.current_owner_id IS NOT NULL
      -- only real employees (not HR/company accounts)
      AND EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = v.current_owner_id
          AND up.role = 'pracownik'
      )
    GROUP BY v.current_owner_id, v.company_id
  LOOP
    -- Create buyback agreement
    v_ba_id := gen_random_uuid();
    INSERT INTO buyback_agreements (
      id, user_id, company_id, voucher_count, total_face_value,
      status, created_at, expired_at
    ) VALUES (
      v_ba_id,
      r_emp.user_id,
      r_emp.company_id,
      r_emp.voucher_count,
      r_emp.total_face_value,
      'pending',
      NOW(),
      r_emp.expired_at
    )
    ON CONFLICT DO NOTHING;

    -- Link vouchers to buyback agreement
    UPDATE vouchers
    SET buyback_agreement_id = v_ba_id
    WHERE status = 'expired'
      AND current_owner_id = r_emp.user_id
      AND company_id       = r_emp.company_id
      AND buyback_agreement_id IS NULL;

    GET DIAGNOSTICS v_emp_count = ROW_COUNT;
    IF v_emp_count > 0 THEN
      v_buybacks := v_buybacks + 1;

      -- Debit employee balance (vouchers returned)
      UPDATE voucher_accounts
      SET balance = GREATEST(0, balance - r_emp.voucher_count)
      WHERE user_id = r_emp.user_id;

      -- Ledger: return to company
      INSERT INTO voucher_transactions (from_user_id, to_user_id, amount, type, order_id)
      VALUES (r_emp.user_id, NULL, r_emp.voucher_count, 'odkup', NULL);

      -- In-app notification for employee
      INSERT INTO notifications (user_id, message, type)
      VALUES (
        r_emp.user_id,
        'Twoje vouchery wygasły i zostały przekazane do rozliczenia. Sprawdź zakładkę "Anulowanie subskrypcji".',
        'WARNING'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_expired, v_buybacks;
END;
$$;
COMMENT ON FUNCTION expire_vouchers_and_create_buybacks IS
  'Wygasza overdue vouchery i automatycznie tworzy buyback_agreements per pracownik. '
  'Wywoływana przez Vercel Cron codziennie ok. 01:00 CET.';

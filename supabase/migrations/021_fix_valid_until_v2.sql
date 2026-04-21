-- Migration 021: Fix voucher valid_until timing bug (v2 — clean overload fix)
-- Usuwa stare sygnatury funkcji przed ponownym CREATE OR REPLACE.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Usuń wszystkie istniejące sygnatury mint_vouchers i distribute_to_employee
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS mint_vouchers(UUID, UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS mint_vouchers(UUID, UUID, UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS mint_vouchers(UUID, UUID, UUID, INTEGER, INTEGER, TIMESTAMPTZ);

DROP FUNCTION IF EXISTS distribute_to_employee(UUID, UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS distribute_to_employee(UUID, UUID, UUID, INTEGER, UUID);
DROP FUNCTION IF EXISTS distribute_to_employee(UUID, UUID, UUID, INTEGER, UUID, TIMESTAMPTZ);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Kolumna voucher_valid_until w zamówieniach (idempotentna)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE voucher_orders
  ADD COLUMN IF NOT EXISTS voucher_valid_until TIMESTAMPTZ;

COMMENT ON COLUMN voucher_orders.voucher_valid_until IS
  'Data/czas wygaśnięcia obliczona przy hr-confirm (nie przy płatności). '
  'Przekazywana do mint_vouchers i distribute_to_employee.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2a. mint_vouchers — z opcjonalnym p_valid_until
-- ─────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION mint_vouchers(
  p_order_id      UUID,
  p_company_id    UUID,
  p_owner_id      UUID,
  p_quantity      INTEGER,
  p_valid_months  INTEGER      DEFAULT 12,
  p_valid_until   TIMESTAMPTZ  DEFAULT NULL
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 2b. distribute_to_employee — z opcjonalnym p_valid_until
-- ─────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION distribute_to_employee(
  p_company_id    UUID,
  p_from_user_id  UUID,
  p_to_user_id    UUID,
  p_amount        INTEGER,
  p_order_id      UUID         DEFAULT NULL,
  p_valid_until   TIMESTAMPTZ  DEFAULT NULL
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. expire_vouchers_and_create_buybacks — dla Vercel Cron
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION expire_vouchers_and_create_buybacks(
  p_company_id UUID DEFAULT NULL
)
RETURNS TABLE(expired_count INTEGER, buyback_count INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_expired   INTEGER;
  v_buybacks  INTEGER := 0;
  r_emp       RECORD;
  v_ba_id     UUID;
  v_linked    INTEGER;
BEGIN
  -- Krok 1: oznacz overdue vouchery jako wygasłe
  UPDATE vouchers
  SET status = 'expired'
  WHERE status      IN ('distributed', 'active')
    AND valid_until  < NOW()
    AND (p_company_id IS NULL OR company_id = p_company_id);

  GET DIAGNOSTICS v_expired = ROW_COUNT;

  -- Krok 2: dla każdego pracownika z wygasłymi voucherami bez buybacku → utwórz umowę odkupu
  FOR r_emp IN
    SELECT
      v.current_owner_id        AS user_id,
      v.company_id,
      COUNT(*)::INTEGER         AS voucher_count,
      SUM(v.face_value_pln)     AS total_face_value,
      MAX(v.valid_until)        AS expired_at
    FROM vouchers v
    WHERE v.status = 'expired'
      AND (p_company_id IS NULL OR v.company_id = p_company_id)
      AND v.buyback_agreement_id IS NULL
      AND v.current_owner_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id   = v.current_owner_id
          AND up.role = 'pracownik'
      )
    GROUP BY v.current_owner_id, v.company_id
  LOOP
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

    UPDATE vouchers
    SET buyback_agreement_id = v_ba_id
    WHERE status = 'expired'
      AND current_owner_id     = r_emp.user_id
      AND company_id           = r_emp.company_id
      AND buyback_agreement_id IS NULL;

    GET DIAGNOSTICS v_linked = ROW_COUNT;

    IF v_linked > 0 THEN
      v_buybacks := v_buybacks + 1;

      UPDATE voucher_accounts
      SET balance = GREATEST(0, balance - r_emp.voucher_count)
      WHERE user_id = r_emp.user_id;

      INSERT INTO voucher_transactions (from_user_id, to_user_id, amount, type, order_id)
      VALUES (r_emp.user_id, NULL, r_emp.voucher_count, 'odkup', NULL);

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

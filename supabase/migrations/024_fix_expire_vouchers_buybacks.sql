-- =============================================================================
-- Migracja 024: Naprawa expire_vouchers_and_create_buybacks
-- =============================================================================
-- Problem (K2 z audytu):
--   Funkcja w 021_fix_valid_until_v2.sql:219-231 INSERT-uje do buyback_agreements
--   kolumny których tabela nie ma (`total_face_value`, `company_id`, `expired_at`)
--   oraz używa `status = 'pending'`, podczas gdy CHECK wymusza
--   ('pending_approval','approved','paid').
--   Każde uruchomienie cronu rzuca wyjątkiem.
--
-- Rozwiązanie: odtworzyć funkcję z poprawnymi kolumnami z 001 (total_value_pln,
-- snapshot, status 'pending_approval'). Wersja funkcji z 020_* była poprawna —
-- tu ją przywracamy z zachowaniem p_company_id (z 021_v2).
-- =============================================================================

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
  v_hr_id     UUID;
BEGIN
  UPDATE vouchers
  SET status = 'expired'
  WHERE status      IN ('distributed', 'active')
    AND valid_until  < NOW()
    AND (p_company_id IS NULL OR company_id = p_company_id);

  GET DIAGNOSTICS v_expired = ROW_COUNT;

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
      id, user_id, voucher_count, total_value_pln, status, snapshot, created_at
    ) VALUES (
      v_ba_id,
      r_emp.user_id,
      r_emp.voucher_count,
      r_emp.total_face_value,
      'pending_approval',
      jsonb_build_object(
        'company_id', r_emp.company_id,
        'expired_at', r_emp.expired_at
      ),
      NOW()
    );

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

      SELECT id INTO v_hr_id
      FROM user_profiles
      WHERE company_id = r_emp.company_id AND role = 'pracodawca'
      LIMIT 1;

      INSERT INTO voucher_transactions (from_user_id, to_user_id, amount, type, order_id)
      VALUES (
        r_emp.user_id,
        COALESCE(v_hr_id, r_emp.user_id),
        r_emp.voucher_count,
        'odkup',
        NULL
      );

      INSERT INTO notifications (user_id, message, type)
      VALUES (
        r_emp.user_id::TEXT,
        'Twoje vouchery wygasły i zostały przekazane do rozliczenia. Sprawdź zakładkę "Anulowanie subskrypcji".',
        'WARNING'
      );
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_expired, v_buybacks;
END;
$$;

COMMENT ON FUNCTION expire_vouchers_and_create_buybacks IS
  'Wygasza overdue vouchery i tworzy buyback_agreements per pracownik. '
  'Poprawka 024: używa oryginalnych kolumn (total_value_pln, snapshot, '
  'status=''pending_approval'') zgodnie z migracją 001. Wywoływana z Vercel Cron.';

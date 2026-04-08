-- =============================================================================
-- 011 — Funkcja dev_cleanup_all() do resetowania danych testowych
-- Uruchom RAZ w Supabase Dashboard → SQL Editor.
-- Po instalacji skrypt cleanup-test-data.mjs działa w pełni automatycznie.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.dev_cleanup_all()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  employee_ids UUID[];
  uid UUID;
BEGIN
  -- 1. Pomocnicze tabele (WHERE true omija bezpiecznik Supabase)
  DELETE FROM employee_purchases  WHERE true;
  DELETE FROM employee_vouchers   WHERE true;
  DELETE FROM commissions         WHERE true;
  DELETE FROM distribution_batches WHERE true;

  -- 2. Vouchery i konta
  DELETE FROM vouchers            WHERE true;
  DELETE FROM voucher_accounts    WHERE true;

  -- 3. Ledger — TRUNCATE omija trigger FOR EACH ROW (trg_ledger_no_delete)
  TRUNCATE TABLE voucher_transactions RESTART IDENTITY CASCADE;

  -- 4. Zamówienia (FK od voucher_transactions już nie istnieje po TRUNCATE CASCADE)
  DELETE FROM voucher_orders      WHERE true;

  -- 5. Profile pracowników
  SELECT ARRAY_AGG(id) INTO employee_ids
  FROM user_profiles WHERE role = 'pracownik';

  DELETE FROM user_profiles WHERE role = 'pracownik';

  RETURN jsonb_build_object(
    'ok', true,
    'employee_ids', to_jsonb(COALESCE(employee_ids, ARRAY[]::UUID[]))
  );
END;
$$;

COMMENT ON FUNCTION public.dev_cleanup_all() IS
  'DEV ONLY — czyści dane testowe (pracownicy, zamówienia, vouchery). '
  'Zachowuje konta pracodawca/superadmin i strukturę bazy. '
  'Wywołana przez cleanup-test-data.mjs.';

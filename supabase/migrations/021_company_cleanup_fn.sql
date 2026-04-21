-- Migration 020: Funkcja cleanup dla konkretnej firmy
-- Wklej w Supabase Dashboard → SQL Editor:
-- https://supabase.com/dashboard/project/ramedybmybcpqvelsmxd/sql/new
--
-- Strategia: set_config('app.bypass_ledger', 'true', true) zamiast session_replication_role
-- (session_replication_role wymaga superuser i jest zablokowane przez Supabase Cloud)
--
-- KROK 1: Zaktualizuj trigger fn_enforce_ledger_immutability o bypass
-- KROK 2: Utwórz/zastąp funkcję company_cleanup

-- ── Krok 1: Trigger z bypassem ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_enforce_ledger_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Pozwól na usunięcie, gdy wewnętrzna funkcja ustawiła bypass
  IF COALESCE(current_setting('app.bypass_ledger_immutability', true), '') = 'true' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION
    'NARUSZENIE ZASAD SYSTEMU: Tabela voucher_transactions jest immutable. '
    'UPDATE i DELETE są zabronione. Operacja: %, tabela: %',
    TG_OP, TG_TABLE_NAME;
END;
$$;

-- ── Krok 2: Funkcja cleanup ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.company_cleanup(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_ids   UUID[];
  v_counts     JSONB := '{}'::JSONB;
  v_cnt        INTEGER;
BEGIN
  -- Zbierz ID wszystkich użytkowników firmy (HR + pracownicy)
  SELECT ARRAY_AGG(id) INTO v_user_ids
  FROM user_profiles
  WHERE company_id = p_company_id;

  -- 1. Buyback batches (items kasowane przez ON DELETE CASCADE)
  DELETE FROM buyback_batches WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('buyback_batches', v_cnt);

  -- 2. Dokumenty finansowe
  DELETE FROM financial_documents WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('financial_documents', v_cnt);

  -- 3. Distribution batches
  DELETE FROM distribution_batches WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('distribution_batches', v_cnt);

  -- 4. Włącz bypass dla triggera immutable ledger (LOCAL = reset po COMMIT)
  PERFORM set_config('app.bypass_ledger_immutability', 'true', true);

  -- 5. Transakcje voucherowe (trigger teraz pominięty przez bypass)
  IF v_user_ids IS NOT NULL AND array_length(v_user_ids, 1) > 0 THEN
    DELETE FROM voucher_transactions
    WHERE from_user_id = ANY(v_user_ids)
       OR to_user_id   = ANY(v_user_ids);
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('voucher_transactions', v_cnt);

    -- 6. Konta voucherowe
    DELETE FROM voucher_accounts WHERE user_id = ANY(v_user_ids);
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('voucher_accounts', v_cnt);
  ELSE
    v_counts := v_counts || jsonb_build_object('voucher_transactions', 0, 'voucher_accounts', 0);
  END IF;

  -- 7. Vouchery firmy
  DELETE FROM vouchers WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('vouchers', v_cnt);

  -- 8. Zamówienia (FK do voucher_transactions już puste, więc OK)
  DELETE FROM voucher_orders WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('voucher_orders', v_cnt);

  -- 9. Wyłącz bypass
  PERFORM set_config('app.bypass_ledger_immutability', 'false', true);

  -- 10. Profile pracowników (zachowuje HR i superadmin)
  DELETE FROM user_profiles
  WHERE company_id = p_company_id AND role = 'pracownik';
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('pracownicy', v_cnt);

  RETURN jsonb_build_object('ok', true, 'deleted', v_counts);
END;
$$;

COMMENT ON FUNCTION public.company_cleanup IS
  'Czyści dane transakcyjne firmy. Zachowuje konto HR i rekord companies. '
  'Używa set_config bypass (zamiast session_replication_role) aby ominąć trigger immutable ledger. '
  'Wywołana przez POST /api/admin/company-cleanup.';


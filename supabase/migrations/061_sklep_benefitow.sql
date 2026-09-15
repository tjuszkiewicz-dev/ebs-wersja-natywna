-- =============================================================================
-- Migracja 061: Sklep benefitów v2 (spec docs/superpowers/specs/2026-09-15-sklep-benefitow-design.md §6.1)
--   1. redeem_voucher() przyjmuje status 'distributed' — dystrybucja (019/035) nadaje ten status,
--      a funkcja z 001 wymagała 'active', przez co żaden zakup na produkcji nigdy nie przeszedł
--      (ledger: 0 wpisów 'wykorzystanie' na dzień 2026-09-15).
--      Dodatkowo: twarda kontrola salda (INSUFFICIENT_BALANCE) i uprawnienia jak w nowej funkcji (recenzja Task 4).
--   2. redeem_vouchers_for_service() — realizacja N voucherów w JEDNEJ transakcji: najkrótszy
--      termin ważności pierwszy, za mało voucherów = nic nie schodzi, JEDEN wpis w ledgerze.
--   3. benefit_inquiries — zgłoszenia „Zapytaj o ofertę" (deduplikacja 7 dni + ślad dla BOK).
-- =============================================================================

-- 1. Naprawa historycznej funkcji (zostaje dla zgodności; nowy route jej nie woła)
CREATE OR REPLACE FUNCTION public.redeem_voucher(
  p_serial_number TEXT, p_user_id UUID, p_service_id TEXT DEFAULT NULL, p_service_name TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_voucher_id UUID;
BEGIN
  SELECT id INTO v_voucher_id FROM vouchers
  WHERE serial_number = p_serial_number AND current_owner_id = p_user_id
    AND status IN ('active', 'distributed') AND valid_until >= CURRENT_DATE
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voucher niedostępny lub nieważny (serial: %)', p_serial_number; END IF;
  UPDATE vouchers SET status = 'consumed', redeemed_at = NOW(), redeemed_by_user_id = p_user_id WHERE id = v_voucher_id;
  UPDATE voucher_accounts SET balance = balance - 1 WHERE user_id = p_user_id AND balance >= 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
  INSERT INTO voucher_transactions (from_user_id, to_user_id, amount, type, service_id, service_name)
  VALUES (p_user_id, p_user_id, 1, 'wykorzystanie', p_service_id, p_service_name);
  RETURN v_voucher_id;
END; $$;

REVOKE ALL ON FUNCTION public.redeem_voucher(TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_voucher(TEXT, UUID, TEXT, TEXT) TO service_role;

-- 2. Atomowa realizacja N voucherów za usługę
CREATE OR REPLACE FUNCTION public.redeem_vouchers_for_service(
  p_user_id UUID, p_amount INT, p_service_id TEXT, p_service_name TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_ids UUID[]; v_serials TEXT[]; v_tx_id UUID; v_found INT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  SELECT array_agg(id ORDER BY valid_until, serial_number), array_agg(serial_number ORDER BY valid_until, serial_number)
    INTO v_ids, v_serials
  FROM (
    SELECT id, serial_number, valid_until FROM vouchers
    WHERE current_owner_id = p_user_id AND status IN ('active', 'distributed') AND valid_until >= CURRENT_DATE
    ORDER BY valid_until, serial_number
    LIMIT p_amount
    FOR UPDATE SKIP LOCKED
  ) v;

  v_found := COALESCE(array_length(v_ids, 1), 0);
  IF v_found < p_amount THEN RAISE EXCEPTION 'INSUFFICIENT_VOUCHERS'; END IF;

  UPDATE voucher_accounts SET balance = balance - p_amount
  WHERE user_id = p_user_id AND balance >= p_amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;

  UPDATE vouchers SET status = 'consumed', redeemed_at = NOW(), redeemed_by_user_id = p_user_id
  WHERE id = ANY(v_ids);

  INSERT INTO voucher_transactions (from_user_id, to_user_id, amount, type, service_id, service_name, metadata)
  VALUES (p_user_id, p_user_id, p_amount, 'wykorzystanie', p_service_id, p_service_name,
          jsonb_build_object('voucher_ids', to_jsonb(v_ids), 'serials', to_jsonb(v_serials)))
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object('transaction_id', v_tx_id, 'redeemed', p_amount, 'serials', to_jsonb(v_serials));
END; $$;

REVOKE ALL ON FUNCTION public.redeem_vouchers_for_service(UUID, INT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_vouchers_for_service(UUID, INT, TEXT, TEXT) TO service_role;
COMMENT ON FUNCTION public.redeem_vouchers_for_service IS
  'Sklep benefitów: realizacja N voucherów za usługę w jednej transakcji (FIFO po valid_until). Jeden wpis w ledgerze.';

-- 3. Zgłoszenia „Zapytaj o ofertę"
CREATE TABLE IF NOT EXISTS public.benefit_inquiries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  service_id   TEXT NOT NULL,
  service_name TEXT NOT NULL,
  partner      TEXT,
  status       TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'done')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_benefit_inquiries_user_service ON public.benefit_inquiries (user_id, service_id, created_at DESC);
ALTER TABLE public.benefit_inquiries ENABLE ROW LEVEL SECURITY;  -- bez polityk: dostęp tylko service_role
DROP TRIGGER IF EXISTS trg_audit_benefit_inquiries ON public.benefit_inquiries;
CREATE TRIGGER trg_audit_benefit_inquiries
  AFTER INSERT OR UPDATE OR DELETE ON public.benefit_inquiries
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
COMMENT ON TABLE public.benefit_inquiries IS 'Zapytania o ofertę ze sklepu benefitów (cena 0). BOK pracuje z maili; tabela = deduplikacja + ślad.';

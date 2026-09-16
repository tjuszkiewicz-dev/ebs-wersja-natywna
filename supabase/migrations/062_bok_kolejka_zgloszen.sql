-- =============================================================================
-- Migracja 062: Kolejka zgłoszeń BOK w panelu admina (decyzja właściciela 2026-09-17,
--   spec docs/superpowers/specs/2026-09-15-sklep-benefitow-design.md §10 → §11).
--   1. benefit_inquiries: kto i kiedy obsłużył (handled_by/handled_at), notatka BOK, updated_at.
--   2. benefit_order_fulfillments — stan realizacji ZAMÓWIEŃ ze sklepu. Księga
--      (voucher_transactions) jest niezmienna (trg_ledger_no_update/no_delete), więc status
--      obsługi żyje obok niej, 1:1 po transaction_id. Kolumny service_*/amount/ordered_at to
--      kopie z księgi — nie mogą się rozjechać, bo księga nie zna UPDATE.
--   3. bok_sync_order_queue(p_auto_service_ids) — dosypuje do kolejki każdy wpis
--      'wykorzystanie' z księgi, którego jeszcze w niej nie ma. Kolejka jest POCHODNĄ księgi
--      (samonaprawa przy każdym odczycie), więc nie gubi zamówienia nawet wtedy, gdy zapis
--      po zakupie by nie doszedł. Pozycje realizowane automatycznie (aplikacje Eliton,
--      INTERNAL-*) wchodzą od razu jako 'done' — BOK nie ma przy nich nic do zrobienia.
-- =============================================================================

-- 1. Zapytania o ofertę: obsługa
ALTER TABLE public.benefit_inquiries
  ADD COLUMN IF NOT EXISTS handled_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS handled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS note       TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_benefit_inquiries_status_created
  ON public.benefit_inquiries (status, created_at DESC);

-- 2. Zamówienia: stan realizacji obok niezmiennej księgi
CREATE TABLE IF NOT EXISTS public.benefit_order_fulfillments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL UNIQUE REFERENCES public.voucher_transactions(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  service_id     TEXT NOT NULL,
  service_name   TEXT NOT NULL,
  amount         INT  NOT NULL,
  fulfillment    TEXT NOT NULL CHECK (fulfillment IN ('auto', 'bok')),
  status         TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'done')),
  handled_by     UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  handled_at     TIMESTAMPTZ,
  note           TEXT,
  ordered_at     TIMESTAMPTZ NOT NULL,          -- = voucher_transactions.created_at
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_benefit_order_fulfillments_status
  ON public.benefit_order_fulfillments (status, ordered_at DESC);
ALTER TABLE public.benefit_order_fulfillments ENABLE ROW LEVEL SECURITY;  -- bez polityk: tylko service_role
DROP TRIGGER IF EXISTS trg_audit_benefit_order_fulfillments ON public.benefit_order_fulfillments;
CREATE TRIGGER trg_audit_benefit_order_fulfillments
  AFTER INSERT OR UPDATE OR DELETE ON public.benefit_order_fulfillments
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
COMMENT ON TABLE public.benefit_order_fulfillments IS
  'Kolejka BOK: stan realizacji zamówień ze sklepu benefitów (1:1 z wpisem wykorzystanie w voucher_transactions).';

-- 3. Samonaprawa kolejki z księgi
CREATE OR REPLACE FUNCTION public.bok_sync_order_queue(p_auto_service_ids TEXT[] DEFAULT '{}')
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_inserted INT;
BEGIN
  INSERT INTO benefit_order_fulfillments
    (transaction_id, user_id, service_id, service_name, amount, fulfillment, status, ordered_at)
  SELECT t.id, p.id, COALESCE(t.service_id, ''), COALESCE(t.service_name, ''), t.amount,
         CASE WHEN t.service_id LIKE 'INTERNAL-%' OR t.service_id = ANY(p_auto_service_ids) THEN 'auto' ELSE 'bok' END,
         CASE WHEN t.service_id LIKE 'INTERNAL-%' OR t.service_id = ANY(p_auto_service_ids) THEN 'done' ELSE 'new' END,
         t.created_at
  FROM voucher_transactions t
  LEFT JOIN benefit_order_fulfillments f ON f.transaction_id = t.id
  LEFT JOIN user_profiles p ON p.id = t.to_user_id
  WHERE t.type = 'wykorzystanie' AND f.id IS NULL;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END; $$;

REVOKE ALL ON FUNCTION public.bok_sync_order_queue(TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bok_sync_order_queue(TEXT[]) TO service_role;
COMMENT ON FUNCTION public.bok_sync_order_queue IS
  'Kolejka BOK: dopisuje brakujące zamówienia z księgi (type=wykorzystanie); auto/INTERNAL-* od razu jako done.';

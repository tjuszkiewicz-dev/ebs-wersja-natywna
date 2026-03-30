-- =============================================================================
-- EBS — Migracja 004: Dodanie company_id do user_profiles
-- =============================================================================
-- Wcześniej powiązanie pracodawca ↔ firma było przez company_name (text match).
-- Teraz mamy FK do companies(id) — prawdziwa izolacja multi-tenant.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON user_profiles(company_id);

COMMENT ON COLUMN user_profiles.company_id IS
  'FK do companies — dla pracodawcy i pracownika identyfikuje ich firmę. NULL dla superadmin/partner/menedzer/dyrektor.';

-- Zaktualizuj politykę RLS na voucher_orders:
-- Stara: pracodawca widzi zamówienia przez dopasowanie company_name (kruche)
-- Nowa:  pracodawca widzi zamówienia swojej firmy przez company_id (FK)
DROP POLICY IF EXISTS "Zamówienia firmy — HR" ON voucher_orders;
DROP POLICY IF EXISTS "Zamówienia firmy — pracodawca" ON voucher_orders;
CREATE POLICY "Zamówienia firmy — pracodawca"
  ON voucher_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'pracodawca'
        AND up.company_id = voucher_orders.company_id
    )
  );

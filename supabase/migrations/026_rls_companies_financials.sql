-- =============================================================================
-- Migracja 026: RLS dla companies, company_contacts, financial_documents, products
-- =============================================================================
-- K6: companies ENABLE RLS bez policy → anon i authenticated nic nie widzą.
-- Wszystko leci przez service_role co czyni RLS teatrem.
-- Dodajemy explicite policies: superadmin pełny dostęp, pracodawca — własna firma.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- companies
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS companies_superadmin_all ON companies;
DROP POLICY IF EXISTS companies_pracodawca_own ON companies;

CREATE POLICY companies_superadmin_all ON companies FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'superadmin'));

CREATE POLICY companies_pracodawca_own ON companies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'pracodawca'
        AND up.company_id = companies.id
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- company_contacts
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE company_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_contacts_superadmin_all ON company_contacts;
DROP POLICY IF EXISTS company_contacts_pracodawca_own ON company_contacts;

CREATE POLICY company_contacts_superadmin_all ON company_contacts FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'superadmin'));

CREATE POLICY company_contacts_pracodawca_own ON company_contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'pracodawca'
        AND up.company_id = company_contacts.company_id
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- financial_documents
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE financial_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financial_docs_superadmin_all ON financial_documents;
DROP POLICY IF EXISTS financial_docs_pracodawca_own ON financial_documents;

CREATE POLICY financial_docs_superadmin_all ON financial_documents FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'superadmin'));

CREATE POLICY financial_docs_pracodawca_own ON financial_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'pracodawca'
        AND up.company_id = financial_documents.company_id
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- products (jeśli istnieje z migracji 010) — tylko superadmin / odczyt authenticated
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='products') THEN
    EXECUTE 'ALTER TABLE products ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS products_superadmin_all ON products';
    EXECUTE 'DROP POLICY IF EXISTS products_read_auth      ON products';
    EXECUTE $p$CREATE POLICY products_superadmin_all ON products FOR ALL
      USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'superadmin'))$p$;
    EXECUTE $p$CREATE POLICY products_read_auth ON products FOR SELECT
      USING (auth.uid() IS NOT NULL)$p$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='employee_purchases') THEN
    EXECUTE 'ALTER TABLE employee_purchases ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS employee_purchases_own       ON employee_purchases';
    EXECUTE 'DROP POLICY IF EXISTS employee_purchases_superadm  ON employee_purchases';
    EXECUTE $p$CREATE POLICY employee_purchases_own ON employee_purchases FOR SELECT
      USING (employee_id = auth.uid())$p$;
    EXECUTE $p$CREATE POLICY employee_purchases_superadm ON employee_purchases FOR ALL
      USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'superadmin'))$p$;
  END IF;
END $$;

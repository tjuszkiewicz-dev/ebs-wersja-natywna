-- =============================================================================
-- EBS — Migracja 003: Zarządzanie użytkownikami
-- =============================================================================

-- ---------------------------------------------------------------------------
-- import_history — historia importów CSV pracowników
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS import_history (
  id           TEXT        PRIMARY KEY,   -- REP-{timestamp}
  company_id   UUID        REFERENCES companies(id) ON DELETE SET NULL,
  date         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hr_name      TEXT        NOT NULL,
  total_processed INTEGER  NOT NULL DEFAULT 0,
  status       TEXT        NOT NULL CHECK (status IN ('SUCCESS','PARTIAL','FAILED')),
  report_data  JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE import_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_history_hr_read" ON import_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('superadmin','pracodawca')
    )
  );

CREATE POLICY "import_history_insert_service" ON import_history FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- iban_change_requests — wnioski o zmianę konta bankowego (RODO-safe)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS iban_change_requests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  new_iban         TEXT        NOT NULL,
  reason           TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','approved','rejected')),
  rejection_reason TEXT,
  requested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE iban_change_requests ENABLE ROW LEVEL SECURITY;

-- Użytkownik widzi swoje wnioski, superadmin wszystko
CREATE POLICY "iban_requests_select" ON iban_change_requests FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "iban_requests_insert_own" ON iban_change_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "iban_requests_update_superadmin" ON iban_change_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'superadmin'));

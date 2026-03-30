-- =============================================================================
-- EBS — Migracja 002: Tabele powiadomień
-- =============================================================================

-- ---------------------------------------------------------------------------
-- notifications — powiadomienia użytkowników
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT        NOT NULL,   -- auth.uid()::text LUB 'ALL_ADMINS'
  message          TEXT        NOT NULL,
  type             TEXT        NOT NULL    CHECK (type IN ('INFO','WARNING','SUCCESS','ERROR')),
  read             BOOLEAN     NOT NULL    DEFAULT FALSE,
  priority         TEXT                    CHECK (priority IN ('CRITICAL','HIGH','NORMAL','LOW')),
  action           JSONB,
  target_entity_id TEXT,
  target_entity_type TEXT,
  date             TIMESTAMPTZ NOT NULL    DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx    ON notifications(read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Czytaj swoje + ALL_ADMINS (tylko superadmin)
CREATE POLICY "notifications_select" ON notifications FOR SELECT
  USING (
    user_id = auth.uid()::text
    OR (
      user_id = 'ALL_ADMINS'
      AND EXISTS (
        SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'superadmin'
      )
    )
  );

-- Wstaw przez service_role (backend) — użytkownicy nie mogą tworzyć cudzych
CREATE POLICY "notifications_insert_service" ON notifications FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Oznacz jako przeczytane — tylko swoje
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- Usuń swoje
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE
  USING (user_id = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- notification_configs — konfiguracja reguł powiadomień (per firma)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_configs (
  id           TEXT        PRIMARY KEY,
  company_id   UUID        REFERENCES companies(id) ON DELETE CASCADE,
  target       TEXT        NOT NULL,
  trigger      TEXT        NOT NULL,
  enabled      BOOLEAN     NOT NULL DEFAULT TRUE,
  channels     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notification_configs ENABLE ROW LEVEL SECURITY;

-- HR czyta konfigurację swojej firmy, superadmin wszystko
CREATE POLICY "notif_configs_select" ON notification_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND (up.role = 'superadmin' OR up.company_name IS NOT NULL)
    )
  );

-- Tylko superadmin może modyfikować
CREATE POLICY "notif_configs_write_superadmin" ON notification_configs
  FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'superadmin'));

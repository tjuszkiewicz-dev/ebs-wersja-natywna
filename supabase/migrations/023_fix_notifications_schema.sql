-- =============================================================================
-- Migracja 023: Synchronizacja schematu `notifications` z rzeczywistym użyciem
-- =============================================================================
-- Problem (K4 z audytu):
--   Migracja 001 tworzyła `notifications` z user_id UUID (FK → auth.users) + is_read.
--   Migracja 002 tworzyła z user_id TEXT (pozwala 'ALL_ADMINS') + read + date.
--   CREATE IF NOT EXISTS w 002 był no-op gdy 001 przeszedł → rozbieżność.
--   Kod aplikacji (app/api/notifications/*, app/api/vouchers/*) używa schematu 002.
--   `types/database.ts` również opisuje schemat 002.
--
-- Rozwiązanie: idempotentnie wymusić schemat 002 na prod, bez strat danych.
-- =============================================================================

DO $$
DECLARE
  v_user_id_type TEXT;
  v_has_is_read  BOOLEAN;
  v_has_read     BOOLEAN;
  v_has_date     BOOLEAN;
BEGIN
  SELECT data_type INTO v_user_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'user_id';

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'is_read'
  ) INTO v_has_is_read;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'read'
  ) INTO v_has_read;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'date'
  ) INTO v_has_date;

  IF v_user_id_type = 'uuid' THEN
    DECLARE
      r_fk RECORD;
    BEGIN
      FOR r_fk IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.conrelid = 'public.notifications'::regclass
          AND c.contype = 'f'
          AND a.attname = 'user_id'
      LOOP
        EXECUTE format('ALTER TABLE notifications DROP CONSTRAINT %I', r_fk.conname);
      END LOOP;
    END;
    ALTER TABLE notifications ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
  END IF;

  IF v_has_is_read AND NOT v_has_read THEN
    ALTER TABLE notifications RENAME COLUMN is_read TO read;
  ELSIF v_has_is_read AND v_has_read THEN
    ALTER TABLE notifications DROP COLUMN is_read;
  END IF;

  IF NOT v_has_date THEN
    ALTER TABLE notifications ADD COLUMN date TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Indeksy zgodne z 002 (idempotentne)
DROP INDEX IF EXISTS idx_notifications_unread;
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx    ON notifications(read);

-- Polityki RLS zgodne z 002 (dropujemy starą '"Własne powiadomienia"' z 001)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Własne powiadomienia"          ON notifications;
DROP POLICY IF EXISTS notifications_select            ON notifications;
DROP POLICY IF EXISTS notifications_insert_service    ON notifications;
DROP POLICY IF EXISTS notifications_update_own        ON notifications;
DROP POLICY IF EXISTS notifications_delete_own        ON notifications;

CREATE POLICY notifications_select ON notifications FOR SELECT
  USING (
    user_id = auth.uid()::text
    OR (
      user_id = 'ALL_ADMINS'
      AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'superadmin')
    )
  );

CREATE POLICY notifications_insert_service ON notifications FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY notifications_update_own ON notifications FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY notifications_delete_own ON notifications FOR DELETE
  USING (user_id = auth.uid()::text);

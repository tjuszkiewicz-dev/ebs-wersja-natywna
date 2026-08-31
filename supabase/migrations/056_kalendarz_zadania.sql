-- E7b: kalendarz i zadania — schemat odtworzony introspekcją z żywej bazy BBS-Unified.
--
-- ⚠️ USTALENIE, KTÓRE ZMIENIA ZAŁOŻENIE SPECU E7:
--   Spec zakładał, że „Kalendarz" w CRM stoi na tabeli `crm_tasks` (założonej migracją 054).
--   Nieprawda — `components/adminNew/crm/CrmKalendarz.tsx` woła `/api/calendar/events`
--   i `/api/tasks`, a te stoją na TRZECH INNYCH tabelach: `calendar_events`,
--   `calendar_attendees` i `app_tasks`. `crm_tasks` istnieje w bazie BBS, ale nie używa jej
--   żaden żywy kod (`app/api/crm/tasks/` jest pusty, nikt go nie woła).
--   `crm_tasks` w EBS zostaje — nie szkodzi, jest pusta — ale NIE jest tabelą kalendarza.
--
-- Adaptacje EBS względem BBS:
--   * kolumna `workspace` nie portowana (jednonajemcowość — jak w 054),
--   * `calendar_attendees` dostaje KLUCZ GŁÓWNY (event_id, user_id) i FK z ON DELETE CASCADE.
--     W BBS tabela nie ma ani jednego, ani drugiego, więc usunięcie wydarzenia zostawia
--     osierocone wiersze uczestników. Kod i tak wstawia pary odduplikowane przez Set,
--     więc klucz główny niczego nie psuje, a porządkuje.
--   * audyt triggerami `fn_audit_log` (BBS używał `logEvent`, usuniętego z EBS przy porcie E2b).
--     `calendar_attendees` celowo bez triggera — wysoki wolumen, zerowa waga audytowa.
--
-- RLS: deny-all bez polityk, aplikacja chodzi na service_role (konwencja repo).

-- =============================================================================
-- 1) calendar_events — wydarzenia
-- =============================================================================
CREATE TABLE IF NOT EXISTS public."calendar_events" (
  "id"              uuid NOT NULL DEFAULT gen_random_uuid(),
  "title"           text NOT NULL,
  "description"     text,
  "starts_at"       timestamptz NOT NULL,
  "ends_at"         timestamptz,
  "all_day"         boolean NOT NULL DEFAULT false,
  "location"        text,
  "source"          text NOT NULL DEFAULT 'manual',
  "conversation_id" uuid,
  "created_by"      uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  "created_at"      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_starts_at  ON public."calendar_events"(starts_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON public."calendar_events"(created_by);

-- `conversation_id` bez klucza obcego: wskazuje na rozmowę z komunikatora (E6a),
-- którego jeszcze nie ma. FK dojdzie razem z tabelami czatu.

-- =============================================================================
-- 2) calendar_attendees — uczestnicy wydarzeń
-- =============================================================================
CREATE TABLE IF NOT EXISTS public."calendar_attendees" (
  "event_id" uuid NOT NULL REFERENCES public."calendar_events"(id) ON DELETE CASCADE,
  "user_id"  uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  PRIMARY KEY ("event_id", "user_id")
);
CREATE INDEX IF NOT EXISTS idx_calendar_attendees_user_id ON public."calendar_attendees"(user_id);

-- =============================================================================
-- 3) app_tasks — zadania (zlecane osobom, opcjonalnie wiązane z wydarzeniem)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public."app_tasks" (
  "id"          uuid NOT NULL DEFAULT gen_random_uuid(),
  "title"       text NOT NULL,
  "description" text,
  "assigned_to" uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  "due_date"    date,
  "status"      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','cancelled')),
  "source"      text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','meeting','ai')),
  "event_id"    uuid REFERENCES public."calendar_events"(id) ON DELETE SET NULL,
  "created_by"  uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "done_at"     timestamptz,
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS idx_app_tasks_assigned_to ON public."app_tasks"(assigned_to);
CREATE INDEX IF NOT EXISTS idx_app_tasks_created_by  ON public."app_tasks"(created_by);
CREATE INDEX IF NOT EXISTS idx_app_tasks_status      ON public."app_tasks"(status);

-- =============================================================================
-- 4) RLS — deny-all
-- =============================================================================
ALTER TABLE public."calendar_events"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."calendar_attendees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."app_tasks"          ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 5) Audyt
-- =============================================================================
DROP TRIGGER IF EXISTS trg_audit_calendar_events ON public."calendar_events";
CREATE TRIGGER trg_audit_calendar_events
  AFTER INSERT OR UPDATE OR DELETE ON public."calendar_events"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_app_tasks ON public."app_tasks";
CREATE TRIGGER trg_audit_app_tasks
  AFTER INSERT OR UPDATE OR DELETE ON public."app_tasks"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

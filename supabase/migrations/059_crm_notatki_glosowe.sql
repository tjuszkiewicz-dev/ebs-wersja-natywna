-- =============================================================================
-- 059 — Notatki głosowe CRM (E7e)
--
-- UWAGA: to NIE jest port z BBS. W BBS-Unified **nie ma** ani `app/api/notes/`,
-- ani `lib/notes`, ani tabeli notatek — jedynym wywołaniem `/api/notes/from-text`
-- w obu repozytoriach jest `components/agencja/HrTlumacz.tsx` (przeniesiony w E2d),
-- który degradował się cicho, bo endpoint nie istniał nigdzie. E7e domyka tę
-- zaślepkę, budując moduł pod kontrakt narzucony przez tego jedynego wołającego:
--   POST /api/notes/from-text  {text, title}
--     → {title, results:{events:[…], tasks:[…], emails:[…]}}
--
-- `email_drafts` to SZKICE, nie wysyłka. Poczta CRM należy do E6d (K4 w specu E7),
-- więc szkice czekają tu na moduł pocztowy; do tego czasu użytkownik je kopiuje.
--
-- RLS: deny-all zgodnie z konwencją repo (aplikacja chodzi na `service_role`).
-- Audyt: trigger `fn_audit_log` — w tej tabeli nie ma danych wrażliwych w rozumieniu
-- migracji 058, więc standardowa funkcja jest właściwa.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public."crm_voice_notes" (
  "id"            uuid NOT NULL DEFAULT gen_random_uuid(),
  "created_by"    uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  "lead_id"       uuid REFERENCES public."leads"(id) ON DELETE SET NULL,
  "title"         text NOT NULL,
  "source_text"   text NOT NULL,
  "summary"       text,
  "email_drafts"  jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- ślad po tym, co notatka faktycznie utworzyła (do pokazania w UI bez dociągania)
  "created_events" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_tasks"  jsonb NOT NULL DEFAULT '[]'::jsonb,
  "origin"        text NOT NULL DEFAULT 'text' CHECK (origin IN ('text','glos','tlumacz')),
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS idx_crm_voice_notes_created_by ON public."crm_voice_notes"(created_by);
CREATE INDEX IF NOT EXISTS idx_crm_voice_notes_lead_id    ON public."crm_voice_notes"(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_voice_notes_created_at ON public."crm_voice_notes"(created_at DESC);

ALTER TABLE public."crm_voice_notes" ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_audit_crm_voice_notes ON public."crm_voice_notes";
CREATE TRIGGER trg_audit_crm_voice_notes
  AFTER INSERT OR UPDATE OR DELETE ON public."crm_voice_notes"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

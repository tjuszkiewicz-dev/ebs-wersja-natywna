-- =============================================================================
-- 057 — CRM: zapisane kalkulacje ofertowe (E7c)
--
-- Odpowiednik BBS-owej tabeli `payroll_calculations`. ŚWIADOMA ZMIANA NAZWY na
-- `crm_calculations`: w EBS istnieje osobna domena płacowa agencji pracy
-- (tabele `hr_*`, silnik `lib/agencja/tax-engine`), więc tabela nazwana
-- „payroll_calculations" myliłaby się z listami płac pracowników tymczasowych.
-- To jest kalkulacja SPRZEDAŻOWA dla potencjalnego klienta, nie lista płac.
--
-- `calculator_configs` z BBS NIE jest portowana — EBS nie ma panelu do edycji
-- parametrów silnika, więc kalkulator jedzie na `DEFAULT_CONFIG`
-- z `lib/agencja/tax-engine/constants`. Kolumna `config` przechowuje snapshot
-- użytych parametrów, żeby stara kalkulacja dała się odtworzyć po zmianie stałych.
--
-- RLS: deny-all zgodnie z konwencją repo (aplikacja chodzi na `service_role`).
-- Audyt: trigger `fn_audit_log`, nie `logEvent` (konwencja EBS od E2b).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public."crm_calculations" (
  "id"               uuid NOT NULL DEFAULT gen_random_uuid(),
  "created_by"       uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  "lead_id"          uuid REFERENCES public."leads"(id) ON DELETE SET NULL,
  "company_name"     text NOT NULL,
  "nip"              text,
  "period"           text,
  "employees"        jsonb NOT NULL,
  "results"          jsonb NOT NULL,
  "config"           jsonb,
  "provision_percent" numeric,
  "status"           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected')),
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS idx_crm_calculations_created_by ON public."crm_calculations"(created_by);
CREATE INDEX IF NOT EXISTS idx_crm_calculations_lead_id    ON public."crm_calculations"(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_calculations_created_at ON public."crm_calculations"(created_at DESC);

ALTER TABLE public."crm_calculations" ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_audit_crm_calculations ON public."crm_calculations";
CREATE TRIGGER trg_audit_crm_calculations
  AFTER INSERT OR UPDATE OR DELETE ON public."crm_calculations"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

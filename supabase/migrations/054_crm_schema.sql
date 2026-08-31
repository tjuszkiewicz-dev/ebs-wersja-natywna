-- E7a: schemat modułu CRM — odtworzony introspekcją z żywej bazy BBS-Unified
-- (część tabel CRM nie miała w BBS plików migracji; źródło prawdy = information_schema).
--
-- Adaptacje EBS względem BBS (spec docs/superpowers/specs/2026-08-31-e7-crm-design.md):
--   K2 — kolumna `workspace` NIE jest portowana (EBS jest jednonajemcowy, w BBS to
--        znacznik wielonajemcy; byłoby martwe pole do wypełniania w każdym insercie).
--   K1 — dochodzi `user_profiles.manager_id` (+ hierarchia): bez niej `lib/crm/visibility`
--        zwraca dla każdego poza superadminem tylko jego własne id, czyli pusty CRM.
--   K3 — `crm_invoices` powstaje jako EWIDENCJA prowizji. Zero ścieżki wystawiania,
--        zero KSeF — decyzja E4 (Fakturownia jedynym fakturującym) zostaje w mocy.
--
-- RLS: konwencja repo — ENABLE bez polityk (deny-all dla anon/authenticated),
-- aplikacja chodzi na service_role. Audyt: triggery fn_audit_log, nie logEvent.

-- =============================================================================
-- 1) Hierarchia i role w user_profiles (K1)
-- =============================================================================
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS manager_id           uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hierarchical_id      text,
  ADD COLUMN IF NOT EXISTS is_agent_authorized  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS leadowiec_opiekun_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_manager_id      ON public.user_profiles(manager_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_hierarchical_id ON public.user_profiles(hierarchical_id);

-- Rola 'leadowiec' dochodzi do istniejącej listy EBS (zachowane: hr, szef_koordynatorow, owner —
-- BBS ich nie ma, więc NIE kopiujemy jego wersji CHECK-a, tylko rozszerzamy naszą).
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('superadmin','pracodawca','pracownik','partner','menedzer','dyrektor',
                  'hr','koordynator','szef_koordynatorow','platnik','pracownik_tymczasowy',
                  'owner','leadowiec'));

-- =============================================================================
-- 2) leads — lejek sprzedaży
-- =============================================================================
CREATE TABLE IF NOT EXISTS public."leads" (
  "id"               uuid NOT NULL DEFAULT gen_random_uuid(),
  "name"             text NOT NULL,
  "nip"              text,
  "contact_person"   text,
  "phone"            text,
  "email"            text,
  "notes"            text,
  "source"           text DEFAULT 'manual',
  "status"           text NOT NULL DEFAULT 'NEW',
  "assigned_to"      uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  "city"             text,
  "added_by_user_id" uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  "contacts"         jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public."leads"(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status      ON public."leads"(status);
CREATE INDEX IF NOT EXISTS idx_leads_nip         ON public."leads"(nip);

-- =============================================================================
-- 3) crm_activities — historia działań na leadzie
-- =============================================================================
CREATE TABLE IF NOT EXISTS public."crm_activities" (
  "id"          uuid NOT NULL DEFAULT gen_random_uuid(),
  "lead_id"     uuid NOT NULL REFERENCES public."leads"(id) ON DELETE CASCADE,
  "type"        text NOT NULL DEFAULT 'NOTE',
  "body"        text NOT NULL,
  "author_id"   uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  "author_name" text,
  "is_system"   boolean NOT NULL DEFAULT false,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS idx_crm_activities_lead_id    ON public."crm_activities"(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_created_at ON public."crm_activities"(created_at DESC);

-- =============================================================================
-- 4) crm_contacts — osoby kontaktowe (E7b, tabela zakładana od razu)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public."crm_contacts" (
  "id"           uuid NOT NULL DEFAULT gen_random_uuid(),
  "first_name"   text NOT NULL,
  "last_name"    text NOT NULL,
  "email"        text,
  "phone"        text,
  "position"     text,
  "company_name" text,
  "company_id"   uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  "assigned_to"  uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  "notes"        text,
  "is_primary"   boolean NOT NULL DEFAULT false,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  "updated_at"   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_assigned_to ON public."crm_contacts"(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_company_id  ON public."crm_contacts"(company_id);

-- =============================================================================
-- 5) crm_tasks — zadania (E7b)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public."crm_tasks" (
  "id"          uuid NOT NULL DEFAULT gen_random_uuid(),
  "title"       text NOT NULL,
  "description" text,
  "due_date"    date,
  "status"      text NOT NULL DEFAULT 'OPEN'   CHECK (status IN ('OPEN','IN_PROGRESS','DONE','CANCELLED')),
  "priority"    text NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH')),
  "assigned_to" uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  "created_by"  uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  "lead_id"     uuid REFERENCES public."leads"(id) ON DELETE CASCADE,
  "contact_id"  uuid REFERENCES public."crm_contacts"(id) ON DELETE SET NULL,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned_to ON public."crm_tasks"(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_lead_id     ON public."crm_tasks"(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status      ON public."crm_tasks"(status);

-- =============================================================================
-- 6) crm_offers — wygenerowane oferty (E7c)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public."crm_offers" (
  "id"                    uuid NOT NULL DEFAULT gen_random_uuid(),
  "lead_id"               uuid REFERENCES public."leads"(id) ON DELETE SET NULL,
  "created_by"            uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  "company_name"          text NOT NULL,
  "company_nip"           text,
  "employees_count"       integer,
  "provision_pct"         numeric,
  "total_savings_monthly" numeric,
  "total_savings_yearly"  numeric,
  "net_savings_monthly"   numeric,
  "pdf_url"               text,
  "pdf_path"              text,
  "snapshot"              jsonb,
  "created_at"            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS idx_crm_offers_lead_id    ON public."crm_offers"(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_offers_created_by ON public."crm_offers"(created_by);

-- =============================================================================
-- 7) crm_invoices — EWIDENCJA prowizji (K3: bez wystawiania, bez KSeF)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public."crm_invoices" (
  "id"               uuid NOT NULL DEFAULT gen_random_uuid(),
  "lead_id"          uuid REFERENCES public."leads"(id) ON DELETE SET NULL,
  "offer_id"         uuid REFERENCES public."crm_offers"(id) ON DELETE SET NULL,
  "issued_by"        uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  "invoice_number"   text,
  "amount_net"       numeric NOT NULL DEFAULT 0,
  "vat_rate"         numeric NOT NULL DEFAULT 23.00,
  "vat_amount"       numeric,
  "amount_gross"     numeric,
  "provision_pct"    numeric NOT NULL DEFAULT 0,
  "provision_amount" numeric,
  "status"           text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ISSUED','PAID','OVERDUE','CANCELLED')),
  "issued_at"        timestamptz,
  "due_at"           timestamptz,
  "paid_at"          timestamptz,
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS idx_crm_invoices_issued_by ON public."crm_invoices"(issued_by);
CREATE INDEX IF NOT EXISTS idx_crm_invoices_lead_id   ON public."crm_invoices"(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_invoices_status    ON public."crm_invoices"(status);

-- =============================================================================
-- 8) RLS — deny-all (aplikacja na service_role)
-- =============================================================================
ALTER TABLE public."leads"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."crm_activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."crm_contacts"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."crm_tasks"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."crm_offers"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."crm_invoices"   ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 9) Audyt (fn_audit_log, migracja 046 obsługuje klucze złożone)
-- Pominięte celowo: crm_activities (wysoki wolumen, sama tabela JEST historią).
-- =============================================================================
DROP TRIGGER IF EXISTS trg_audit_leads ON public."leads";
CREATE TRIGGER trg_audit_leads
  AFTER INSERT OR UPDATE OR DELETE ON public."leads"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_crm_contacts ON public."crm_contacts";
CREATE TRIGGER trg_audit_crm_contacts
  AFTER INSERT OR UPDATE OR DELETE ON public."crm_contacts"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_crm_offers ON public."crm_offers";
CREATE TRIGGER trg_audit_crm_offers
  AFTER INSERT OR UPDATE OR DELETE ON public."crm_offers"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_crm_invoices ON public."crm_invoices";
CREATE TRIGGER trg_audit_crm_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public."crm_invoices"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- =============================================================================
-- 10) Bucket na PDF ofert (E7c) — prywatny, jak hr-documents
-- =============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('crm-offers', 'crm-offers', false)
ON CONFLICT (id) DO NOTHING;

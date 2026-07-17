-- E2a: schemat modułu Agencji Pracy — odtworzony introspekcją z żywej bazy BBS-Unified
-- (tabele hr_* nie miały plików migracji w BBS; źródło prawdy = information_schema).
-- Adaptacje EBS: FK do auth.users/user_profiles zachowane; RLS jak w BBS
-- (odczyt własnych wierszy pracownika tam, gdzie BBS je miał; zapisy service_role);
-- + triggery fn_audit_log na tabelach zapisywanych przez panel.

CREATE TABLE IF NOT EXISTS public."hr_bhp_items" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "category" text,
  "unit_cost" numeric NOT NULL DEFAULT 0,
  "stock" integer,
  "sizes" text,
  "notes" text,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."hr_contracts" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "employer" text,
  "address" text,
  "contact_person" text,
  "phone" text,
  "status" text NOT NULL DEFAULT 'active'::text,
  "notes" text,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "lat" float8,
  "lng" float8,
  "geocoded_at" timestamptz,
  "geofence_m" integer NOT NULL DEFAULT 1000,
  PRIMARY KEY ("id"),
  CONSTRAINT "hr_contracts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES auth.users("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public."hr_accommodations" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "type" text DEFAULT 'inne'::text,
  "address" text,
  "capacity" integer,
  "description" text,
  "phone" text,
  "contact_person" text,
  "notes" text,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "lease_end_date" date,
  "monthly_rent" numeric,
  "deposit" numeric,
  "deposit_returned" boolean NOT NULL DEFAULT false,
  "rented_spots" integer,
  "price_per_person" numeric,
  "vat_rate" integer NOT NULL DEFAULT 23,
  "media_included" boolean NOT NULL DEFAULT false,
  "contacts" jsonb,
  "contract_id" uuid,
  "lat" float8,
  "lng" float8,
  "geocoded_at" timestamptz,
  "street" text,
  "house_no" text,
  "apartment_no" text,
  "postal_code" text,
  "city" text,
  "voivodeship" text,
  "county" text,
  "commune" text,
  "post_office" text,
  "available_from" date,
  PRIMARY KEY ("id"),
  CONSTRAINT "hr_accommodations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES public."hr_contracts"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public."hr_accommodation_photos" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "accommodation_id" uuid NOT NULL,
  "path" text NOT NULL,
  "filename" text,
  "caption" text,
  "uploaded_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "hr_accommodation_photos_accommodation_id_fkey" FOREIGN KEY ("accommodation_id") REFERENCES public."hr_accommodations"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."hr_vehicles" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "make" text NOT NULL,
  "model" text,
  "registration" text,
  "vin" text,
  "year" integer,
  "mileage" integer,
  "status" text NOT NULL DEFAULT 'aktywny'::text,
  "driver_name" text,
  "contract_id" uuid,
  "insurance_until" date,
  "inspection_until" date,
  "seats" integer,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "main_user_kind" text,
  "main_user_id" uuid,
  "main_user_name" text,
  "license_name" text,
  "license_number" text,
  "license_categories" text,
  "license_expiry" date,
  "license_photo_path" text,
  PRIMARY KEY ("id"),
  CONSTRAINT "hr_vehicles_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES public."hr_contracts"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public."hr_vehicle_costs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "vehicle_id" uuid NOT NULL,
  "cost_date" date NOT NULL DEFAULT CURRENT_DATE,
  "kind" text NOT NULL DEFAULT 'paliwo'::text,
  "amount" numeric(12,2) NOT NULL,
  "mileage" integer,
  "note" text,
  "acc_entry_id" uuid,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "hr_vehicle_costs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES public."hr_vehicles"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."hr_vehicle_photos" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "vehicle_id" uuid NOT NULL,
  "path" text NOT NULL,
  "filename" text,
  "caption" text,
  "uploaded_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "hr_vehicle_photos_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES public."hr_vehicles"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."hr_employees" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "phone" text,
  "email" text,
  "bank_account" text,
  "country_of_origin" text,
  "notes" text,
  "status" text NOT NULL DEFAULT 'active'::text,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "contract_id" uuid,
  "team" text,
  "residence_card_number" text,
  "residence_card_expiry" date,
  "work_permit_number" text,
  "work_permit_expiry" date,
  "visa_expiry" date,
  "zus_registration_date" date,
  "accommodation_id" uuid,
  "pesel" text,
  "passport_number" text,
  "birth_date" date,
  "birth_place" text,
  "second_name" text,
  "family_name" text,
  "passport_expiry" date,
  "archived" boolean NOT NULL DEFAULT false,
  "archived_at" timestamptz,
  "archived_from_contract_id" uuid,
  "archived_from" text,
  "second_last_name" text,
  "language" text,
  "coordinator_id" uuid,
  "candidate" boolean NOT NULL DEFAULT false,
  "submitted_by" uuid,
  "submitted_at" timestamptz,
  "profession" text,
  "blacklisted" boolean NOT NULL DEFAULT false,
  "blacklist_reason" text,
  "archive_reason" text,
  "user_id" uuid,
  "shoe_size" text,
  "clothing_size" text,
  "medical_exam_date" date,
  "medical_exam_expiry" date,
  "gender" text,
  "schengen_entry_date" date,
  PRIMARY KEY ("id"),
  CONSTRAINT "hr_employees_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "hr_employees_gender_check" CHECK ((gender = ANY (ARRAY['M'::text, 'K'::text]))),
  CONSTRAINT "hr_employees_accommodation_id_fkey" FOREIGN KEY ("accommodation_id") REFERENCES public."hr_accommodations"("id") ON DELETE SET NULL,
  CONSTRAINT "hr_employees_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES public."hr_contracts"("id") ON DELETE SET NULL,
  CONSTRAINT "hr_employees_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES auth.users("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public."hr_advances" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "employee_id" uuid NOT NULL,
  "period" text NOT NULL,
  "amount" numeric NOT NULL,
  "note" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  PRIMARY KEY ("id"),
  CONSTRAINT "hr_advances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES public."hr_employees"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."hr_bhp_issues" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "employee_id" uuid NOT NULL,
  "item_id" uuid,
  "item_name" text NOT NULL,
  "size" text,
  "quantity" integer NOT NULL DEFAULT 1,
  "unit_cost" numeric NOT NULL DEFAULT 0,
  "issued_at" date NOT NULL DEFAULT CURRENT_DATE,
  "returned_at" date,
  "acc_entry_id" uuid,
  "note" text,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "hr_bhp_issues_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES public."hr_employees"("id") ON DELETE CASCADE,
  CONSTRAINT "hr_bhp_issues_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES public."hr_bhp_items"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public."hr_coordinator_contracts" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "coordinator_id" uuid NOT NULL,
  "contract_id" uuid NOT NULL,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "hr_coordinator_contracts_coordinator_id_contract_id_key" UNIQUE ("coordinator_id", "contract_id"),
  CONSTRAINT "hr_coordinator_contracts_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES public."hr_contracts"("id") ON DELETE CASCADE,
  CONSTRAINT "hr_coordinator_contracts_coordinator_id_fkey" FOREIGN KEY ("coordinator_id") REFERENCES public."user_profiles"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."hr_coordinator_pay" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "period" text NOT NULL,
  "rate" numeric NOT NULL DEFAULT 0,
  "rate_type" text NOT NULL DEFAULT 'hourly'::text,
  "hours" numeric NOT NULL DEFAULT 0,
  "note" text,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "bonus" numeric NOT NULL DEFAULT 0,
  PRIMARY KEY ("id"),
  CONSTRAINT "hr_coordinator_pay_user_id_period_key" UNIQUE ("user_id", "period"),
  CONSTRAINT "hr_coordinator_pay_rate_type_check" CHECK ((rate_type = ANY (ARRAY['hourly'::text, 'flat'::text])))
);

CREATE TABLE IF NOT EXISTS public."hr_doc_templates" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "content_html" text NOT NULL DEFAULT ''::text,
  "has_letterhead" boolean NOT NULL DEFAULT false,
  "sort" integer NOT NULL DEFAULT 100,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "category" text NOT NULL DEFAULT 'pracownicze'::text,
  "kind" text NOT NULL DEFAULT 'html'::text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."hr_documents" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "employee_id" uuid NOT NULL,
  "filename" text NOT NULL,
  "path" text NOT NULL,
  "content_type" text,
  "size" bigint,
  "uploaded_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "ocr_status" text,
  "ocr_data" jsonb,
  "ocr_at" timestamptz,
  PRIMARY KEY ("id"),
  CONSTRAINT "hr_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES public."hr_employees"("id") ON DELETE CASCADE,
  CONSTRAINT "hr_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES auth.users("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public."hr_legalization" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "employee_id" uuid NOT NULL,
  "type" text NOT NULL DEFAULT 'karta_pobytu'::text,
  "status" text NOT NULL DEFAULT 'zbieranie_dokumentow'::text,
  "office" text,
  "case_number" text,
  "submitted_at" date,
  "decision_date" date,
  "deadline" date,
  "note" text,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "hr_legalization_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES public."hr_employees"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."hr_locations" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "employee_id" uuid NOT NULL,
  "lat" float8 NOT NULL,
  "lng" float8 NOT NULL,
  "accuracy" float4,
  "inside" boolean,
  "at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "hr_locations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES public."hr_employees"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."hr_payouts" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "employee_id" uuid NOT NULL,
  "period" text NOT NULL,
  "amount" numeric NOT NULL,
  "note" text,
  "paid_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  PRIMARY KEY ("id"),
  CONSTRAINT "hr_payouts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES public."hr_employees"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."hr_schedule" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "employee_id" uuid NOT NULL,
  "work_date" date NOT NULL,
  "shift" text,
  "start_time" time,
  "end_time" time,
  "hours" numeric NOT NULL DEFAULT 0,
  "source" text NOT NULL DEFAULT 'grafik'::text,
  "note" text,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "hr_schedule_employee_id_work_date_key" UNIQUE ("employee_id", "work_date"),
  CONSTRAINT "hr_schedule_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES public."hr_employees"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."hr_settlements" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "employee_id" uuid NOT NULL,
  "period" text NOT NULL,
  "rate" numeric NOT NULL DEFAULT 0,
  "rate_type" text NOT NULL DEFAULT 'hourly'::text,
  "hours" numeric NOT NULL DEFAULT 0,
  "note" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "housing_deduction" numeric NOT NULL DEFAULT 0,
  "other_deduction" numeric NOT NULL DEFAULT 0,
  "other_note" text,
  "bonus" numeric NOT NULL DEFAULT 0,
  PRIMARY KEY ("id"),
  CONSTRAINT "hr_settlements_employee_id_period_key" UNIQUE ("employee_id", "period"),
  CONSTRAINT "hr_settlements_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES public."hr_employees"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."hr_translator_usage" (
  "user_id" uuid NOT NULL,
  "day" date NOT NULL,
  "seconds" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("user_id", "day")
);

CREATE TABLE IF NOT EXISTS public."hr_transport_assignments" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "vehicle_id" uuid NOT NULL,
  "employee_id" uuid NOT NULL,
  "note" text,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "hr_transport_assignments_employee_id_key" UNIQUE ("employee_id"),
  CONSTRAINT "hr_transport_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES public."hr_employees"("id") ON DELETE CASCADE,
  CONSTRAINT "hr_transport_assignments_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES public."hr_vehicles"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."hr_work_sessions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "employee_id" uuid NOT NULL,
  "contract_id" uuid,
  "work_date" date NOT NULL,
  "started_at" timestamptz NOT NULL,
  "last_inside_at" timestamptz NOT NULL,
  "ended_at" timestamptz,
  "source" text NOT NULL DEFAULT 'gps'::text,
  PRIMARY KEY ("id"),
  CONSTRAINT "hr_work_sessions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES public."hr_contracts"("id") ON DELETE SET NULL,
  CONSTRAINT "hr_work_sessions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES public."hr_employees"("id") ON DELETE CASCADE
);

-- Indeksy dodatkowe (poza tymi wynikającymi z PK/UNIQUE)
DROP INDEX IF EXISTS public."idx_hr_contracts_created_by";
CREATE INDEX IF NOT EXISTS idx_hr_contracts_created_by ON public."hr_contracts" USING btree (created_by);
DROP INDEX IF EXISTS public."idx_hr_accommodations_contract_id";
CREATE INDEX IF NOT EXISTS idx_hr_accommodations_contract_id ON public."hr_accommodations" USING btree (contract_id);
DROP INDEX IF EXISTS public."hr_accommodation_photos_acc_idx";
CREATE INDEX IF NOT EXISTS hr_accommodation_photos_acc_idx ON public."hr_accommodation_photos" USING btree (accommodation_id, created_at DESC);
DROP INDEX IF EXISTS public."idx_hr_vehicles_contract_id";
CREATE INDEX IF NOT EXISTS idx_hr_vehicles_contract_id ON public."hr_vehicles" USING btree (contract_id);
DROP INDEX IF EXISTS public."hr_vehicle_costs_vehicle_idx";
CREATE INDEX IF NOT EXISTS hr_vehicle_costs_vehicle_idx ON public."hr_vehicle_costs" USING btree (vehicle_id, cost_date DESC);
DROP INDEX IF EXISTS public."hr_vehicle_photos_vehicle_idx";
CREATE INDEX IF NOT EXISTS hr_vehicle_photos_vehicle_idx ON public."hr_vehicle_photos" USING btree (vehicle_id, created_at DESC);
DROP INDEX IF EXISTS public."idx_hr_employees_name";
CREATE INDEX IF NOT EXISTS idx_hr_employees_name ON public."hr_employees" USING btree (last_name, first_name);
DROP INDEX IF EXISTS public."idx_hr_employees_contract";
CREATE INDEX IF NOT EXISTS idx_hr_employees_contract ON public."hr_employees" USING btree (contract_id);
DROP INDEX IF EXISTS public."idx_hr_employees_accommodation";
CREATE INDEX IF NOT EXISTS idx_hr_employees_accommodation ON public."hr_employees" USING btree (accommodation_id);
DROP INDEX IF EXISTS public."idx_hr_employees_archived";
CREATE INDEX IF NOT EXISTS idx_hr_employees_archived ON public."hr_employees" USING btree (archived);
DROP INDEX IF EXISTS public."hr_employees_coordinator_idx";
CREATE INDEX IF NOT EXISTS hr_employees_coordinator_idx ON public."hr_employees" USING btree (coordinator_id);
DROP INDEX IF EXISTS public."hr_employees_candidate_idx";
CREATE INDEX IF NOT EXISTS hr_employees_candidate_idx ON public."hr_employees" USING btree (candidate);
DROP INDEX IF EXISTS public."hr_employees_blacklisted_idx";
CREATE INDEX IF NOT EXISTS hr_employees_blacklisted_idx ON public."hr_employees" USING btree (blacklisted) WHERE (blacklisted = true);
DROP INDEX IF EXISTS public."idx_hr_employees_created_by";
CREATE INDEX IF NOT EXISTS idx_hr_employees_created_by ON public."hr_employees" USING btree (created_by);
DROP INDEX IF EXISTS public."idx_hr_advances_emp";
CREATE INDEX IF NOT EXISTS idx_hr_advances_emp ON public."hr_advances" USING btree (employee_id, period);
DROP INDEX IF EXISTS public."idx_bhp_issue_emp";
CREATE INDEX IF NOT EXISTS idx_bhp_issue_emp ON public."hr_bhp_issues" USING btree (employee_id);
DROP INDEX IF EXISTS public."idx_hr_bhp_issues_item_id";
CREATE INDEX IF NOT EXISTS idx_hr_bhp_issues_item_id ON public."hr_bhp_issues" USING btree (item_id);
DROP INDEX IF EXISTS public."idx_hr_coordinator_contracts_contract_id";
CREATE INDEX IF NOT EXISTS idx_hr_coordinator_contracts_contract_id ON public."hr_coordinator_contracts" USING btree (contract_id);
DROP INDEX IF EXISTS public."idx_coord_contracts_coord";
CREATE INDEX IF NOT EXISTS idx_coord_contracts_coord ON public."hr_coordinator_contracts" USING btree (coordinator_id);
DROP INDEX IF EXISTS public."idx_hr_documents_employee";
CREATE INDEX IF NOT EXISTS idx_hr_documents_employee ON public."hr_documents" USING btree (employee_id, created_at DESC);
DROP INDEX IF EXISTS public."idx_hr_documents_uploaded_by";
CREATE INDEX IF NOT EXISTS idx_hr_documents_uploaded_by ON public."hr_documents" USING btree (uploaded_by);
DROP INDEX IF EXISTS public."idx_legalization_emp";
CREATE INDEX IF NOT EXISTS idx_legalization_emp ON public."hr_legalization" USING btree (employee_id);
DROP INDEX IF EXISTS public."idx_legalization_status";
CREATE INDEX IF NOT EXISTS idx_legalization_status ON public."hr_legalization" USING btree (status);
DROP INDEX IF EXISTS public."hr_locations_emp_at_idx";
CREATE INDEX IF NOT EXISTS hr_locations_emp_at_idx ON public."hr_locations" USING btree (employee_id, at DESC);
DROP INDEX IF EXISTS public."hr_locations_at_idx";
CREATE INDEX IF NOT EXISTS hr_locations_at_idx ON public."hr_locations" USING btree (at DESC);
DROP INDEX IF EXISTS public."idx_hr_payouts_emp";
CREATE INDEX IF NOT EXISTS idx_hr_payouts_emp ON public."hr_payouts" USING btree (employee_id, period);
DROP INDEX IF EXISTS public."idx_hr_schedule_emp_date";
CREATE INDEX IF NOT EXISTS idx_hr_schedule_emp_date ON public."hr_schedule" USING btree (employee_id, work_date);
DROP INDEX IF EXISTS public."idx_hr_settlements_period";
CREATE INDEX IF NOT EXISTS idx_hr_settlements_period ON public."hr_settlements" USING btree (period);
DROP INDEX IF EXISTS public."idx_transport_vehicle";
CREATE INDEX IF NOT EXISTS idx_transport_vehicle ON public."hr_transport_assignments" USING btree (vehicle_id);
DROP INDEX IF EXISTS public."hr_work_sessions_emp_idx";
CREATE INDEX IF NOT EXISTS hr_work_sessions_emp_idx ON public."hr_work_sessions" USING btree (employee_id, work_date DESC);
DROP INDEX IF EXISTS public."hr_work_sessions_open_idx";
CREATE INDEX IF NOT EXISTS hr_work_sessions_open_idx ON public."hr_work_sessions" USING btree (employee_id) WHERE (ended_at IS NULL);
DROP INDEX IF EXISTS public."idx_hr_work_sessions_contract_id";
CREATE INDEX IF NOT EXISTS idx_hr_work_sessions_contract_id ON public."hr_work_sessions" USING btree (contract_id);

-- RLS: ENABLE na wszystkich 22 tabelach (BBS miał RLS ON, 0 polityk = deny-all poza service_role)
ALTER TABLE public."hr_bhp_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_contracts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_accommodations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_accommodation_photos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_vehicles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_vehicle_costs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_vehicle_photos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_employees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_advances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_bhp_issues" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_coordinator_contracts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_coordinator_pay" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_doc_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_legalization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_payouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_schedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_settlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_translator_usage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_transport_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_work_sessions" ENABLE ROW LEVEL SECURITY;

-- Triggery audytu (fn_audit_log, migracja 046 obsluguje klucze zlozone) na tabelach operacyjnych wysokiej wagi
-- Pominięte celowo: hr_locations, hr_work_sessions, hr_translator_usage, hr_schedule, foto (wysoki wolumen, niska waga audytowa)
DROP TRIGGER IF EXISTS trg_audit_hr_employees ON public."hr_employees";
CREATE TRIGGER trg_audit_hr_employees
  AFTER INSERT OR UPDATE OR DELETE ON public."hr_employees"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_hr_contracts ON public."hr_contracts";
CREATE TRIGGER trg_audit_hr_contracts
  AFTER INSERT OR UPDATE OR DELETE ON public."hr_contracts"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_hr_documents ON public."hr_documents";
CREATE TRIGGER trg_audit_hr_documents
  AFTER INSERT OR UPDATE OR DELETE ON public."hr_documents"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_hr_doc_templates ON public."hr_doc_templates";
CREATE TRIGGER trg_audit_hr_doc_templates
  AFTER INSERT OR UPDATE OR DELETE ON public."hr_doc_templates"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_hr_settlements ON public."hr_settlements";
CREATE TRIGGER trg_audit_hr_settlements
  AFTER INSERT OR UPDATE OR DELETE ON public."hr_settlements"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_hr_advances ON public."hr_advances";
CREATE TRIGGER trg_audit_hr_advances
  AFTER INSERT OR UPDATE OR DELETE ON public."hr_advances"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_hr_payouts ON public."hr_payouts";
CREATE TRIGGER trg_audit_hr_payouts
  AFTER INSERT OR UPDATE OR DELETE ON public."hr_payouts"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_hr_accommodations ON public."hr_accommodations";
CREATE TRIGGER trg_audit_hr_accommodations
  AFTER INSERT OR UPDATE OR DELETE ON public."hr_accommodations"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_hr_vehicles ON public."hr_vehicles";
CREATE TRIGGER trg_audit_hr_vehicles
  AFTER INSERT OR UPDATE OR DELETE ON public."hr_vehicles"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_hr_bhp_items ON public."hr_bhp_items";
CREATE TRIGGER trg_audit_hr_bhp_items
  AFTER INSERT OR UPDATE OR DELETE ON public."hr_bhp_items"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_hr_bhp_issues ON public."hr_bhp_issues";
CREATE TRIGGER trg_audit_hr_bhp_issues
  AFTER INSERT OR UPDATE OR DELETE ON public."hr_bhp_issues"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_hr_legalization ON public."hr_legalization";
CREATE TRIGGER trg_audit_hr_legalization
  AFTER INSERT OR UPDATE OR DELETE ON public."hr_legalization"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_hr_coordinator_contracts ON public."hr_coordinator_contracts";
CREATE TRIGGER trg_audit_hr_coordinator_contracts
  AFTER INSERT OR UPDATE OR DELETE ON public."hr_coordinator_contracts"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_hr_coordinator_pay ON public."hr_coordinator_pay";
CREATE TRIGGER trg_audit_hr_coordinator_pay
  AFTER INSERT OR UPDATE OR DELETE ON public."hr_coordinator_pay"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

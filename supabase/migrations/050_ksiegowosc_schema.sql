-- E4: schemat ksiegowosci (introspekcja z zywej bazy BBS; bez wlasnego KSeF - kolumny ksef_* zostaja nieuzywane).
-- 8 tabel acc_* (BBS-Unified nie mialo dla nich plikow migracji — zrodlo prawdy = information_schema/pg_catalog
-- zywej bazy pcszyyjwrkkkgbbcpzhn). Adaptacje EBS: FK acc_entries.accommodation_id/employee_id -> hr_accommodations/
-- hr_employees (istnieja juz w EBS, migracja 048); RLS ENABLE na wszystkich 8 (BBS mial RLS ON, 0 polityk = deny-all
-- poza service_role) + triggery fn_audit_log na tabelach operacyjnych wysokiej wagi (companies/contractors/entries/
-- invoices/fixed_assets). Modul faktur sprzedazowych (acc_invoices/acc_invoice_items) jest CELOWO nie wpiety w API
-- (E4d pominiete — Fakturownia zostaje jedynym fakturujacym); tabele tworzone mimo to, bo KPiR/VAT je selektuja.

CREATE TABLE IF NOT EXISTS public."acc_companies" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "nip" text,
  "regon" text,
  "address" text,
  "city" text,
  "postal_code" text,
  "email" text,
  "phone" text,
  "bank_account" text,
  "invoice_prefix" text NOT NULL DEFAULT 'FV'::text,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "hr_linked" boolean NOT NULL DEFAULT false,
  "ksef_token_enc" text,
  "ksef_env" text NOT NULL DEFAULT 'test'::text,
  PRIMARY KEY ("id"),
  CONSTRAINT "acc_companies_ksef_env_check" CHECK (("ksef_env" = ANY (ARRAY['test'::text, 'demo'::text, 'prod'::text])))
);

CREATE TABLE IF NOT EXISTS public."acc_company_members" (
  "company_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" text NOT NULL DEFAULT 'ksiegowa'::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("company_id", "user_id"),
  CONSTRAINT "acc_company_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::text, 'ksiegowa'::text, 'podglad'::text]))),
  CONSTRAINT "acc_company_members_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES public."acc_companies"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."acc_contractors" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL,
  "name" text NOT NULL,
  "nip" text,
  "address" text,
  "city" text,
  "postal_code" text,
  "email" text,
  "phone" text,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "acc_contractors_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES public."acc_companies"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."acc_fixed_assets" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL,
  "name" text NOT NULL,
  "purchase_date" date NOT NULL,
  "initial_value" numeric NOT NULL,
  "amortization_rate" numeric NOT NULL DEFAULT 20,
  "written_off_total" numeric NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'active'::text,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "acc_fixed_assets_status_check" CHECK (("status" = ANY (ARRAY['active'::text, 'sold'::text, 'liquidated'::text, 'fully_amortized'::text]))),
  CONSTRAINT "acc_fixed_assets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES public."acc_companies"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."acc_products" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL,
  "name" text NOT NULL,
  "sku" text,
  "unit" text NOT NULL DEFAULT 'szt.'::text,
  "purchase_price" numeric,
  "sale_price" numeric,
  "vat_rate" numeric NOT NULL DEFAULT 23,
  "stock_qty" numeric NOT NULL DEFAULT 0,
  "min_qty" numeric,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "acc_products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES public."acc_companies"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."acc_invoices" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL,
  "number" text NOT NULL,
  "contractor_id" uuid,
  "issue_date" date NOT NULL DEFAULT CURRENT_DATE,
  "sale_date" date NOT NULL DEFAULT CURRENT_DATE,
  "due_date" date,
  "payment_method" text NOT NULL DEFAULT 'przelew'::text,
  "status" text NOT NULL DEFAULT 'draft'::text,
  "total_net" numeric NOT NULL DEFAULT 0,
  "total_vat" numeric NOT NULL DEFAULT 0,
  "total_gross" numeric NOT NULL DEFAULT 0,
  "notes" text,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "paid_at" timestamptz,
  "ksef_ref" text,
  "ksef_number" text,
  "ksef_status" text,
  "ksef_sent_at" timestamptz,
  PRIMARY KEY ("id"),
  CONSTRAINT "acc_invoices_status_check" CHECK (("status" = ANY (ARRAY['draft'::text, 'issued'::text, 'paid'::text, 'overdue'::text, 'cancelled'::text]))),
  CONSTRAINT "acc_invoices_company_id_number_key" UNIQUE ("company_id", "number"),
  CONSTRAINT "acc_invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES public."acc_companies"("id") ON DELETE CASCADE,
  CONSTRAINT "acc_invoices_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES public."acc_contractors"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public."acc_invoice_items" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "invoice_id" uuid NOT NULL,
  "position" integer NOT NULL DEFAULT 1,
  "name" text NOT NULL,
  "quantity" numeric NOT NULL DEFAULT 1,
  "unit" text NOT NULL DEFAULT 'szt.'::text,
  "unit_price_net" numeric NOT NULL DEFAULT 0,
  "vat_rate" numeric NOT NULL DEFAULT 23,
  "net" numeric NOT NULL DEFAULT 0,
  "vat" numeric NOT NULL DEFAULT 0,
  "gross" numeric NOT NULL DEFAULT 0,
  PRIMARY KEY ("id"),
  CONSTRAINT "acc_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES public."acc_invoices"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."acc_entries" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "entry_date" date NOT NULL DEFAULT CURRENT_DATE,
  "kind" text NOT NULL DEFAULT 'cost'::text,
  "category" text,
  "description" text,
  "contractor" text,
  "invoice_number" text,
  "amount" numeric NOT NULL,
  "file_path" text,
  "file_type" text,
  "source" text NOT NULL DEFAULT 'manual'::text,
  "status" text NOT NULL DEFAULT 'zaksiegowana'::text,
  "accommodation_id" uuid,
  "employee_id" uuid,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "company_id" uuid,
  "ksef_number" text,
  PRIMARY KEY ("id"),
  CONSTRAINT "acc_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES public."acc_companies"("id"),
  CONSTRAINT "acc_entries_accommodation_id_fkey" FOREIGN KEY ("accommodation_id") REFERENCES public."hr_accommodations"("id") ON DELETE SET NULL,
  CONSTRAINT "acc_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES public."hr_employees"("id") ON DELETE SET NULL
);

-- Indeksy dodatkowe (poza tymi wynikającymi z PK/UNIQUE)
DROP INDEX IF EXISTS public."acc_company_members_user_idx";
CREATE INDEX IF NOT EXISTS acc_company_members_user_idx ON public."acc_company_members" USING btree (user_id);
DROP INDEX IF EXISTS public."acc_contractors_company_idx";
CREATE INDEX IF NOT EXISTS acc_contractors_company_idx ON public."acc_contractors" USING btree (company_id);
DROP INDEX IF EXISTS public."acc_fixed_assets_company_idx";
CREATE INDEX IF NOT EXISTS acc_fixed_assets_company_idx ON public."acc_fixed_assets" USING btree (company_id);
DROP INDEX IF EXISTS public."acc_products_company_idx";
CREATE INDEX IF NOT EXISTS acc_products_company_idx ON public."acc_products" USING btree (company_id);
DROP INDEX IF EXISTS public."acc_invoices_company_idx";
CREATE INDEX IF NOT EXISTS acc_invoices_company_idx ON public."acc_invoices" USING btree (company_id, issue_date DESC);
DROP INDEX IF EXISTS public."idx_acc_invoices_contractor_id";
CREATE INDEX IF NOT EXISTS idx_acc_invoices_contractor_id ON public."acc_invoices" USING btree (contractor_id);
DROP INDEX IF EXISTS public."acc_invoice_items_inv_idx";
CREATE INDEX IF NOT EXISTS acc_invoice_items_inv_idx ON public."acc_invoice_items" USING btree (invoice_id);
DROP INDEX IF EXISTS public."idx_acc_entries_accommodation_id";
CREATE INDEX IF NOT EXISTS idx_acc_entries_accommodation_id ON public."acc_entries" USING btree (accommodation_id);
DROP INDEX IF EXISTS public."idx_acc_entries_date";
CREATE INDEX IF NOT EXISTS idx_acc_entries_date ON public."acc_entries" USING btree (entry_date);
DROP INDEX IF EXISTS public."idx_acc_entries_employee_id";
CREATE INDEX IF NOT EXISTS idx_acc_entries_employee_id ON public."acc_entries" USING btree (employee_id);
DROP INDEX IF EXISTS public."idx_acc_entries_kind";
CREATE INDEX IF NOT EXISTS idx_acc_entries_kind ON public."acc_entries" USING btree (kind);
DROP INDEX IF EXISTS public."uq_acc_entries_company_ksef";
CREATE UNIQUE INDEX IF NOT EXISTS uq_acc_entries_company_ksef ON public."acc_entries" USING btree (company_id, ksef_number) WHERE (ksef_number IS NOT NULL);

-- RLS: ENABLE na wszystkich 8 tabelach (BBS mial RLS ON, 0 polityk = deny-all poza service_role)
ALTER TABLE public."acc_companies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."acc_company_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."acc_contractors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."acc_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."acc_fixed_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."acc_invoice_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."acc_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."acc_products" ENABLE ROW LEVEL SECURITY;

-- Triggery audytu (fn_audit_log, migracja 046 obsluguje klucze zlozone) na tabelach operacyjnych wysokiej wagi
-- Pominiete celowo: acc_company_members, acc_invoice_items, acc_products (niskie ryzyko/wolumen pomocniczy)
DROP TRIGGER IF EXISTS trg_audit_acc_companies ON public."acc_companies";
CREATE TRIGGER trg_audit_acc_companies
  AFTER INSERT OR UPDATE OR DELETE ON public."acc_companies"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_acc_contractors ON public."acc_contractors";
CREATE TRIGGER trg_audit_acc_contractors
  AFTER INSERT OR UPDATE OR DELETE ON public."acc_contractors"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_acc_entries ON public."acc_entries";
CREATE TRIGGER trg_audit_acc_entries
  AFTER INSERT OR UPDATE OR DELETE ON public."acc_entries"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_acc_invoices ON public."acc_invoices";
CREATE TRIGGER trg_audit_acc_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public."acc_invoices"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_acc_fixed_assets ON public."acc_fixed_assets";
CREATE TRIGGER trg_audit_acc_fixed_assets
  AFTER INSERT OR UPDATE OR DELETE ON public."acc_fixed_assets"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- Bucket Storage 'invoices' (private) — uzywany przez acc_entries.file_path (skany kosztow), nie tabela
INSERT INTO storage.buckets (id, name, public) VALUES ('invoices','invoices',false) ON CONFLICT (id) DO NOTHING;

-- Firma HR-linked dla auto-ksiegowania kosztow agencji (Stratton); dane do uzupelnienia w panelu
INSERT INTO public.acc_companies (name, nip, hr_linked)
  SELECT 'Stratton Prime (agencja)', NULL, true
  WHERE NOT EXISTS (SELECT 1 FROM public.acc_companies WHERE hr_linked = true);

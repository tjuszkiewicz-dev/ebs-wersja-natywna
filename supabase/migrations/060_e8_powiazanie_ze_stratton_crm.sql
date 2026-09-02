-- =============================================================================
-- 060 — E8: ślad pochodzenia rekordów zaimportowanych ze Stratton CRM
--
-- Bez tego ponowne uruchomienie importu zdublowałoby 20 leadów i 101 aktywności,
-- a przy modelu przejściowym (Stratton CRM = źródło prawdy, EBS czyta) nie dałoby
-- się powiedzieć, który lead odpowiada któremu klientowi w tamtym systemie.
--
-- Powiązanie trzymamy WYŁĄCZNIE po stronie EBS. Stratton CRM ma wprawdzie kolumny
-- `companies.ebs_company_id` / `ebs_synced_at`, ale są puste i celowo ich nie
-- ruszamy — właściciel przesądził, że synchronizacja jest jednokierunkowa.
-- =============================================================================
ALTER TABLE public."leads"
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_id     text;

ALTER TABLE public."crm_activities"
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_id     text;

-- Klucz idempotencji. ŚWIADOMIE NIE JEST CZĘŚCIOWY: PostgREST (a więc i `upsert`
-- z supabase-js) nie potrafi użyć indeksu częściowego jako celu ON CONFLICT —
-- "there is no unique or exclusion constraint matching the ON CONFLICT specification".
-- Zwykły indeks niczego nie blokuje, bo w Postgresie NULL-e są w unikalności
-- rozróżnialne: leady tworzone ręcznie w EBS mają oba pola NULL i mogą się powtarzać.
CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_external
  ON public."leads"(external_source, external_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_activities_external
  ON public."crm_activities"(external_source, external_id);

COMMENT ON COLUMN public."leads".external_id IS
  'ID rekordu w systemie zrodlowym (dla external_source=''stratton-crm'': companies.id)';

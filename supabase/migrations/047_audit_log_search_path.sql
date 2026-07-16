-- 047: przywraca wzorzec hardeningu z 039 — 046 (CREATE OR REPLACE) nadpisal proconfig
-- na sam `public`; bez jawnego pg_temp Postgres szuka relacji najpierw w pg_temp.
ALTER FUNCTION public.fn_audit_log() SET search_path = public, pg_temp;

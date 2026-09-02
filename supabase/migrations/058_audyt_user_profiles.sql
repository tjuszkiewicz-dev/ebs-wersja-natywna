-- =============================================================================
-- 058 — Audyt zmian STRUKTURALNYCH w user_profiles (E7d)
--
-- POWÓD: org-chart z E7d pozwala zmieniać `role` i `manager_id` przez UI, a
-- `user_profiles` była jedyną istotną tabelą BEZ triggera audytu (miała tylko
-- `trg_user_profiles_updated_at`). Zmiana roli to najbardziej wrażliwa operacja
-- w systemie — musi zostawiać ślad.
--
-- DLACZEGO NIE `fn_audit_log()`, tylko własna funkcja:
-- `fn_audit_log()` zapisuje `to_jsonb(NEW)` i `to_jsonb(OLD)`, czyli CAŁY wiersz.
-- W `user_profiles` siedzą `pesel`, `pesel_encrypted`, `iban`, `temp_password`
-- (hasło jednorazowe otwartym tekstem), telefon i adres — wpięcie standardowego
-- triggera skopiowałoby te dane do `audit_log` przy każdej edycji profilu.
-- Ta funkcja zapisuje WYŁĄCZNIE pola strukturalne i tylko wtedy, gdy któreś
-- z nich faktycznie się zmieniło (edycja telefonu nie zaśmieca dziennika).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_audit_user_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  stare jsonb;
  nowe  jsonb;
BEGIN
  -- Wyłącznie pola strukturalne/uprawnieniowe. NIGDY całego wiersza —
  -- patrz komentarz nagłówkowy migracji 058.
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    stare := jsonb_build_object(
      'id', OLD.id, 'role', OLD.role, 'full_name', OLD.full_name,
      'manager_id', OLD.manager_id, 'hierarchical_id', OLD.hierarchical_id,
      'leadowiec_opiekun_id', OLD.leadowiec_opiekun_id,
      'is_agent_authorized', OLD.is_agent_authorized,
      'company_id', OLD.company_id, 'status', OLD.status
    );
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    nowe := jsonb_build_object(
      'id', NEW.id, 'role', NEW.role, 'full_name', NEW.full_name,
      'manager_id', NEW.manager_id, 'hierarchical_id', NEW.hierarchical_id,
      'leadowiec_opiekun_id', NEW.leadowiec_opiekun_id,
      'is_agent_authorized', NEW.is_agent_authorized,
      'company_id', NEW.company_id, 'status', NEW.status
    );
  END IF;

  -- UPDATE bez zmiany pól strukturalnych (np. sam telefon) nie trafia do dziennika.
  IF TG_OP = 'UPDATE' AND stare = nowe THEN
    RETURN NEW;
  END IF;

  INSERT INTO audit_log (table_name, operation, row_id, changed_by, old_data, new_data)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    COALESCE(NEW.id, OLD.id)::text,
    auth.uid(),
    stare,
    nowe
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_user_profiles ON public.user_profiles;
CREATE TRIGGER trg_audit_user_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_user_profiles();

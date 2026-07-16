-- 046: fn_audit_log obsługuje tabele bez kolumny `id` (klucze złożone z migracji 044/045).
-- Dla tabel z `id` zachowanie IDENTYCZNE (COALESCE bierze id). Dla pozostałych row_id
-- składany jest z kluczy naturalnych (role/user_id/app_id/permission/view_id).
-- CREATE OR REPLACE zachowuje uprawnienia nadane w 039 (REVOKE PUBLIC / GRANT service_role).
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j   jsonb;
  rid text;
BEGIN
  j := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  rid := COALESCE(
    j->>'id',
    NULLIF(concat_ws(':', j->>'role', j->>'user_id', j->>'app_id', j->>'permission', j->>'view_id'), ''),
    '(brak klucza)'
  );
  INSERT INTO audit_log (table_name, operation, row_id, changed_by, old_data, new_data)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    rid,
    auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

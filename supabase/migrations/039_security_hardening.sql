-- Migracja 039: utwardzenie bezpieczeństwa wg Supabase Advisors.
-- Kontekst: aplikacja korzysta z service_role (omija RLS), a flagowane obiekty
-- (system_config, funkcje SECURITY DEFINER, RPC) są wołane WYŁĄCZNIE server-side.
-- Dlatego poniższe zmiany nie wpływają na działanie aplikacji.

-- 1) RLS na system_config (ERROR: rls_disabled_in_public).
--    Brak polityki = dostęp tylko dla service_role (server). Anon/authenticated: brak.
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- 2) Odbierz anon/authenticated prawo EXECUTE na funkcjach SECURITY DEFINER
--    wystawionych przez PostgREST (WARN: anon/authenticated_security_definer_function_executable).
--    Server woła je przez service_role (zachowuje EXECUTE). Funkcje triggerowe i tak
--    działają w kontekście definera niezależnie od tych grantów.
-- Grant EXECUTE idzie domyślnie do PUBLIC (anon/authenticated dziedziczą) — trzeba odebrać PUBLIC,
-- a przywrócić service_role (którego używa serwer). Pomijamy gpl_ma_dostep (możliwy helper RLS
-- ewaluowany w kontekście wołającej roli — odbieranie mogłoby zepsuć polityki).
REVOKE EXECUTE ON FUNCTION public.admin_voucher_tree()                FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_audit_log()                      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_auto_create_voucher_account()    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_employee_voucher_history(uuid)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_employee_vouchers(uuid, uuid)   FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_voucher_tree()                TO service_role;
GRANT  EXECUTE ON FUNCTION public.fn_audit_log()                      TO service_role;
GRANT  EXECUTE ON FUNCTION public.fn_auto_create_voucher_account()    TO service_role;
GRANT  EXECUTE ON FUNCTION public.get_employee_voucher_history(uuid)  TO service_role;
GRANT  EXECUTE ON FUNCTION public.get_employee_vouchers(uuid, uuid)   TO service_role;

-- 3) Ustaw stały search_path na WSZYSTKICH funkcjach public, które go nie mają
--    (WARN: function_search_path_mutable). 'public, pg_temp' zachowuje rozwiązywanie
--    nazw do schematu public (bez ryzyka zepsucia niekwalifikowanych referencji),
--    a jednocześnie usuwa mutowalność (którą wykrywa linter).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      -- pomiń funkcje należące do rozszerzeń (np. pg_trgm.set_limit — nie jesteśmy właścicielem)
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) c
        WHERE c LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp', r.proname, r.args);
  END LOOP;
END $$;

-- UWAGA (poza SQL): "Leaked Password Protection" to ustawienie Supabase Auth
-- (Dashboard → Authentication → Password) — do włączenia ręcznie, nie migracją.

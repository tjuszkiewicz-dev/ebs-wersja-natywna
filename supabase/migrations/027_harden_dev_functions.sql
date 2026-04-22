-- =============================================================================
-- Migracja 027: Zabezpieczenie funkcji dev_cleanup_all i company_cleanup
-- =============================================================================
-- M8: dev_cleanup_all() z migracji 011 jest SECURITY DEFINER bez REVOKE —
-- każdy authenticated user może wyczyścić całą bazę. To samo dla company_cleanup.
-- =============================================================================

-- Odbieramy uprawnienia publiczne i authenticated; zostawiamy tylko service_role.
DO $$
DECLARE
  fn_signature TEXT;
BEGIN
  FOR fn_signature IN
    SELECT p.oid::regprocedure::TEXT
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('dev_cleanup_all', 'company_cleanup')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn_signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn_signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn_signature);
  END LOOP;
END $$;

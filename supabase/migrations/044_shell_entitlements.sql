-- E1 (port z BBS-Unified): wyjątki dostępu do aplikacji shell/launcher per użytkownik.
-- Wzór: BBS 037_user_app_entitlements + 039_shell_reconcile.
CREATE TABLE IF NOT EXISTS public.user_app_entitlements (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id     text NOT NULL,
  effect     text NOT NULL CHECK (effect IN ('grant','revoke')),
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, app_id)
);
ALTER TABLE public.user_app_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own entitlements readable" ON public.user_app_entitlements;
CREATE POLICY "own entitlements readable" ON public.user_app_entitlements
  FOR SELECT USING (auth.uid() = user_id);
-- zapis wyłącznie przez service_role (panel superadmina) — brak polityk INSERT/UPDATE/DELETE

-- audyt zmian (EBS SP6: generyczny fn_audit_log)
DROP TRIGGER IF EXISTS trg_audit_user_app_entitlements ON public.user_app_entitlements;
CREATE TRIGGER trg_audit_user_app_entitlements
  AFTER INSERT OR UPDATE OR DELETE ON public.user_app_entitlements
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

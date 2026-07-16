-- E1 (port z BBS-Unified): macierz szczegółowych uprawnień (tab/action) + katalog ról
-- + konfiguracja widoczności widoków admina per rola. W BBS tabele istniały tylko
-- w żywej bazie (przez MCP) — tu definiujemy je jawnie.
CREATE TABLE IF NOT EXISTS public.app_roles (
  role       text PRIMARY KEY,
  label      text,
  is_system  boolean NOT NULL DEFAULT false,
  customized boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role       text NOT NULL,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission)
);

CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL,
  effect     text NOT NULL CHECK (effect IN ('grant','revoke')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission)
);

CREATE TABLE IF NOT EXISTS public.admin_view_config (
  role       text NOT NULL,
  view_id    text NOT NULL,
  label      text,
  hidden     boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, view_id)
);

-- RLS: deny-all (brak polityk) — dostęp wyłącznie przez service_role w API
ALTER TABLE public.app_roles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_view_config ENABLE ROW LEVEL SECURITY;

-- seed ról systemowych EBS (etykiety jak lib/roleMap.ROLE_LABEL)
INSERT INTO public.app_roles (role, label, is_system) VALUES
  ('superadmin', 'Administrator', true),
  ('pracodawca', 'Pracodawca',    true),
  ('pracownik',  'Pracownik',     true),
  ('partner',    'Doradca',       true),
  ('menedzer',   'Manager',       true),
  ('dyrektor',   'Dyrektor',      true)
ON CONFLICT (role) DO NOTHING;

-- audyt zmian
DROP TRIGGER IF EXISTS trg_audit_app_roles ON public.app_roles;
CREATE TRIGGER trg_audit_app_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.app_roles
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
DROP TRIGGER IF EXISTS trg_audit_role_permissions ON public.role_permissions;
CREATE TRIGGER trg_audit_role_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
DROP TRIGGER IF EXISTS trg_audit_user_permissions ON public.user_permissions;
CREATE TRIGGER trg_audit_user_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
DROP TRIGGER IF EXISTS trg_audit_admin_view_config ON public.admin_view_config;
CREATE TRIGGER trg_audit_admin_view_config
  AFTER INSERT OR UPDATE OR DELETE ON public.admin_view_config
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

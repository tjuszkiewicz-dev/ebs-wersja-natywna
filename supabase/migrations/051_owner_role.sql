-- Rola owner (Super Admin / Właściciel) — ponad superadminem. apiAuth normalizuje ją do
-- role='superadmin' (dziedziczy bramki) + flaga is_owner odblokowuje ekrany wyłączne.
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('superadmin','pracodawca','pracownik','partner','menedzer','dyrektor',
                  'hr','koordynator','szef_koordynatorow','platnik','pracownik_tymczasowy','owner'));
INSERT INTO public.app_roles (role, label, is_system) VALUES ('owner','Super Admin',true)
  ON CONFLICT (role) DO NOTHING;

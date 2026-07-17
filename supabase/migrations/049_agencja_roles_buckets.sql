-- E2a: role agencji + katalog rol + buckety storage
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('superadmin','pracodawca','pracownik','partner','menedzer','dyrektor',
                  'hr','koordynator','szef_koordynatorow','platnik','pracownik_tymczasowy'));

INSERT INTO public.app_roles (role, label, is_system) VALUES
  ('hr',                   'Panel HR',              true),
  ('koordynator',          'Koordynator',           true),
  ('platnik',              'Płatnik',               true),
  ('pracownik_tymczasowy', 'Pracownik Tymczasowy',  true)
ON CONFLICT (role) DO NOTHING;
-- szef_koordynatorow już istnieje (import E1, customized=true)

INSERT INTO storage.buckets (id, name, public) VALUES
  ('hr-documents',        'hr-documents',        false),
  ('accommodation-photos','accommodation-photos',false),
  ('vehicle-photos',      'vehicle-photos',      false)
ON CONFLICT (id) DO NOTHING;
-- dostęp do plików wyłącznie signed URL przez service_role (brak polityk storage.objects)

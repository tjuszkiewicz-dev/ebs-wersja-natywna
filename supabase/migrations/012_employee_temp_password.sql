-- =============================================================================
-- EBS — Migracja 012: Kolumna temp_password w user_profiles
-- Uruchom w Supabase Dashboard → SQL Editor
-- =============================================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS temp_password TEXT;

COMMENT ON COLUMN user_profiles.temp_password IS
  'Tymczasowe hasło pracownika ustawione przez HR. Widoczne tylko przez service_role. '
  'Powinno zostać wyczyszczone gdy pracownik sam zmieni hasło.';
